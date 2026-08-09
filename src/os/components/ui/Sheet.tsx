// Sheet — bottom-sheet en movil / modal centrado en desktop, con overlay,
// cierre por Escape y click fuera. Fusiona el patron overlay/sheet/sheetHandle
// de gfit/estilos.ts y salud/nutricion/estilos.ts (esos modulos NO se tocan:
// migran a este componente en fase 2).
import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useState } from 'react';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Ancho maximo del panel (default 560). */
  maxWidth?: number;
  /** Footer fijo opcional (botones de accion). */
  footer?: ReactNode;
}

function useEsDesktop(): boolean {
  const [desktop, setDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 821px)').matches : true,
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 821px)');
    const fn = (e: MediaQueryListEvent) => setDesktop(e.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return desktop;
}

export default function Sheet({ open, onClose, title, children, maxWidth = 560, footer }: SheetProps) {
  const desktop = useEsDesktop();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const overlay: CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(20,20,20,0.42)', zIndex: 300,
    display: 'flex', justifyContent: 'center',
    alignItems: desktop ? 'center' : 'flex-end',
    padding: desktop ? '2rem 1rem' : 0,
  };
  const panel: CSSProperties = {
    background: 'var(--os-surface)', boxShadow: 'var(--os-shadow-modal)',
    width: '100%', maxWidth, maxHeight: desktop ? '85vh' : '86vh',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    borderRadius: desktop ? 'var(--os-r-lg)' : undefined,
    borderTopLeftRadius: desktop ? undefined : 22,
    borderTopRightRadius: desktop ? undefined : 22,
  };

  return (
    <div style={overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={title} style={panel}>
        {!desktop && (
          <div style={{ width: 40, height: 4, borderRadius: 999, background: 'var(--os-line)', margin: '10px auto 0', flexShrink: 0 }} />
        )}
        {(title || desktop) && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '0.875rem 1rem 0.5rem', flexShrink: 0 }}>
            <p style={{ margin: 0, fontFamily: 'var(--os-font-display)', fontWeight: 700, fontSize: 'var(--os-text-base)', color: 'var(--os-text)' }}>
              {title}
            </p>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 36, height: 36, background: 'var(--os-fill-subtle)', border: 'none',
                borderRadius: 'var(--os-r-full)', color: 'var(--os-muted)', cursor: 'pointer',
                fontSize: 17, lineHeight: 1, flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>
        )}
        <div style={{ overflowY: 'auto', padding: '0.25rem 1rem 1.25rem', flex: 1 }}>
          {children}
        </div>
        {footer && (
          <div style={{ padding: '0.75rem 1rem calc(0.75rem + env(safe-area-inset-bottom, 0px))', borderTop: '1px solid var(--os-line-soft)', display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0 }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
