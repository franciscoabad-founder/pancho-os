// Tabs — lista horizontal con indicador activo en ultramarine. Reemplaza las
// filas de botones hand-rolled del OS (el helper `tab(activo)` de
// OSSaludEntrenamiento, el switch de vista kanban/tabla de OSCrm) por un solo
// primitivo con semantica de tablist y navegacion por flechas.
// Area tactil: min-height var(--os-tap-min) por tab.
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useRef } from 'react';

export interface TabItem {
  id: string;
  label: string;
  /** Contador opcional a la derecha del label (pendientes, resultados). */
  count?: number;
  /** Nombre de Material Symbol (ej. 'today'). */
  icon?: string;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  active: string;
  onChange: (id: string) => void;
  /** Etiqueta accesible del grupo, ej. 'Vistas de entrenamiento'. */
  ariaLabel?: string;
  /** Cada tab ocupa el mismo ancho y llena el contenedor. */
  fill?: boolean;
  style?: CSSProperties;
}

export default function Tabs({ tabs, active, onChange, ariaLabel, fill = false, style }: TabsProps) {
  const listaRef = useRef<HTMLDivElement>(null);

  // Patron tablist: las flechas mueven el foco y la seleccion entre tabs
  // habilitados; Tab (la tecla) sale del grupo, por eso el roving tabIndex.
  function navegar(e: ReactKeyboardEvent<HTMLButtonElement>, indice: number) {
    const paso = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!paso) return;
    e.preventDefault();
    const habilitados = tabs.filter((t) => !t.disabled);
    if (habilitados.length < 2) return;
    const actual = habilitados.findIndex((t) => t.id === tabs[indice].id);
    const siguiente = habilitados[(actual + paso + habilitados.length) % habilitados.length];
    onChange(siguiente.id);
    const nodo = listaRef.current?.querySelector<HTMLButtonElement>(`[data-tab-id="${siguiente.id}"]`);
    nodo?.focus();
  }

  return (
    <div
      ref={listaRef}
      role="tablist"
      aria-label={ariaLabel}
      aria-orientation="horizontal"
      className="os-hscroll"
      style={{
        display: 'flex', alignItems: 'stretch', gap: 4,
        borderBottom: '1px solid var(--os-line)', marginBottom: '1rem',
        ...style,
      }}
    >
      {tabs.map((t, i) => {
        const activo = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            data-tab-id={t.id}
            aria-selected={activo}
            tabIndex={activo ? 0 : -1}
            disabled={t.disabled}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => navegar(e, i)}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              flex: fill ? '1 1 0' : '0 0 auto',
              minHeight: 'var(--os-tap-min)', padding: '8px 14px',
              background: 'transparent', border: 'none',
              // El indicador es el borde inferior: se superpone al borde de la
              // lista, por eso el margen negativo de 1px.
              borderBottom: `2px solid ${activo ? 'var(--os-accent)' : 'transparent'}`,
              marginBottom: -1,
              fontFamily: 'var(--os-font-display)', fontSize: 'var(--os-text-sm)',
              fontWeight: 700, letterSpacing: '0.02em', whiteSpace: 'nowrap',
              color: activo ? 'var(--os-accent-light)' : 'var(--os-muted)',
              opacity: t.disabled ? 0.45 : 1,
              cursor: t.disabled ? 'not-allowed' : 'pointer',
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            {t.icon && (
              <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 17 }}>
                {t.icon}
              </span>
            )}
            {t.label}
            {typeof t.count === 'number' && (
              <span
                style={{
                  fontFamily: 'var(--os-font-mono)', fontSize: 11, fontWeight: 700,
                  padding: '1px 6px', borderRadius: 'var(--os-r-full)',
                  background: 'var(--os-fill-subtle)',
                  color: activo ? 'var(--os-accent-light)' : 'var(--os-muted)',
                }}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
