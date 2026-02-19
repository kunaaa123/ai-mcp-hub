import axios from 'axios';
import config from '../config';
import { OllamaResponse, OllamaToolCall } from '../types';

// ============================================================
// Ollama Client — Low-level API wrapper
// ============================================================

export interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: Array<{
    function: { name: string; arguments: Record<string, unknown> };
  }>;
}

export interface OllamaChatOptions {
  messages: OllamaChatMessage[];
  tools?: object[];
  stream?: boolean;
}

export async function ollamaChat(options: OllamaChatOptions): Promise<OllamaResponse> {
  const { baseUrl, model, temperature, contextLength, timeout } = config.ollama;

  const response = await axios.post(
    `${baseUrl}/api/chat`,
    {
      model,
      messages: options.messages,
      tools: options.tools ?? [],
      options: {
        temperature,
        num_ctx: contextLength,
      },
      stream: options.stream ?? false,
    },
    { timeout }
  );

  return response.data as OllamaResponse;
}

// ─── Check if model is available ─────────────────────────────
export async function checkOllamaHealth(): Promise<{ available: boolean; models: string[] }> {
  try {
    const res = await axios.get(`${config.ollama.baseUrl}/api/tags`, { timeout: 5000 });
    const models = (res.data?.models ?? []).map((m: any) => m.name as string);
    return { available: true, models };
  } catch {
    return { available: false, models: [] };
  }
}

// ─── Pull model if not available ─────────────────────────────
export async function ensureModel(): Promise<void> {
  const { available, models } = await checkOllamaHealth();
  if (!available) {
    throw new Error(`Ollama is not running at ${config.ollama.baseUrl}`);
  }
  const modelName = config.ollama.model;
  const hasModel = models.some((m) => m.startsWith(modelName.split(':')[0]!));
  if (!hasModel) {
    console.log(`[Ollama] Model '${modelName}' not found. Available: ${models.join(', ')}`);
    console.log(`[Ollama] Run: ollama pull ${modelName}`);
  }
}
