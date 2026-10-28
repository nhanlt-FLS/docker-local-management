// Generic HTTP helpers. This file knows nothing about Docker endpoints; the
// Docker-specific functions are declared in docker.ts.

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export type Query = Record<string, string | number | boolean | undefined | null>;
export type HttpMethod = 'GET' | 'POST' | 'DELETE';

interface RequestOptions {
  body?: unknown;
  query?: Query;
  signal?: AbortSignal;
}

interface StreamOptions extends RequestOptions {
  onChunk: (chunk: string) => void;
}

export interface StreamHandle {
  abort: () => void;
  done: Promise<void>;
}

function buildUrl(path: string, query?: Query): string {
  let url = `/api${path}`;
  if (!query) return url;

  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, String(value));
    }
  });

  const queryString = params.toString();
  if (queryString) url += `?${queryString}`;
  return url;
}

function createRequestInit(method: HttpMethod, options: RequestOptions): RequestInit {
  const init: RequestInit = { method, signal: options.signal };
  if (options.body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }
  return init;
}

export async function request<T>(
  method: HttpMethod,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(buildUrl(path, options.query), createRequestInit(method, options));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ApiError(0, `Network error contacting the server: ${message}`);
  }

  const text = await response.text();
  let data: unknown = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    if (data && typeof data === 'object') {
      const body = data as Record<string, unknown>;
      message = String(body.message || body.error || message);
    } else if (typeof data === 'string' && data) {
      message = data;
    }
    throw new ApiError(response.status, message, data);
  }

  return data as T;
}

export async function streamRequest(
  method: HttpMethod,
  path: string,
  options: StreamOptions,
): Promise<StreamHandle> {
  const response = await fetch(buildUrl(path, options.query), createRequestInit(method, options));

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => '');
    throw new ApiError(response.status, text || `Stream failed (${response.status})`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let cancelled = false;

  const done = (async () => {
    try {
      while (true) {
        const { value, done: finished } = await reader.read();
        if (finished) break;
        if (value) options.onChunk(decoder.decode(value, { stream: true }));
      }
      options.onChunk(decoder.decode());
    } catch (error) {
      const requestError = error as Error;
      if (requestError.name !== 'AbortError' && !cancelled) {
        options.onChunk(`\n[stream error] ${requestError.message}\n`);
      }
    }
  })();

  return {
    abort: () => {
      cancelled = true;
      void reader.cancel().catch(() => undefined);
    },
    done,
  };
}
