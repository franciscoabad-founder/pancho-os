import { useEffect, useState } from 'react';
import type { Dia, Rutina, TipoDia, UnidadPeso } from './tipos';
import { OBJETIVOS, WEEKDAY_CORTO, badgeDia, estimarMinutos } from './tipos';
import { card, card2, input, sel, btn, btnGhost, btnIcon, pill, thumb } from './estilos';
import { Spinner, EmptyState, useConfirm } from '../ui';
import OSGfitDia from './OSGfitDia';

interface Props {
  unidad: UnidadPeso;
  onUnidad: (u: UnidadPeso) => void;
}

type Vista = { tipo: 'lista' } | { tipo: 'rutina'; rutina: Rutina } | { tipo: 'dia'; rutina: Rutina; dia: Dia };

export default function OSGfitRutinas({ unidad, onUnidad }: Props) {
  const { confirm, sheet } = useConfirm();
  const [rutinas, setRutinas] = useState<Rutina[]>([]);
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState<Vista>({ tipo: 'lista' });
  const [nuevaAbierta, setNuevaAbierta] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [editando, setEditando] = useState<Rutina | null>(null);

  async function cargarRutinas() {
    setLoading(true);
    const res = await fetch('/api/os/gfit/rutinas');
    const data = await res.json();
    setRutinas(data.rutinas ?? []);
    setLoading(false);
  }
  useEffect(() => { cargarRutinas(); }, []);

  async function abrirRutina(r: Rutina) {
    setVista({ tipo: 'rutina', rutina: r });
  }

  async function archivar(id: string) {
    setMenuId(null);
    if (!(await confirm({
      title: 'Archivar rutina',
      text: 'Puedes verla luego en el historial de rutinas archivadas.',
      confirmLabel: 'Archivar',
      danger: true,
    }))) return;
    await fetch(`/api/os/gfit/rutinas?id=${id}`, { method: 'DELETE' });
    cargarRutinas();
  }

  if (vista.tipo === 'rutina') {
    return (
      <VistaDias
        rutina={vista.rutina}
        onVolver={() => { setVista({ tipo: 'lista' }); cargarRutinas(); }}
        onAbrirDia={(dia) => setVista({ tipo: 'dia', rutina: vista.rutina, dia })}
      />
    );
  }
  if (vista.tipo === 'dia') {
    return (
      <OSGfitDia
        dia={vista.dia}
        unidad={unidad}
        onDia={(dia) => setVista({ tipo: 'dia', rutina: vista.rutina, dia })}
        onVolver={() => setVista({ tipo: 'rutina', rutina: vista.rutina })}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <button style={btn} onClick={() => setNuevaAbierta(!nuevaAbierta)}>+ Nueva rutina</button>
        <div style={{ display: 'flex', gap: 2, background: 'var(--os-fill-subtle)', borderRadius: 'var(--os-r-full)', padding: 3 }}>
          <button style={pill(unidad === 'kg')} onClick={() => onUnidad('kg')}>kg</button>
          <button style={pill(unidad === 'lb')} onClick={() => onUnidad('lb')}>lb</button>
        </div>
      </div>

      {nuevaAbierta && (
        <FormRutina
          onCancelar={() => setNuevaAbierta(false)}
          onGuardado={() => { setNuevaAbierta(false); cargarRutinas(); }}
        />
      )}
      {editando && (
        <FormRutina
          rutina={editando}
          onCancelar={() => setEditando(null)}
          onGuardado={() => { setEditando(null); cargarRutinas(); }}
        />
      )}

      {loading ? <Spinner /> :
        !rutinas.length ? (
          <EmptyState
            icon="fitness_center"
            title="Sin rutinas todavía"
            text="Crea la primera para planificar tus días de entrenamiento."
            action={<button style={btn} onClick={() => setNuevaAbierta(true)}>+ Nueva rutina</button>}
          />
        ) :
        rutinas.map((r) => (
          <div key={r.id} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => abrirRutina(r)}>
                <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--os-text)', margin: 0 }}>{r.nombre}</p>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                  {r.objetivo && <span style={{ fontSize: 11, color: 'var(--os-accent-light)', background: 'rgba(59,78,217,0.12)', padding: '2px 8px', borderRadius: 999, fontFamily: 'var(--os-font-display)', fontWeight: 700 }}>
                    {OBJETIVOS.find((o) => o.key === r.objetivo)?.label ?? r.objetivo}
                  </span>}
                  <span style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)' }}>{r.dias?.[0]?.count ?? 0} días</span>
                </div>
                {r.descripcion && <p style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', margin: '5px 0 0' }}>{r.descripcion}</p>}
              </div>
              <button style={btnIcon} onClick={() => setMenuId(menuId === r.id ? null : r.id)} aria-label="Más opciones">
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>more_vert</span>
              </button>
            </div>
            {menuId === r.id && (
              <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                <button style={btnGhost} onClick={() => { setMenuId(null); setEditando(r); }}>Editar</button>
                <button style={{ ...btnGhost, color: 'var(--os-error)' }} onClick={() => archivar(r.id)}>Archivar</button>
              </div>
            )}
            <button style={{ ...btn, width: '100%', marginTop: 10 }} onClick={() => abrirRutina(r)}>Ver días</button>
          </div>
        ))
      }
      {sheet}
    </div>
  );
}

function FormRutina({ rutina, onCancelar, onGuardado }: { rutina?: Rutina; onCancelar: () => void; onGuardado: () => void }) {
  const [nombre, setNombre] = useState(rutina?.nombre ?? '');
  const [descripcion, setDescripcion] = useState(rutina?.descripcion ?? '');
  const [objetivo, setObjetivo] = useState(rutina?.objetivo ?? 'hipertrofia');
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    if (!nombre.trim()) return;
    setGuardando(true);
    const body = { nombre, descripcion, objetivo };
    const url = rutina ? `/api/os/gfit/rutinas?id=${rutina.id}` : '/api/os/gfit/rutinas';
    await fetch(url, { method: rutina ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setGuardando(false);
    onGuardado();
  }

  return (
    <div style={{ ...card2, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input style={input} placeholder="Nombre de la rutina *" value={nombre} onChange={(e) => setNombre(e.target.value)} />
      <select style={sel} value={objetivo} onChange={(e) => setObjetivo(e.target.value as typeof objetivo)}>
        {OBJETIVOS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
      </select>
      <input style={input} placeholder="Descripción (opcional)" value={descripcion ?? ''} onChange={(e) => setDescripcion(e.target.value)} />
      <div style={{ display: 'flex', gap: 6 }}>
        <button style={btn} disabled={guardando} onClick={guardar}>{guardando ? 'Guardando...' : 'Guardar'}</button>
        <button style={btnGhost} onClick={onCancelar}>Cancelar</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Lista de días de una rutina
// ═══════════════════════════════════════════════════════════════════════════
function VistaDias({ rutina, onVolver, onAbrirDia }: { rutina: Rutina; onVolver: () => void; onAbrirDia: (dia: Dia) => void }) {
  const { confirm, sheet } = useConfirm();
  const [dias, setDias] = useState<Dia[]>([]);
  const [loading, setLoading] = useState(true);
  const [nuevoAbierto, setNuevoAbierto] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);

  async function cargar() {
    setLoading(true);
    const res = await fetch(`/api/os/gfit/dias?rutina_id=${rutina.id}`);
    const data = await res.json();
    setDias(data.dias ?? []);
    setLoading(false);
  }
  useEffect(() => { cargar(); }, [rutina.id]);

  async function copiarDia(id: string) {
    setMenuId(null);
    await fetch('/api/os/gfit/dias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ copiar_de: id }) });
    cargar();
  }
  async function eliminarDia(id: string) {
    setMenuId(null);
    if (!(await confirm({
      title: 'Eliminar dia',
      text: 'Se elimina este dia y todos sus ejercicios. Esta accion no se puede deshacer.',
      confirmLabel: 'Eliminar',
      danger: true,
    }))) return;
    await fetch(`/api/os/gfit/dias?id=${id}`, { method: 'DELETE' });
    cargar();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--os-text)', margin: 0 }}>{rutina.nombre}</p>
          <p style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', margin: '2px 0 0' }}>{dias.length} días</p>
        </div>
        <button style={btnGhost} onClick={onVolver}>← Rutinas</button>
      </div>

      <button style={btn} onClick={() => setNuevoAbierto(!nuevoAbierto)}>+ Agregar día</button>
      {nuevoAbierto && <FormDia rutinaId={rutina.id} onCancelar={() => setNuevoAbierto(false)} onGuardado={() => { setNuevoAbierto(false); cargar(); }} />}

      {loading ? <Spinner /> :
        !dias.length ? (
          <EmptyState
            icon="calendar_month"
            title="Sin días todavía"
            text="Agrega el primer día de esta rutina."
            action={<button style={btn} onClick={() => setNuevoAbierto(true)}>+ Agregar día</button>}
          />
        ) :
        dias.map((d) => {
          const badge = badgeDia(d);
          const n = d.gfit_dia_ejercicios?.length ?? 0;
          const fotos = (d.gfit_dia_ejercicios ?? []).slice(0, 3).map((de) => de.ejercicio?.imagenes?.[0]).filter(Boolean) as string[];
          return (
            <div key={d.id} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => onAbrirDia(d)}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{
                      fontSize: 11, fontFamily: 'var(--os-font-display)', fontWeight: 800, letterSpacing: '0.06em',
                      padding: '3px 8px', borderRadius: 999,
                      background: badge.tono === 'accent' ? 'rgba(59,78,217,0.14)' : 'var(--os-fill-subtle)',
                      color: badge.tono === 'accent' ? 'var(--os-accent-light)' : 'var(--os-muted)',
                    }}>{badge.texto}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--os-text)' }}>{d.nombre}</span>
                  </div>
                  {d.tipo !== 'descanso' && (
                    <p style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', margin: '5px 0 0' }}>
                      {n} ejercicio{n === 1 ? '' : 's'} · ~{estimarMinutos(d)} min
                    </p>
                  )}
                  {fotos.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                      {fotos.map((src, i) => <img key={i} src={src} alt="" loading="lazy" style={thumb(34)} />)}
                    </div>
                  )}
                </div>
                <button style={btnIcon} onClick={() => setMenuId(menuId === d.id ? null : d.id)} aria-label="Más opciones">
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>more_vert</span>
                </button>
              </div>
              {menuId === d.id && (
                <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  <button style={btnGhost} onClick={() => onAbrirDia(d)}>Editar ejercicios</button>
                  <button style={btnGhost} onClick={() => copiarDia(d.id)}>Copiar día</button>
                  <button style={{ ...btnGhost, color: 'var(--os-error)' }} onClick={() => eliminarDia(d.id)}>Eliminar</button>
                </div>
              )}
            </div>
          );
        })
      }
      {sheet}
    </div>
  );
}

function FormDia({ rutinaId, onCancelar, onGuardado }: { rutinaId: string; onCancelar: () => void; onGuardado: () => void }) {
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<TipoDia>('weekday');
  const [weekday, setWeekday] = useState(1);
  const [orden, setOrden] = useState(1);
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    if (!nombre.trim()) return;
    setGuardando(true);
    const body: Record<string, unknown> = { rutina_id: rutinaId, nombre, tipo };
    if (tipo === 'weekday') body.weekday = weekday;
    if (tipo === 'orden') body.orden = orden - 1;
    await fetch('/api/os/gfit/dias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setGuardando(false);
    onGuardado();
  }

  return (
    <div style={{ ...card2, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input style={input} placeholder="Nombre del día (ej. Empuje, Piernas)" value={nombre} onChange={(e) => setNombre(e.target.value)} />
      <div className="os-hscroll" style={{ display: 'flex', gap: 6 }}>
        <button style={pill(tipo === 'weekday')} onClick={() => setTipo('weekday')}>Día de la semana</button>
        <button style={pill(tipo === 'orden')} onClick={() => setTipo('orden')}>Número</button>
        <button style={pill(tipo === 'descanso')} onClick={() => setTipo('descanso')}>Descanso</button>
      </div>
      {tipo === 'weekday' && (
        <div style={{ display: 'flex', gap: 5 }}>
          {[1, 2, 3, 4, 5, 6, 7].map((wd) => (
            <button key={wd} style={{ ...pill(weekday === wd), flex: 1, padding: '8px 0' }} onClick={() => setWeekday(wd)}>{WEEKDAY_CORTO[wd]}</button>
          ))}
        </div>
      )}
      {tipo === 'orden' && (
        <input style={input} type="number" min={1} placeholder="Número de día" value={orden} onChange={(e) => setOrden(Number(e.target.value) || 1)} />
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        <button style={btn} disabled={guardando} onClick={guardar}>{guardando ? 'Guardando...' : 'Guardar día'}</button>
        <button style={btnGhost} onClick={onCancelar}>Cancelar</button>
      </div>
    </div>
  );
}
