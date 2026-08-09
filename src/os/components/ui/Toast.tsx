// Toast + useToast — reemplazo de alert(). Provider ligero con cola simple,
// auto-dismiss y aria-live. Sin dependencias.
//
// Uso:
//   <ToastProvider><MiIsla /></ToastProvider>
//   const toast = useToast();
//   toast.show('Guardado');            // neutro
//   toast.show('Fallo al guardar', 'error');
import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

export type ToastKind = 'info' | 'ok' | 'error';

interface ToastItem { id: number; text: string; kind: ToastKind }

interface ToastApi {
  show: (text: string, kind?: ToastKind, durationMs?: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fuera del provider no rompemos la isla: degradamos a console.
    return { show: (text) => console.warn('[toast sin provider]', text) };
  }
  return ctx;
}

const COLORES: Record<ToastKind, string> = {
  info: 'var(--os-text)',
  ok: 'var(--os-champagne)', /* hecho = champagne, regla CERO verde */
  error: 'var(--os-error)',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const show = useCallback((text: string, kind: ToastKind = 'info', durationMs = 3200) => {
    const id = nextId.current++;
    setItems((cur) => [...cur.slice(-3), { id, text, kind }]);
    window.setTimeout(() => {
      setItems((cur) => cur.filter((t) => t.id !== id));
    }, durationMs);
  }, []);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        role="status"
        style={{
          position: 'fixed', left: '50%', transform: 'translateX(-50%)',
          bottom: 'calc(84px + env(safe-area-inset-bottom, 0px))', zIndex: 400,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          pointerEvents: 'none', width: 'min(92vw, 420px)',
        }}
      >
        {items.map((t) => (
          <div
            key={t.id}
            style={{
              background: 'var(--os-surface)', border: '1px solid var(--os-line)',
              borderRadius: 'var(--os-r-md)', boxShadow: 'var(--os-shadow-modal)',
              padding: '10px 14px', fontSize: 'var(--os-text-sm)', color: COLORES[t.kind],
              fontFamily: 'var(--os-font-body)', maxWidth: '100%', textAlign: 'center',
              animation: 'os-fade-up 0.25s ease-out',
            }}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export default ToastProvider;
