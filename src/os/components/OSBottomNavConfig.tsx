// Editor del bottom-nav movil (Fase 2): Pancho elige hasta 5 destinos de
// navGroups y los guarda en os_config (key `bottom_nav`, cross-device via
// /api/config). OSLayout.tsx lee esa key al montar; si no hay nada guardado
// o la config quedo invalida, usa BOTTOM_NAV_DEFAULT.
//
// v1 deliberadamente simple: checkboxes en el orden de navGroups, sin
// drag-and-drop para reordenar. El orden que sale en el bottom-nav es el de
// navGroups, no el orden de seleccion.

import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Spinner, ToastProvider, useToast } from './ui';
import {
  BOTTOM_NAV_CONFIG_KEY,
  BOTTOM_NAV_DEFAULT,
  bottomNavHrefsValidos,
  navGroups,
} from './OSLayout.tsx';

const MAX_ITEMS = 5;
const MIN_ITEMS = 3;

async function leerError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return typeof data?.error === 'string' ? data.error : `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

function OSBottomNavConfigInner() {
  const toast = useToast();
  const [seleccion, setSeleccion] = useState<string[]>(BOTTOM_NAV_DEFAULT);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await fetch(`/api/config/${BOTTOM_NAV_CONFIG_KEY}`);
      if (!res.ok) throw new Error(await leerError(res));
      const data = await res.json();
      const value = data?.config?.value;
      setSeleccion(bottomNavHrefsValidos(value) ? value : BOTTOM_NAV_DEFAULT);
    } catch {
      // Sin config guardada (o tabla sin migrar todavia) es un estado normal:
      // se muestra el default y se deja guardar desde ahi.
      setSeleccion(BOTTOM_NAV_DEFAULT);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  function alternar(href: string) {
    setSeleccion((prev) => {
      if (prev.includes(href)) return prev.filter((h) => h !== href);
      if (prev.length >= MAX_ITEMS) {
        toast.show(`Maximo ${MAX_ITEMS} destinos en el bottom-nav.`, 'error');
        return prev;
      }
      return [...prev, href];
    });
  }

  async function guardar() {
    if (seleccion.length < MIN_ITEMS) {
      toast.show(`Elige al menos ${MIN_ITEMS} destinos.`, 'error');
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch(`/api/config/${BOTTOM_NAV_CONFIG_KEY}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: seleccion }),
      });
      if (!res.ok) throw new Error(await leerError(res));
      toast.show('Bottom-nav actualizado.', 'ok');
    } catch (err) {
      toast.show(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setGuardando(false);
    }
  }

  function restaurarDefault() {
    setSeleccion(BOTTOM_NAV_DEFAULT);
  }

  return (
    <Card>
      <div style={{ marginBottom: 12 }}>
        <p className="os-eyebrow" style={{ marginBottom: 4 }}>Navegacion movil</p>
        <h2 style={{ margin: 0, fontFamily: 'var(--os-font-display)', fontSize: 'var(--os-text-lg)', fontWeight: 800, color: 'var(--os-text)' }}>
          Bottom-nav
        </h2>
        <p style={{ margin: '6px 0 0', fontSize: 'var(--os-text-sm)', color: 'var(--os-muted)', lineHeight: 1.5 }}>
          Elige entre {MIN_ITEMS} y {MAX_ITEMS} destinos para la barra inferior del OS en movil. El resto sigue disponible
          en "Mas".
        </p>
      </div>

      {cargando ? (
        <Spinner inline label="Cargando configuracion..." />
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {navGroups.map((grupo) => (
              <div key={grupo.label}>
                <p className="nav-group-label" style={{ marginBottom: 4 }}>{grupo.label}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {grupo.items.map((item) => {
                    const marcado = seleccion.includes(item.href);
                    const deshabilitado = !marcado && seleccion.length >= MAX_ITEMS;
                    return (
                      <label
                        key={item.href}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8, padding: '0.3rem 0.25rem',
                          fontSize: 'var(--os-text-sm)', color: deshabilitado ? 'var(--os-muted)' : 'var(--os-text)',
                          cursor: deshabilitado ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={marcado}
                          disabled={deshabilitado}
                          onChange={() => alternar(item.href)}
                        />
                        {item.label}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            <Button size="sm" onClick={() => { void guardar(); }} disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </Button>
            <Button size="sm" variant="ghost" onClick={restaurarDefault} disabled={guardando}>
              Restaurar default
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

export default function OSBottomNavConfig() {
  return (
    <ToastProvider>
      <OSBottomNavConfigInner />
    </ToastProvider>
  );
}
