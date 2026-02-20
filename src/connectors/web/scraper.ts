import axios from 'axios';
import * as cheerio from 'cheerio';

// ============================================================
// Web Connector — Search + Fetch JSON
// (web_scrape is now handled by external MCP fetch server
//  via mcp-servers.json)
// ============================================================

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9,th;q=0.8',
};

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

// ─── Web Search (DuckDuckGo — no API key needed) ─────────────
export async function webSearch(
  query: string,
  maxResults = 5
): Promise<SearchResult[]> {
  const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=th-th`;

  const { data } = await axios.get<string>(searchUrl, {
    headers: { ...HEADERS, Accept: 'text/html' },
    timeout: 15000,
  });

  const $ = cheerio.load(data);
  const results: SearchResult[] = [];

  // DuckDuckGo HTML selectors (try multiple patterns)
  const containers = $('.result, .web-result, [data-testid="result"]');

  containers.each((_, el) => {
    if (results.length >= maxResults) return false;

    const title =
      $(el).find('a.result__a, h2 a, .result__title a').first().text().trim() ||
      $(el).find('.result__title').text().trim();

    const rawUrl =
      $(el).find('a.result__a, h2 a').first().attr('href') ||
      $(el).find('.result__url').text().trim() ||
      '';

    const snippet =
      $(el).find('.result__snippet, .result-snippet, [data-testid="result-snippet"]').text().trim();

    if (title) {
      results.push({
        title,
        url: rawUrl.startsWith('http') ? rawUrl : rawUrl ? `https://${rawUrl}` : '',
        snippet: snippet || title,
      });
    }
  });

  // Fallback: try any <a> with substantial text if nothing found
  if (results.length === 0) {
    $('a[href^="http"]').each((_, el) => {
      if (results.length >= maxResults) return false;
      const text = $(el).text().trim();
      const href = $(el).attr('href') ?? '';
      if (text.length > 20 && !href.includes('duckduckgo.com')) {
        results.push({ title: text.slice(0, 100), url: href, snippet: text.slice(0, 200) });
      }
    });
  }

  return results;
}

// ─── Fetch JSON from URL ─────────────────────────────────────
export async function fetchJson(url: string, params?: Record<string, string>): Promise<unknown> {
  const { data } = await axios.get(url, {
    headers: HEADERS,
    params,
    timeout: 10000,
  });

  // ── Auto-parse known APIs so AI gets clean values ──────────
  // Swissquote XAU/USD gold price
  if (url.includes('swissquote.com') && url.includes('XAU')) {
    const arr = data as Array<{ spreadProfilePrices: Array<{ bid: number; ask: number }> }>;
    if (Array.isArray(arr) && arr[0]?.spreadProfilePrices?.[0]) {
      const { bid, ask } = arr[0].spreadProfilePrices[0];
      const mid = Math.round(((bid + ask) / 2) * 100) / 100;
      return {
        source: 'Swissquote',
        instrument: 'XAU/USD',
        unit: 'USD per troy oz',
        bid,
        ask,
        mid,
        price_usd_per_oz: mid,
        price_usd_per_gram: Math.round((mid / 31.1035) * 100) / 100,
        note: 'Use price_usd_per_oz for INSERT. 1 troy oz = 31.1035 grams.',
      };
    }
  }

  // Coinbase crypto price
  if (url.includes('coinbase.com') && url.includes('/prices/')) {
    const d = data as { data: { amount: string; currency: string; base: string } };
    if (d?.data?.amount) {
      return {
        source: 'Coinbase',
        pair: `${d.data.base}/${d.data.currency}`,
        price: parseFloat(d.data.amount),
        price_usd: parseFloat(d.data.amount),
        currency: d.data.currency,
      };
    }
  }

  // Frankfurter exchange rates
  if (url.includes('frankfurter.app')) {
    const d = data as { base: string; date: string; rates: Record<string, number> };
    if (d?.rates) {
      return {
        source: 'Frankfurter',
        base: d.base,
        date: d.date,
        rates: d.rates,
        // flatten top-level for easy access
        ...d.rates,
      };
    }
  }

  // Yahoo Finance stock/ETF price
  if (url.includes('finance.yahoo.com')) {
    try {
      const result = data as { chart: { result: Array<{ meta: { symbol: string; regularMarketPrice: number; currency: string; exchangeName: string; longName?: string } }> } };
      const meta = result?.chart?.result?.[0]?.meta;
      if (meta?.regularMarketPrice !== undefined) {
        return {
          source: 'Yahoo Finance',
          symbol: meta.symbol,
          name: meta.longName ?? meta.symbol,
          price: meta.regularMarketPrice,
          price_usd: meta.currency === 'USD' ? meta.regularMarketPrice : null,
          currency: meta.currency,
          exchange: meta.exchangeName,
          note: `Use price=${meta.regularMarketPrice} for INSERT`,
        };
      }
    } catch { /* fall through */ }
  }

  return data;
}
