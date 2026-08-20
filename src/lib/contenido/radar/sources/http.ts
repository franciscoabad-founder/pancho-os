// Shared HTTP helper for source adapters: JSON GET with AbortController timeout
// and sanitized error classification. Error messages never include the request
// URL (it may carry an api_key query param), headers or response bodies beyond
// a short provider reason string.

export interface JsonFetchOutcome {
  ok: boolean;
  status: number;
  data: unknown;
}

export class SourceHttpError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

/** Classifies an HTTP status into a short sanitized message. */
export function classifyHttpError(status: number, providerReason?: string): string {
  const suffix = providerReason ? `: ${providerReason.slice(0, 120)}` : '';
  if (status === 400) return `peticion invalida (HTTP 400)${suffix}`;
  if (status === 401) return 'credencial invalida o faltante (HTTP 401)';
  if (status === 403) return `acceso denegado (HTTP 403)${suffix}`;
  if (status === 429) return 'limite de peticiones excedido (HTTP 429)';
  if (status >= 500) return `error del proveedor (HTTP ${status})`;
  return `respuesta inesperada (HTTP ${status})`;
}

/**
 * GET JSON with timeout. Throws SourceHttpError with a sanitized message on
 * timeout, network failure, non-2xx status or malformed JSON.
 */
export async function fetchJson(url: string, timeoutMs: number): Promise<JsonFetchOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    const text = await res.text();
    let data: unknown = null;
    try {
      data = JSON.parse(text);
    } catch {
      if (res.ok) throw new SourceHttpError('respuesta del proveedor no es JSON valido', res.status);
    }
    if (!res.ok) {
      throw new SourceHttpError(classifyHttpError(res.status, extractProviderReason(data)), res.status);
    }
    return { ok: true, status: res.status, data };
  } catch (err) {
    if (err instanceof SourceHttpError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new SourceHttpError(`timeout tras ${timeoutMs}ms`);
    }
    if (err instanceof Error && err.name === 'AbortError') {
      throw new SourceHttpError(`timeout tras ${timeoutMs}ms`);
    }
    throw new SourceHttpError(`fallo de red: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    clearTimeout(timer);
  }
}

/** Pulls a short, safe reason string out of a provider error payload. */
function extractProviderReason(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const obj = data as Record<string, unknown>;
  // YouTube Data API: { error: { errors: [{ reason }], message } }
  const ytError = obj.error;
  if (ytError && typeof ytError === 'object') {
    const errors = (ytError as Record<string, unknown>).errors;
    if (Array.isArray(errors) && errors[0] && typeof errors[0] === 'object') {
      const reason = (errors[0] as Record<string, unknown>).reason;
      if (typeof reason === 'string') return reason;
    }
  }
  // SerpAPI: { error: "message" }
  if (typeof ytError === 'string') return ytError;
  return undefined;
}
