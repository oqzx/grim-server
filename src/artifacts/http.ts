import type { DiscoveryOptions } from './types.js';

const defaultFetch = (input: string | URL, init?: RequestInit): Promise<Response> =>
  fetch(input, init);

export async function requestJson(
  url: string,
  options: DiscoveryOptions & { headers?: HeadersInit } = {},
): Promise<unknown> {
  const response = await request(
    url,
    {
      headers: { 'User-Agent': 'grim-server', ...options.headers },
    },
    options,
  );
  if (!response.ok) throw new Error(`Discovery request failed: HTTP ${response.status}`);
  return response.json() as Promise<unknown>;
}

export async function request(
  input: string | URL,
  init: RequestInit,
  options: DiscoveryOptions = {},
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000);
  const signal = combineSignals(options.signal, controller.signal);
  try {
    return await withRetries(() => (options.fetch ?? defaultFetch)(input, { ...init, signal }));
  } finally {
    clearTimeout(timeout);
  }
}

async function withRetries(requester: () => Promise<Response>): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await requester();
      if (response.ok || response.status < 500) return response;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function combineSignals(...signals: (AbortSignal | undefined)[]): AbortSignal {
  const available = signals.filter((signal): signal is AbortSignal => signal !== undefined);
  if (available.length === 1 && available[0]) return available[0];
  const controller = new AbortController();
  for (const signal of available) {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
  }
  return controller.signal;
}

export { defaultFetch };
