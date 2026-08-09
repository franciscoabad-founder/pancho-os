// Tab "Recetas" del sheet de captura: importar desde URL (JSON-LD) + buscar +
// detalle (ingredientes, instrucciones colapsadas, macros por porcion) + registrar.
import { useEffect, useState } from 'react';
import type { Receta, Momento } from './tipos';
import { input, btn, btnGhost, thumb, chipMuted, rowItem } from './estilos';
import { Spinner, EmptyState } from '../../ui';

interface Props {
  momento: Momento;
  dia: string;
  tipoDia: string;
  onAgregado: () => void;
}

export default function TabRecetas({ momento, dia, tipoDia, onAgregado }: Props) {
  const [q, setQ] = useState('');
  const [recetas, setRecetas] = useState<Receta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [detalle, setDetalle] = useState<Receta | null>(null);
  const [instruccionesAbiertas, setInstruccionesAbiertas] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importando, setImportando] = useState(false);
  const [errorImport, setErrorImport] = useState('');
  const [registrando, setRegistrando] = useState(false);

  async function cargar() {
    setCargando(true);
    try {
      const res = await fetch(`/api/os/salud/recetas${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
      const data = await res.json();
      setRecetas(data.recetas ?? []);
    } catch { setRecetas([]); }
    finally { setCargando(false); }
  }

  useEffect(() => {
    const t = setTimeout(cargar, q.trim() ? 250 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  async function abrirDetalle(id: string) {
    setInstruccionesAbiertas(false);
    const res = await fetch(`/api/os/salud/recetas?id=${id}`);
    const data = await res.json();
    if (data.receta) setDetalle(data.receta);
  }

  async function importar() {
    if (!importUrl.trim()) return;
    setImportando(true); setErrorImport('');
    try {
      const res = await fetch('/api/os/salud/recetas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ importar_url: importUrl.trim() }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setImportUrl('');
      await cargar();
      if (data.receta) abrirDetalle(data.receta.id);
    } catch (e) {
      setErrorImport(e instanceof Error ? e.message : 'No se pudo importar esa URL');
    } finally {
      setImportando(false);
    }
  }

  async function registrarPorcion() {
    if (!detalle) return;
    setRegistrando(true);
    try {
      const res = await fetch('/api/os/salud/comidas-log', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descripcion_libre: detalle.nombre, kcal: detalle.kcal, proteina_g: detalle.proteina_g,
          carbos_g: detalle.carbos_g, grasa_g: detalle.grasa_g, momento, fecha: dia, tipo_dia: tipoDia,
        }),
      });
      const data = await res.json();
      if (!data.error) onAgregado();
    } finally {
      setRegistrando(false);
    }
  }

  if (detalle) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button style={{ ...btnGhost, alignSelf: 'flex-start' }} onClick={() => setDetalle(null)}>‹ Volver</button>
        {detalle.foto_url && <img src={detalle.foto_url} alt="" style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 14 }} />}
        <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--os-text)', margin: 0 }}>{detalle.nombre}</p>
        {detalle.descripcion && <p style={{ fontSize: 'var(--os-text-sm)', color: 'var(--os-text-2)', margin: 0 }}>{detalle.descripcion}</p>}

        {(detalle.kcal != null) && (
          <div style={{ display: 'flex', gap: 12, fontSize: 13, fontFamily: 'var(--os-font-mono)', color: 'var(--os-text-2)', flexWrap: 'wrap' }}>
            <span>{detalle.kcal} kcal</span>
            {detalle.proteina_g != null && <span>P {detalle.proteina_g}g</span>}
            {detalle.carbos_g != null && <span>C {detalle.carbos_g}g</span>}
            {detalle.grasa_g != null && <span>G {detalle.grasa_g}g</span>}
            <span style={{ color: 'var(--os-muted)' }}>por porcion</span>
          </div>
        )}

        {!!detalle.ingredientes?.length && (
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--os-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '4px 0' }}>Ingredientes</p>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 'var(--os-text-sm)', color: 'var(--os-text-2)' }}>
              {detalle.ingredientes.map((ing) => <li key={ing.id}>{ing.descripcion}</li>)}
            </ul>
          </div>
        )}

        {!!detalle.instrucciones?.length && (
          <div>
            <button
              onClick={() => setInstruccionesAbiertas((v) => !v)}
              style={{ background: 'none', border: 'none', color: 'var(--os-accent-light)', fontSize: 'var(--os-text-xs)', fontWeight: 700, cursor: 'pointer', padding: 0, minHeight: 36 }}
            >
              {instruccionesAbiertas ? 'Ocultar instrucciones' : 'Ver instrucciones'}
            </button>
            {instruccionesAbiertas && (
              <ol style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 'var(--os-text-sm)', color: 'var(--os-text-2)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {detalle.instrucciones.map((paso, i) => <li key={i}>{paso}</li>)}
              </ol>
            )}
          </div>
        )}

        <button style={btn} disabled={registrando} onClick={registrarPorcion}>
          {registrando ? 'Registrando...' : 'Registrar porcion'}
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <input style={input} placeholder="Importar desde URL" value={importUrl} onChange={(e) => setImportUrl(e.target.value)} />
        <button style={btn} disabled={importando || !importUrl.trim()} onClick={importar}>{importando ? '...' : 'Importar'}</button>
      </div>
      {errorImport && <div style={{ color: 'var(--os-error)', fontSize: 12 }}>{errorImport}</div>}

      <input style={input} placeholder="Buscar receta" value={q} onChange={(e) => setQ(e.target.value)} />

      {cargando && <Spinner inline />}
      {!cargando && !recetas.length && (
        <EmptyState icon="menu_book" title="Sin recetas todavia" text="Importa la primera desde una URL con el campo de arriba." />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 320, overflowY: 'auto' }}>
        {recetas.map((r) => (
          <button key={r.id} onClick={() => abrirDetalle(r.id)}
            style={{ ...rowItem, background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', width: '100%' }}>
            {r.foto_url ? <img src={r.foto_url} alt="" loading="lazy" style={thumb(44)} /> : <div style={thumb(44)} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 'var(--os-text-sm)', color: 'var(--os-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nombre}</p>
              {r.fuente && <span style={chipMuted}>{r.fuente}</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
