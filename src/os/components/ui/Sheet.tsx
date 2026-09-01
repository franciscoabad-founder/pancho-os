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
  /** 'center' (default, el comportamiento historico) o 'right': panel pegado
   * al borde derecho en desktop, mismo patron que Monday/Asana/Linear para
   * detalle de un registro. En movil 'right' se comporta igual que 'center'
   * (bottom-sheet): no hay espacio para un panel lateral angosto. */
  side?: 'center' | 'right';
  /** Si hay cambios sin guardar, Escape/click-fuera/X piden confirmacion en
   * vez de cerrar y perder lo escrito (p.ej. un comentario a medio tipear).
   * Devuelve true si debe cerrar. */
  confirmarCierre?: () => boolean | Promise<boolean>;
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

export default function Sheet({ open, onClose, title, children, maxWidth = 560, footer, side = 'center', confirmarCierre }: SheetProps) {
  const desktop = useEsDesktop();
  const lateral = side === 'right' && desktop;

  // Escape (y click fuera, y la X) pasan siempre por aca: si hay cambios sin
  // guardar, confirmarCierre() decide si de verdad se cierra. Sin esto, un
  // Escape accidental con un comentario a medio escribir lo tira sin avisar.
  async function pedirCierre() {
    if (confirmarCierre) {
      const ok = await confirmarCierre();
      if (!ok) return;
    }
    onClose();
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') void pedirCierre(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pedirCierre se recrea cada render a proposito (cierra sobre el confirmarCierre/onClose actuales).
  }, [open]);

  // Scroll lock: sin esto, en desktop con el panel abierto el scroll de la
  // rueda sigue moviendo la pagina de atras del overlay.
  useEffect(() => {
    if (!open) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previo; };
  }, [open]);

  if (!open) return null;

  const overlay: CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(20,20,20,0.42)', zIndex: 300,
    display: 'flex', justifyContent: lateral ? 'flex-end' : 'center',
    alignItems: desktop ? (lateral ? 'stretch' : 'center') : 'flex-end',
    padding: desktop && !lateral ? '2rem 1rem' : 0,
  };
  const panel: CSSProperties = {
    background: 'var(--os-surface)', boxShadow: 'var(--os-shadow-modal)',
    width: '100%', maxWidth, maxHeight: lateral ? '100vh' : desktop ? '85vh' : '86vh',
    height: lateral ? '100vh' : undefined,
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    borderRadius: desktop && !lateral ? 'var(--os-r-lg)' : undefined,
    borderTopLeftRadius: desktop ? undefined : 22,
    borderTopRightRadius: desktop ? undefined : 22,
  };

  return (
    <div style={overlay} onClick={(e) => { if (e.target === e.currentTarget) void pedirCierre(); }}>
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
              onClick={() => void pedirCierre()}
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
