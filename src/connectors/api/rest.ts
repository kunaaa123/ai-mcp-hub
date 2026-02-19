import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

// ============================================================
// REST API Connector
// ============================================================

export type AuthType = 'none' | 'bearer' | 'api_key' | 'basic';

export interface ApiCallOptions {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  auth?: {
    type: AuthType;
    token?: string;
    apiKey?: string;
    apiKeyHeader?: string;
    username?: string;
    password?: string;
  };
  timeout?: number;
  transformResponse?: string; // JSONPath or JS expression
}

export interface ApiCallResult {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: unknown;
  durationMs: number;
}

// ─── Single API Call ─────────────────────────────────────────
export async function callApi(options: ApiCallOptions): Promise<ApiCallResult> {
  const startTime = Date.now();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Handle authentication
  if (options.auth) {
    switch (options.auth.type) {
      case 'bearer':
        if (options.auth.token) headers['Authorization'] = `Bearer ${options.auth.token}`;
        break;
      case 'api_key':
        const headerName = options.auth.apiKeyHeader ?? 'X-API-Key';
        if (options.auth.apiKey) headers[headerName] = options.auth.apiKey;
        break;
      case 'basic':
        if (options.auth.username && options.auth.password) {
          const encoded = Buffer.from(
            `${options.auth.username}:${options.auth.password}`
          ).toString('base64');
          headers['Authorization'] = `Basic ${encoded}`;
        }
        break;
    }
  }

  const axiosConfig: AxiosRequestConfig = {
    method: options.method,
    url: options.url,
    headers,
    timeout: options.timeout ?? 30000,
  };

  if (options.body && ['POST', 'PUT', 'PATCH'].includes(options.method)) {
    axiosConfig.data = options.body;
  }

  const response: AxiosResponse = await axios(axiosConfig);
  const durationMs = Date.now() - startTime;

  let data = response.data;

  // Apply simple JSONPath-like transform if specified
  if (options.transformResponse && typeof data === 'object') {
    try {
      // Support dot notation: e.g., "data.users"
      const parts = options.transformResponse.split('.');
      let result: any = data;
      for (const part of parts) {
        result = result?.[part];
      }
      if (result !== undefined) data = result;
    } catch { /* ignore transform errors */ }
  }

  return {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers as Record<string, string>,
    data,
    durationMs,
  };
}

// ─── Chained API Calls ───────────────────────────────────────
export async function chainApiCalls(
  steps: ApiCallOptions[],
  context: Record<string, unknown> = {}
): Promise<{ results: ApiCallResult[]; finalData: unknown }> {
  const results: ApiCallResult[] = [];
  let lastData: unknown = null;

  for (const step of steps) {
    // Template substitution from context
    const resolvedStep = JSON.parse(
      JSON.stringify(step).replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
        String(context[key] ?? `{{${key}}}`)
      )
    ) as ApiCallOptions;

    const result = await callApi(resolvedStep);
    results.push(result);
    lastData = result.data;

    // Inject result data into context for next step
    if (typeof result.data === 'object' && result.data !== null) {
      Object.assign(context, result.data);
    }
  }

  return { results, finalData: lastData };
}
