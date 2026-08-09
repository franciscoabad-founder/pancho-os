// useResource — hook de datos sobre fetch a /api/os/*.
// Contrato uniforme: { data, loading, error, reload, mutate }.
// Los endpoints del OS (Molde A) responden JSON y usan { error } en fallo.
import { useCallback, useEffect, useRef, useState } from 'react';

export interface Resource<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** Vuelve a pedir el recurso (muestra loading solo si no hay data previa). */
  reload: () => Promise<void>;
  /** Actualiza data localmente (optimista) sin refetch. */
  mutate: (updater: T | ((cur: T | null) => T | null)) => void;
}

export default function useResource<T>(url: string, init?: RequestInit): Resource<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const vivo = useRef(true);
  const initRef = useRef(init);
  initRef.current = init;

  const cargar = useCallback(async () => {
    setError(null);
    setData((cur) => {
      if (cur == null) setLoading(true);
      return cur;
    });
    try {
      const res = await fetch(url, initRef.current);
      const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
      if (!vivo.current) return;
      if (!res.ok || (body && typeof body === 'object' && 'error' in body && body.error)) {
        setError((body as { error?: string } | null)?.error ?? `Error ${res.status}`);
      } else {
        setData(body as T);
      }
    } catch {
      if (vivo.current) setError('Error de conexion.');
    } finally {
      if (vivo.current) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    vivo.current = true;
    cargar();
    return () => { vivo.current = false; };
  }, [cargar]);

  const mutate = useCallback((updater: T | ((cur: T | null) => T | null)) => {
    setData((cur) => (typeof updater === 'function' ? (updater as (c: T | null) => T | null)(cur) : updater));
  }, []);

  return { data, loading, error, reload: cargar, mutate };
}
