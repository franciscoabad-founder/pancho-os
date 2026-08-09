import { useEffect, useState } from 'react';
import type { Dia, Ejercicio, Rutina } from './tipos';
import { GRUPO_ES, NIVELES, chipsGrupo, nombreEjercicio } from './tipos';
import { card2, input, btn, btnGhost, pill, chip, sel } from './estilos';
import { Sheet, Spinner, EmptyState } from '../ui';

interface TaxonomiaFila { tipo: string; slug: string; nombre_en: string; nombre_es: string; padre_slug: string | null; orden: number | null }
type Taxonomia = Record<string, TaxonomiaFila[]>;

const NIVEL_COLOR: Record<string, string> = { beginner: 'var(--os-ok)', intermediate: 'var(--os-accent)', expert: 'var(--os-warn)' };

export default function OSGfitBiblioteca() {
  const [q, setQ] = useState('');
  const [equipo, setEquipo] = useState('');
  const [patron, setPatron] = useState('');
  const [grupo, setGrupo] = useState('');
  const [nivel, setNivel] = useState('');
  const [panelAbierto, setPanelAbierto] = useState<'equipo' | 'patron' | 'grupo' | 'nivel' | null>(null);
  const [taxonomia, setTaxonomia] = useState<Taxonomia>({});
  const [ejercicios, setEjercicios] = useState<Ejercicio[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detalle, setDetalle] = useState<Ejercicio | null>(null);
  const LIMIT = 50;

  useEffect(() => {
    fetch('/api/os/gfit/catalogo?taxonomia=1').then((r) => r.json()).then((d) => setTaxonomia(d.taxonomia ?? {}));
  }, []);

  async function buscar(nuevoOffset: number) {
    setLoading(true);
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (equipo) params.set('equipo', equipo);
    if (patron) params.set('patron', patron);
    if (grupo) params.set('grupo', grupo);
    if (nivel) params.set('nivel', nivel);
    params.set('limit', String(LIMIT));
    params.set('offset', String(nuevoOffset));
    const res = await fetch(`/api/os/gfit/catalogo?${params}`);
    const data = await res.json();
    setEjercicios((cur) => (nuevoOffset === 0 ? (data.ejercicios ?? []) : [...cur, ...(data.ejercicios ?? [])]));
    setTotal(data.total ?? null);
    setOffset(nuevoOffset);
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(() => buscar(0), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, equipo, patron, grupo, nivel]);

  const filtrosActivos: { key: string; label: string; limpiar: () => void }[] = [
    equipo && { key: 'equipo', label: taxonomia.equipo?.find((f) => f.slug === equipo)?.nombre_es ?? equipo, limpiar: () => setEquipo('') },
    patron && { key: 'patron', label: taxonomia.patron?.find((f) => f.slug === patron)?.nombre_es ?? patron, limpiar: () => setPatron('') },
    grupo && { key: 'grupo', label: GRUPO_ES[grupo] ?? grupo, limpiar: () => setGrupo('') },
    nivel && { key: 'nivel', label: NIVELES.find((n) => n.key === nivel)?.label ?? nivel, limpiar: () => setNivel('') },
  ].filter(Boolean) as { key: string; label: string; limpiar: () => void }[];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <input style={input} placeholder="Buscar ejercicio..." value={q} onChange={(e) => setQ(e.target.value)} />

      <div className="os-hscroll" style={{ display: 'flex', gap: 6 }}>
        <button style={pill(panelAbierto === 'equipo')} onClick={() => setPanelAbierto(panelAbierto === 'equipo' ? null : 'equipo')}>Equipo</button>
        <button style={pill(panelAbierto === 'patron')} onClick={() => setPanelAbierto(panelAbierto === 'patron' ? null : 'patron')}>Patrón</button>
        <button style={pill(panelAbierto === 'grupo')} onClick={() => setPanelAbierto(panelAbierto === 'grupo' ? null : 'grupo')}>Grupo muscular</button>
        <button style={pill(panelAbierto === 'nivel')} onClick={() => setPanelAbierto(panelAbierto === 'nivel' ? null : 'nivel')}>Nivel</button>
      </div>

      {panelAbierto === 'equipo' && (
        <PanelChips items={(taxonomia.equipo ?? []).filter((f) => f.padre_slug)} valor={equipo} onElegir={(v) => { setEquipo(v); setPanelAbierto(null); }} />
      )}
      {panelAbierto === 'patron' && (
        <PanelChips items={taxonomia.patron ?? []} valor={patron} onElegir={(v) => { setPatron(v); setPanelAbierto(null); }} />
      )}
      {panelAbierto === 'grupo' && (
        <PanelChips items={taxonomia.grupo_muscular ?? []} valor={grupo} onElegir={(v) => { setGrupo(v); setPanelAbierto(null); }} />
      )}
      {panelAbierto === 'nivel' && (
        <div style={{ ...card2, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {NIVELES.map((n) => (
            <button key={n.key} style={pill(nivel === n.key)} onClick={() => { setNivel(n.key); setPanelAbierto(null); }}>{n.label}</button>
          ))}
        </div>
      )}

      {filtrosActivos.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {filtrosActivos.map((f) => (
            <button key={f.key} style={{ ...chip, cursor: 'pointer', border: 'none' }} onClick={f.limpiar}>{f.label} ✕</button>
          ))}
        </div>
      )}

      {loading && !ejercicios.length ? <Spinner /> :
        !ejercicios.length ? (
          <EmptyState
            icon="search_off"
            title="Sin resultados"
            text="Prueba con otro término o quita los filtros activos."
            action={filtrosActivos.length > 0 ? (
              <button style={btnGhost} onClick={() => { setEquipo(''); setPatron(''); setGrupo(''); setNivel(''); }}>Quitar filtros</button>
            ) : undefined}
          />
        ) :
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {ejercicios.map((e) => (
              <button key={e.id} onClick={() => setDetalle(e)} style={{
                ...card2, textAlign: 'left', cursor: 'pointer', padding: 8, display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', borderRadius: 12, overflow: 'hidden', background: 'var(--os-surface-3)' }}>
                  {e.imagenes?.[0] && <img src={e.imagenes[0]} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                  {e.nivel && <span style={{ position: 'absolute', top: 6, right: 6, width: 9, height: 9, borderRadius: 999, background: NIVEL_COLOR[e.nivel] ?? 'var(--os-muted)' }} />}
                </div>
                <p style={{ fontSize: 'var(--os-text-sm)', fontWeight: 700, color: 'var(--os-text)', margin: 0, lineHeight: 1.25 }}>{nombreEjercicio(e)}</p>
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  {chipsGrupo(e).slice(0, 2).map((g) => <span key={g} style={{ ...chip, fontSize: 11 }}>{g}</span>)}
                </div>
              </button>
            ))}
          </div>
          {total != null && offset + LIMIT < total && (
            <button style={btnGhost} disabled={loading} onClick={() => buscar(offset + LIMIT)}>{loading ? 'Cargando...' : 'Cargar más'}</button>
          )}
        </>
      }

      {detalle && <DetalleEjercicio ejercicio={detalle} onCerrar={() => setDetalle(null)} />}
    </div>
  );
}

function PanelChips({ items, valor, onElegir }: { items: TaxonomiaFila[]; valor: string; onElegir: (v: string) => void }) {
  return (
    <div style={{ ...card2, display: 'flex', gap: 6, flexWrap: 'wrap', maxHeight: 200, overflowY: 'auto' }}>
      {items.map((it) => (
        <button key={it.slug} style={pill(valor === it.slug)} onClick={() => onElegir(it.slug)}>{it.nombre_es}</button>
      ))}
      {!items.length && <p style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', margin: 0 }}>Sin opciones.</p>}
    </div>
  );
}

function DetalleEjercicio({ ejercicio, onCerrar }: { ejercicio: Ejercicio; onCerrar: () => void }) {
  const [agregando, setAgregando] = useState(false);
  return (
    <Sheet open onClose={onCerrar} title={nombreEjercicio(ejercicio)}>
      {(ejercicio.imagenes ?? []).length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          {(ejercicio.imagenes ?? []).slice(0, 2).map((src, i) => (
            <img key={i} src={src} alt="" loading="lazy" style={{ width: '50%', aspectRatio: '4/3', objectFit: 'cover', borderRadius: 12, border: '1px solid var(--os-line-soft)' }} />
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
        {chipsGrupo(ejercicio).map((g) => <span key={g} style={chip}>{g}</span>)}
      </div>
      {(ejercicio.instrucciones_en ?? []).length > 0 && (
        <ol style={{ fontSize: 'var(--os-text-sm)', color: 'var(--os-text-2)', lineHeight: 1.7, paddingLeft: 18, margin: '0 0 12px' }}>
          {(ejercicio.instrucciones_en ?? []).map((linea, i) => <li key={i}>{linea}</li>)}
        </ol>
      )}
      {agregando
        ? <PickerAgregar ejercicio={ejercicio} onListo={onCerrar} />
        : <button style={{ ...btn, width: '100%' }} onClick={() => setAgregando(true)}>Agregar a un día</button>}
    </Sheet>
  );
}

function PickerAgregar({ ejercicio, onListo }: { ejercicio: Ejercicio; onListo: () => void }) {
  const [rutinas, setRutinas] = useState<Rutina[]>([]);
  const [rutinaId, setRutinaId] = useState('');
  const [dias, setDias] = useState<Dia[]>([]);
  const [diaId, setDiaId] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [hecho, setHecho] = useState(false);

  useEffect(() => { fetch('/api/os/gfit/rutinas').then((r) => r.json()).then((d) => setRutinas(d.rutinas ?? [])); }, []);
  useEffect(() => {
    if (!rutinaId) { setDias([]); setDiaId(''); return; }
    fetch(`/api/os/gfit/dias?rutina_id=${rutinaId}`).then((r) => r.json()).then((d) => setDias(d.dias ?? []));
  }, [rutinaId]);

  async function confirmar() {
    if (!diaId) return;
    setGuardando(true);
    await fetch('/api/os/gfit/dia-ejercicios', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dia_id: diaId, ejercicio_id: ejercicio.id }),
    });
    setGuardando(false);
    setHecho(true);
    setTimeout(onListo, 900);
  }

  if (hecho) return <p style={{ fontSize: 'var(--os-text-sm)', color: 'var(--os-champagne)', fontWeight: 700, textAlign: 'center' }}>Agregado ✓</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <select style={sel} value={rutinaId} onChange={(e) => setRutinaId(e.target.value)}>
        <option value="">Elige una rutina...</option>
        {rutinas.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
      </select>
      <select style={sel} value={diaId} onChange={(e) => setDiaId(e.target.value)} disabled={!rutinaId}>
        <option value="">Elige un día...</option>
        {dias.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
      </select>
      <button style={btn} disabled={!diaId || guardando} onClick={confirmar}>{guardando ? 'Agregando...' : 'Confirmar'}</button>
    </div>
  );
}
