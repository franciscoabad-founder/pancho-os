import { useEffect, useRef, useState } from 'react';
import { Button, Spinner, EmptyState, useConfirm } from '../ui';
import { sugerenciaOverload, ajusteRecuperacion, type SetHist } from '../../../lib/salud/progresion';

// ── Tipos ──────────────────────────────────────────────────────────────────
interface Ejercicio {
  id: string; nombre: string; nombre_en: string | null;
  grupo_muscular_primario: string | null; patron: string | null;
  equipamiento: string | null; instrucciones: string | null; secundarios: string[]; fuente: string;
}
interface SetPlan {
  tipo: string; reps_min?: number; reps_max?: number;
  peso_objetivo?: number; descanso_seg?: number; superset_con?: string | null;
}
interface RutinaEjercicio {
  id: string; ejercicio_id: string; orden: number; sets_plan: SetPlan[];
  ejercicio: Ejercicio;
}
interface Rutina {
  id: string; nombre: string; descripcion: string | null; dias: string[];
  rutina_ejercicios: RutinaEjercicio[];
}
// Set en curso durante la sesión.
interface SetVivo {
  key: string; ejercicio_id: string; ejercicio_nombre: string; orden: number;
  tipo_set: string; reps_objetivo: string; reps_min: number; reps_max: number;
  patron: string | null; peso_objetivo: number; descanso_seg: number;
  reps: string; peso_kg: string; rpe: string; completado: boolean; sugerencia?: string | null;
}

const GRUPOS = ['Pecho', 'Espalda', 'Piernas', 'Hombros', 'Brazos', 'Core', 'Pantorrillas'];
const PATRONES = [
  { key: 'push_h', label: 'Empuje horizontal' }, { key: 'push_v', label: 'Empuje vertical' },
  { key: 'pull_h', label: 'Jalón horizontal' }, { key: 'pull_v', label: 'Jalón vertical' },
  { key: 'squat', label: 'Sentadilla' }, { key: 'hinge', label: 'Bisagra' },
  { key: 'core', label: 'Core' }, { key: 'otro', label: 'Otro' },
];
const TIPOS_SET = ['warmup', 'working', 'dropset', 'superset', 'amrap', 'failure'];
const TIPO_SET_LABEL: Record<string, string> = {
  warmup: 'Calent.', working: 'Working', dropset: 'Dropset', superset: 'Superset', amrap: 'AMRAP', failure: 'Fallo',
};

// ── Estilos ──────────────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: 'var(--os-surface-2)', border: '1px solid var(--os-line-soft)',
  borderRadius: 'var(--os-r-card)', padding: '1rem',
};
const input: React.CSSProperties = {
  background: 'var(--os-fill-subtle)', border: '1px solid var(--os-line)', borderRadius: 'var(--os-r-sm)',
  padding: '7px 10px', fontSize: 'var(--os-text-sm)', color: 'var(--os-text)', fontFamily: 'var(--os-font-body)', outline: 'none', width: '100%', minHeight: 40,
};
const sel: React.CSSProperties = { ...input, background: 'var(--os-surface)' };
const btn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  background: 'var(--os-accent)', color: '#fff', border: 'none', borderRadius: 'var(--os-r-sm)',
  padding: '9px 16px', minHeight: 44, fontSize: 'var(--os-text-sm)', fontFamily: 'var(--os-font-display)', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
};
const btnGhost: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  background: 'transparent', color: 'var(--os-muted)', border: '1px solid var(--os-line)',
  borderRadius: 'var(--os-r-sm)', padding: '7px 12px', minHeight: 40, fontSize: 'var(--os-text-xs)', cursor: 'pointer',
};
const tab = (activo: boolean): React.CSSProperties => ({
  ...btnGhost, ...(activo ? { color: '#fff', background: 'var(--os-accent)', borderColor: 'var(--os-accent)' } : {}),
});

export default function OSSaludEntrenamiento() {
  const [vista, setVista] = useState<'rutinas' | 'biblioteca' | 'historial'>('rutinas');
  const [sesion, setSesion] = useState<SetVivo[] | null>(null);
  const [sesionMeta, setSesionMeta] = useState<{ rutinaId: string | null; nombre: string; inicio: number } | null>(null);

  if (sesion && sesionMeta) {
    return <ModoSesion sets={sesion} setSets={setSesion} meta={sesionMeta}
      onSalir={() => { setSesion(null); setSesionMeta(null); }} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="os-hscroll" style={{ display: 'flex', gap: 6 }}>
        <button style={tab(vista === 'rutinas')} onClick={() => setVista('rutinas')}>Rutinas</button>
        <button style={tab(vista === 'biblioteca')} onClick={() => setVista('biblioteca')}>Biblioteca</button>
        <button style={tab(vista === 'historial')} onClick={() => setVista('historial')}>Historial</button>
      </div>
      {vista === 'rutinas' && <Rutinas onIniciar={(sets, meta) => { setSesion(sets); setSesionMeta(meta); }} />}
      {vista === 'biblioteca' && <Biblioteca />}
      {vista === 'historial' && <Historial />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// BIBLIOTECA de ejercicios
// ═══════════════════════════════════════════════════════════════════════════
function Biblioteca() {
  const [ejercicios, setEjercicios] = useState<Ejercicio[]>([]);
  const [q, setQ] = useState('');
  const [grupo, setGrupo] = useState('');
  const [patron, setPatron] = useState('');
  const [loading, setLoading] = useState(true);
  const [alta, setAlta] = useState(false);
  const [nuevo, setNuevo] = useState({ nombre: '', grupo_muscular_primario: '', patron: '', equipamiento: '', instrucciones: '' });

  async function cargar() {
    setLoading(true);
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (grupo) params.set('grupo', grupo);
    if (patron) params.set('patron', patron);
    const res = await fetch(`/api/os/salud/ejercicios?${params}`);
    const data = await res.json();
    setEjercicios(data.ejercicios ?? []);
    setLoading(false);
  }
  useEffect(() => { const t = setTimeout(cargar, 250); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [q, grupo, patron]);

  async function crear() {
    if (!nuevo.nombre.trim()) return;
    await fetch('/api/os/salud/ejercicios', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(nuevo),
    });
    setNuevo({ nombre: '', grupo_muscular_primario: '', patron: '', equipamiento: '', instrucciones: '' });
    setAlta(false); cargar();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <input style={input} placeholder="Buscar ejercicio..." value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="os-hscroll" style={{ display: 'flex', gap: 6 }}>
        <select style={{ ...sel, width: 'auto' }} value={grupo} onChange={(e) => setGrupo(e.target.value)}>
          <option value="">Todo grupo</option>
          {GRUPOS.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select style={{ ...sel, width: 'auto' }} value={patron} onChange={(e) => setPatron(e.target.value)}>
          <option value="">Todo patrón</option>
          {PATRONES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
        <button style={btnGhost} onClick={() => setAlta(!alta)}>{alta ? 'Cerrar' : '+ Manual'}</button>
      </div>

      {alta && (
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input style={input} placeholder="Nombre *" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <select style={{ ...sel, flex: 1 }} value={nuevo.grupo_muscular_primario} onChange={(e) => setNuevo({ ...nuevo, grupo_muscular_primario: e.target.value })}>
              <option value="">Grupo</option>{GRUPOS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            <select style={{ ...sel, flex: 1 }} value={nuevo.patron} onChange={(e) => setNuevo({ ...nuevo, patron: e.target.value })}>
              <option value="">Patrón</option>{PATRONES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </div>
          <input style={input} placeholder="Equipamiento" value={nuevo.equipamiento} onChange={(e) => setNuevo({ ...nuevo, equipamiento: e.target.value })} />
          <button style={btn} onClick={crear}>Guardar ejercicio</button>
        </div>
      )}

      {loading ? <Spinner /> :
        ejercicios.length === 0 ? (
          <EmptyState
            icon="fitness_center"
            title="Sin ejercicios"
            text="Corre el seed de wger o agrega uno manual."
            action={<Button size="sm" onClick={() => setAlta(true)}>+ Manual</Button>}
          />
        ) :
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {ejercicios.map((e) => (
            <div key={e.id} style={{ ...card, padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 'var(--os-text-base)', fontWeight: 600, color: 'var(--os-text)' }}>{e.nombre}</span>
                {e.patron && <span style={{ fontSize: 11, fontFamily: 'var(--os-font-display)', color: 'var(--os-accent-light)', background: 'rgba(59,78,217,0.15)', padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>{PATRONES.find((p) => p.key === e.patron)?.label ?? e.patron}</span>}
              </div>
              <p style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', margin: '3px 0 0' }}>
                {[e.grupo_muscular_primario, e.equipamiento].filter(Boolean).join(' · ')}
              </p>
            </div>
          ))}
        </div>
      }
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// RUTINAS: lista + constructor
// ═══════════════════════════════════════════════════════════════════════════
function Rutinas({ onIniciar }: { onIniciar: (sets: SetVivo[], meta: { rutinaId: string | null; nombre: string; inicio: number }) => void }) {
  const [rutinas, setRutinas] = useState<Rutina[]>([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<Rutina | 'nueva' | null>(null);

  async function cargar() {
    setLoading(true);
    const res = await fetch('/api/os/salud/rutinas');
    const data = await res.json();
    setRutinas(data.rutinas ?? []);
    setLoading(false);
  }
  useEffect(() => { cargar(); }, []);

  function iniciarSesion(r: Rutina) {
    const sets: SetVivo[] = [];
    const ejs = [...r.rutina_ejercicios].sort((a, b) => a.orden - b.orden);
    ejs.forEach((re) => {
      (re.sets_plan ?? []).forEach((sp, i) => {
        sets.push({
          key: `${re.id}-${i}`, ejercicio_id: re.ejercicio_id, ejercicio_nombre: re.ejercicio?.nombre ?? 'Ejercicio',
          orden: sets.length, tipo_set: sp.tipo || 'working',
          reps_objetivo: sp.reps_min != null && sp.reps_max != null ? `${sp.reps_min}-${sp.reps_max}` : (sp.reps_min != null ? `${sp.reps_min}` : ''),
          reps_min: sp.reps_min ?? 0, reps_max: sp.reps_max ?? (sp.reps_min ?? 0),
          patron: re.ejercicio?.patron ?? null,
          peso_objetivo: sp.peso_objetivo ?? 0, descanso_seg: sp.descanso_seg ?? 90,
          reps: '', peso_kg: sp.peso_objetivo ? String(sp.peso_objetivo) : '', rpe: '', completado: false,
        });
      });
    });
    onIniciar(sets, { rutinaId: r.id, nombre: r.nombre, inicio: Date.now() });
  }

  if (editor) return <ConstructorRutina rutina={editor === 'nueva' ? null : editor} onCerrar={() => { setEditor(null); cargar(); }} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button style={btn} onClick={() => setEditor('nueva')}>+ Nueva rutina</button>
        <SesionRapida onCreada={cargar} />
      </div>
      {loading ? <Spinner /> :
        rutinas.length === 0 ? (
          <EmptyState
            icon="assignment"
            title="Sin rutinas"
            text='Crea una o corre el seed "Full Body Casa".'
            action={<Button size="sm" onClick={() => setEditor('nueva')}>+ Nueva rutina</Button>}
          />
        ) :
        rutinas.map((r) => (
          <div key={r.id} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--os-text)', margin: 0 }}>{r.nombre}</p>
                {r.descripcion && <p style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', margin: '2px 0 0' }}>{r.descripcion}</p>}
                <p style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', margin: '6px 0 0' }}>
                  {r.rutina_ejercicios?.length ?? 0} ejercicios
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              <button style={btn} onClick={() => iniciarSesion(r)}>▶ Iniciar sesión</button>
              <button style={btnGhost} onClick={() => setEditor(r)}>Editar</button>
            </div>
          </div>
        ))
      }
    </div>
  );
}

// Alta rápida de sesión no-gym (caminata/cardio/estiramiento/movilidad).
function SesionRapida({ onCreada }: { onCreada: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [tipo, setTipo] = useState('caminata');
  const [dur, setDur] = useState('');
  const [guardando, setGuardando] = useState(false);
  async function guardar() {
    setGuardando(true);
    await fetch('/api/os/salud/sesiones', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, duracion_min: dur || null }),
    });
    setGuardando(false); setAbierto(false); setDur(''); onCreada();
  }
  if (!abierto) return <button style={btnGhost} onClick={() => setAbierto(true)}>+ Sesión rápida</button>;
  return (
    <div style={{ ...card, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
      <select style={{ ...sel, width: 'auto' }} value={tipo} onChange={(e) => setTipo(e.target.value)}>
        <option value="caminata">Caminata</option><option value="cardio">Cardio</option>
        <option value="movilidad">Movilidad</option><option value="estiramiento">Estiramiento</option>
      </select>
      <input style={{ ...input, width: 90 }} type="number" placeholder="min" value={dur} onChange={(e) => setDur(e.target.value)} />
      <button style={btn} disabled={guardando} onClick={guardar}>Guardar</button>
      <button style={btnGhost} onClick={() => setAbierto(false)}>Cancelar</button>
    </div>
  );
}

// Constructor de rutinas: agrega ejercicios, ordena, define sets tipados.
function ConstructorRutina({ rutina, onCerrar }: { rutina: Rutina | null; onCerrar: () => void }) {
  const { confirm, sheet } = useConfirm();
  const [nombre, setNombre] = useState(rutina?.nombre ?? '');
  const [descripcion, setDescripcion] = useState(rutina?.descripcion ?? '');
  const [items, setItems] = useState<RutinaEjercicio[]>(rutina ? [...rutina.rutina_ejercicios].sort((a, b) => a.orden - b.orden) : []);
  const [buscador, setBuscador] = useState('');
  const [resultados, setResultados] = useState<Ejercicio[]>([]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!buscador.trim()) { setResultados([]); return; }
      const res = await fetch(`/api/os/salud/ejercicios?q=${encodeURIComponent(buscador.trim())}`);
      const data = await res.json();
      setResultados((data.ejercicios ?? []).slice(0, 12));
    }, 250);
    return () => clearTimeout(t);
  }, [buscador]);

  function agregarEjercicio(e: Ejercicio) {
    setItems([...items, {
      id: `tmp-${Date.now()}`, ejercicio_id: e.id, orden: items.length, ejercicio: e,
      sets_plan: [{ tipo: 'working', reps_min: 8, reps_max: 12, peso_objetivo: 0, descanso_seg: 90 }],
    }]);
    setBuscador(''); setResultados([]);
  }
  function mover(i: number, dir: number) {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const copia = [...items];
    [copia[i], copia[j]] = [copia[j], copia[i]];
    setItems(copia.map((it, idx) => ({ ...it, orden: idx })));
  }
  function quitar(i: number) { setItems(items.filter((_, idx) => idx !== i).map((it, idx) => ({ ...it, orden: idx }))); }
  function setSets(i: number, sets: SetPlan[]) { setItems(items.map((it, idx) => idx === i ? { ...it, sets_plan: sets } : it)); }
  function addSet(i: number) { const it = items[i]; setSets(i, [...it.sets_plan, { tipo: 'working', reps_min: 8, reps_max: 12, peso_objetivo: 0, descanso_seg: 90 }]); }

  async function guardar() {
    if (!nombre.trim()) return;
    setGuardando(true);
    const body = {
      nombre, descripcion,
      ejercicios: items.map((it, idx) => ({ ejercicio_id: it.ejercicio_id, orden: idx, sets_plan: it.sets_plan })),
    };
    const url = rutina ? `/api/os/salud/rutinas?id=${rutina.id}` : '/api/os/salud/rutinas';
    await fetch(url, { method: rutina ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setGuardando(false); onCerrar();
  }

  async function borrarRutina() {
    if (!rutina) return;
    if (!(await confirm({
      title: 'Borrar rutina',
      text: 'Esta accion no se puede deshacer.',
      confirmLabel: 'Borrar',
      danger: true,
    }))) return;
    await fetch(`/api/os/salud/rutinas?id=${rutina.id}`, { method: 'DELETE' });
    onCerrar();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--os-text)' }}>{rutina ? 'Editar rutina' : 'Nueva rutina'}</span>
        <button style={btnGhost} onClick={onCerrar}>← Volver</button>
      </div>
      <input style={input} placeholder="Nombre de la rutina *" value={nombre} onChange={(e) => setNombre(e.target.value)} />
      <input style={input} placeholder="Descripción" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />

      {items.map((it, i) => (
        <div key={it.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--os-text)' }}>{i + 1}. {it.ejercicio?.nombre}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button style={{ ...btnGhost, padding: '4px 8px' }} onClick={() => mover(i, -1)}>↑</button>
              <button style={{ ...btnGhost, padding: '4px 8px' }} onClick={() => mover(i, 1)}>↓</button>
              <button style={{ ...btnGhost, padding: '4px 8px' }} onClick={() => quitar(i)}>✕</button>
            </div>
          </div>
          {it.sets_plan.map((s, si) => (
            <div key={si} style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 5, flexWrap: 'wrap' }}>
              <select style={{ ...sel, width: 'auto', padding: '4px 6px', fontSize: 11 }} value={s.tipo} onChange={(e) => setSets(i, it.sets_plan.map((x, xi) => xi === si ? { ...x, tipo: e.target.value } : x))}>
                {TIPOS_SET.map((t) => <option key={t} value={t}>{TIPO_SET_LABEL[t]}</option>)}
              </select>
              <input style={{ ...input, width: 52, padding: '4px 6px' }} type="number" placeholder="min" value={s.reps_min ?? ''} onChange={(e) => setSets(i, it.sets_plan.map((x, xi) => xi === si ? { ...x, reps_min: Number(e.target.value) } : x))} />
              <span style={{ color: 'var(--os-muted)', fontSize: 12 }}>-</span>
              <input style={{ ...input, width: 52, padding: '4px 6px' }} type="number" placeholder="max" value={s.reps_max ?? ''} onChange={(e) => setSets(i, it.sets_plan.map((x, xi) => xi === si ? { ...x, reps_max: Number(e.target.value) } : x))} />
              <span style={{ color: 'var(--os-muted)', fontSize: 11 }}>reps</span>
              <input style={{ ...input, width: 60, padding: '4px 6px' }} type="number" placeholder="kg" value={s.peso_objetivo ?? ''} onChange={(e) => setSets(i, it.sets_plan.map((x, xi) => xi === si ? { ...x, peso_objetivo: Number(e.target.value) } : x))} />
              <input style={{ ...input, width: 58, padding: '4px 6px' }} type="number" placeholder="desc" value={s.descanso_seg ?? ''} onChange={(e) => setSets(i, it.sets_plan.map((x, xi) => xi === si ? { ...x, descanso_seg: Number(e.target.value) } : x))} />
              <span style={{ color: 'var(--os-muted)', fontSize: 11 }}>s</span>
              {it.sets_plan.length > 1 && <button style={{ ...btnGhost, padding: '2px 7px' }} onClick={() => setSets(i, it.sets_plan.filter((_, xi) => xi !== si))}>✕</button>}
            </div>
          ))}
          <button style={{ ...btnGhost, marginTop: 4 }} onClick={() => addSet(i)}>+ set</button>
        </div>
      ))}

      <div style={card}>
        <input style={input} placeholder="Agregar ejercicio (buscar)..." value={buscador} onChange={(e) => setBuscador(e.target.value)} />
        {resultados.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
            {resultados.map((e) => (
              <button key={e.id} style={{ ...btnGhost, textAlign: 'left' }} onClick={() => agregarEjercicio(e)}>{e.nombre}</button>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <button style={btn} disabled={guardando} onClick={guardar}>{guardando ? 'Guardando...' : 'Guardar rutina'}</button>
        {rutina && <Button variant="danger" onClick={borrarRutina}>Borrar</Button>}
      </div>
      {sheet}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MODO SESIÓN ACTIVA (mobile-first, set por set + timer de descanso)
// ═══════════════════════════════════════════════════════════════════════════
function ModoSesion({ sets, setSets, meta, onSalir }: {
  sets: SetVivo[]; setSets: (s: SetVivo[]) => void;
  meta: { rutinaId: string | null; nombre: string; inicio: number }; onSalir: () => void;
}) {
  const { confirm, sheet } = useConfirm();
  const [idx, setIdx] = useState(0);
  const [descanso, setDescanso] = useState(0); // segundos restantes
  const [terminar, setTerminar] = useState(false);
  const [rpeGlobal, setRpeGlobal] = useState('');
  const [notas, setNotas] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [sugerencias, setSugerencias] = useState<Record<string, string>>({});
  const [avisoRecup, setAvisoRecup] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const actual = sets[idx];

  // Sugerencias de peso del motor de progresión (M5), computadas localmente con la
  // lib testeada a partir del historial de sets del endpoint de progreso.
  useEffect(() => {
    fetch('/api/os/salud/progreso')
      .then((r) => r.json())
      .then((d) => {
        // Regla de recuperación: usa el sueño más reciente registrado en cuerpo_log.
        const cuerpo = (d.cuerpo ?? []) as Array<{ fecha: string; sueno_horas: number | null }>;
        const conSueno = cuerpo.filter((c) => c.sueno_horas != null).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
        if (conSueno.length) {
          const aj = ajusteRecuperacion(conSueno[0].sueno_horas);
          if (aj.aviso) setAvisoRecup(aj.aviso);
        }
        if (!d.sets) return;
        const porEjercicio: Record<string, SetHist[]> = {};
        for (const s of d.sets as any[]) {
          (porEjercicio[s.ejercicio_id] ??= []).push({
            fecha: s.fecha, reps: s.reps, peso_kg: s.peso_kg, tipo_set: s.tipo_set,
          });
        }
        const textos: Record<string, string> = {};
        const vistos = new Set<string>();
        for (const sv of sets) {
          if (vistos.has(sv.ejercicio_id)) continue;
          vistos.add(sv.ejercicio_id);
          const hist = porEjercicio[sv.ejercicio_id] ?? [];
          const sug = sugerenciaOverload(hist, { repsMin: sv.reps_min, repsMax: sv.reps_max, patron: sv.patron });
          if (sug.accion !== 'mantener' && sug.pesoSugerido != null) {
            textos[sv.ejercicio_id] = `${sug.pesoSugerido} kg — ${sug.razon}`;
          }
        }
        setSugerencias(textos);
      })
      .catch(() => { /* motor opcional */ });
  }, []);

  // Timer de descanso (cuenta regresiva).
  useEffect(() => {
    if (descanso <= 0) { if (timerRef.current) clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(() => setDescanso((d) => (d <= 1 ? 0 : d - 1)), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [descanso > 0]);

  // Vibración al terminar el descanso (si el navegador lo permite).
  useEffect(() => {
    if (descanso === 0 && timerRef.current) {
      if (navigator.vibrate) navigator.vibrate(200);
    }
  }, [descanso]);

  function actualizar(campo: keyof SetVivo, valor: string | boolean) {
    setSets(sets.map((s, i) => i === idx ? { ...s, [campo]: valor } : s));
  }

  function completarSet() {
    const nuevo = sets.map((s, i) => i === idx ? { ...s, completado: true } : s);
    setSets(nuevo);
    if (actual.descanso_seg > 0 && idx < sets.length - 1) setDescanso(actual.descanso_seg);
    if (idx < sets.length - 1) setIdx(idx + 1);
    else setTerminar(true);
  }

  async function guardarSesion() {
    setGuardando(true);
    const dur = Math.round((Date.now() - meta.inicio) / 60000);
    const body = {
      rutina_id: meta.rutinaId, tipo: 'gym', duracion_min: dur,
      rpe_sesion: rpeGlobal || null, notas: notas || null,
      inicio: new Date(meta.inicio).toISOString(), fin: new Date().toISOString(),
      sets: sets.map((s, i) => ({
        ejercicio_id: s.ejercicio_id, orden: i, tipo_set: s.tipo_set,
        reps: s.reps || null, peso_kg: s.peso_kg || null, rpe: s.rpe || null, completado: s.completado,
      })),
    };
    await fetch('/api/os/salud/sesiones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setGuardando(false);
    onSalir();
  }

  const completados = sets.filter((s) => s.completado).length;
  const pct = Math.round((completados / sets.length) * 100);

  if (terminar) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 480, margin: '0 auto' }}>
        <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--os-text)', margin: 0 }}>Terminar sesión</p>
        <p style={{ fontSize: 'var(--os-text-sm)', color: 'var(--os-muted)', margin: 0 }}>{completados} de {sets.length} sets completados · {meta.nombre}</p>
        <label style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)' }}>RPE global (1-10)
          <input style={{ ...input, marginTop: 4 }} type="number" min="1" max="10" value={rpeGlobal} onChange={(e) => setRpeGlobal(e.target.value)} />
        </label>
        <label style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)' }}>Notas
          <textarea style={{ ...input, marginTop: 4, minHeight: 70, resize: 'vertical' }} value={notas} onChange={(e) => setNotas(e.target.value)} />
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={btn} disabled={guardando} onClick={guardarSesion}>{guardando ? 'Guardando...' : 'Guardar sesión'}</button>
          <button style={btnGhost} onClick={() => setTerminar(false)}>← Seguir</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 480, margin: '0 auto' }}>
      {/* Barra de progreso */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button style={btnGhost} onClick={async () => {
          if (await confirm({
            title: 'Salir sin guardar',
            text: 'Se pierde el progreso de esta sesion.',
            confirmLabel: 'Salir',
            danger: true,
          })) onSalir();
        }}>✕</button>
        <div style={{ flex: 1, height: 6, background: 'var(--os-fill-subtle)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--os-accent)', borderRadius: 3, transition: 'width .3s' }} />
        </div>
        <span style={{ fontSize: 'var(--os-text-xs)', fontFamily: 'var(--os-font-mono)', color: 'var(--os-muted)' }}>{idx + 1}/{sets.length}</span>
      </div>

      {/* Aviso de recuperación (regla de sueño) */}
      {avisoRecup && (
        <div style={{ ...card, borderColor: 'color-mix(in srgb, var(--os-warn) 35%, transparent)', background: 'color-mix(in srgb, var(--os-warn) 10%, var(--os-surface-2))', padding: '10px 12px' }}>
          <p style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-warn)', margin: 0 }}>😴 {avisoRecup}</p>
        </div>
      )}

      {/* Timer de descanso */}
      {descanso > 0 && (
        <div style={{ ...card, textAlign: 'center', background: 'rgba(59,78,217,0.14)', borderColor: 'var(--os-line-accent)' }}>
          <p style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-accent-light)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Descanso</p>
          <p style={{ fontSize: 40, fontFamily: 'var(--os-font-mono)', fontWeight: 700, margin: '4px 0', color: 'var(--os-text)' }}>
            {Math.floor(descanso / 60)}:{String(descanso % 60).padStart(2, '0')}
          </p>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
            <button style={btnGhost} onClick={() => setDescanso((d) => d + 15)}>+15s</button>
            <button style={btnGhost} onClick={() => setDescanso(0)}>Saltar</button>
          </div>
        </div>
      )}

      {/* Set actual */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--os-text)' }}>{actual.ejercicio_nombre}</span>
          <span style={{ fontSize: 11, fontFamily: 'var(--os-font-display)', color: 'var(--os-accent-light)', background: 'rgba(59,78,217,0.15)', padding: '3px 9px', borderRadius: 999 }}>{TIPO_SET_LABEL[actual.tipo_set]}</span>
        </div>
        <p style={{ fontSize: 'var(--os-text-sm)', color: 'var(--os-text-2)', margin: '0 0 4px' }}>
          Objetivo: <b>{actual.reps_objetivo || '-'} reps</b>{actual.peso_objetivo ? ` × ${actual.peso_objetivo} kg` : ''}
        </p>
        {sugerencias[actual.ejercicio_id] && (
          <p style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-champagne)', margin: '0 0 10px' }}>
            💡 {sugerencias[actual.ejercicio_id]}
          </p>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 8 }}>
          <label style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)' }}>Reps
            <input style={{ ...input, marginTop: 3, fontSize: 16, textAlign: 'center' }} type="number" inputMode="numeric" value={actual.reps} onChange={(e) => actualizar('reps', e.target.value)} />
          </label>
          <label style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)' }}>Peso (kg)
            <input style={{ ...input, marginTop: 3, fontSize: 16, textAlign: 'center' }} type="number" inputMode="decimal" value={actual.peso_kg} onChange={(e) => actualizar('peso_kg', e.target.value)} />
          </label>
          <label style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)' }}>RPE
            <input style={{ ...input, marginTop: 3, fontSize: 16, textAlign: 'center' }} type="number" inputMode="numeric" min="1" max="10" value={actual.rpe} onChange={(e) => actualizar('rpe', e.target.value)} />
          </label>
        </div>

        <button style={{ ...btn, width: '100%', marginTop: 14, padding: '12px' }} onClick={completarSet}>
          {idx < sets.length - 1 ? 'Completar set ✓' : 'Completar y terminar'}
        </button>
      </div>

      {/* Navegación entre sets */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}>
        <button style={btnGhost} disabled={idx === 0} onClick={() => setIdx(idx - 1)}>← Anterior</button>
        <button style={btnGhost} onClick={() => setTerminar(true)}>Terminar sesión</button>
        <button style={btnGhost} disabled={idx >= sets.length - 1} onClick={() => setIdx(idx + 1)}>Saltar →</button>
      </div>
      {sheet}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// HISTORIAL de sesiones
// ═══════════════════════════════════════════════════════════════════════════
function Historial() {
  const [sesiones, setSesiones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch('/api/os/salud/sesiones?limit=50').then((r) => r.json()).then((d) => { setSesiones(d.sesiones ?? []); setLoading(false); });
  }, []);
  if (loading) return <Spinner />;
  if (!sesiones.length) return <EmptyState icon="history" title="Sin sesiones registradas" text="Inicia una rutina o registra una sesión rápida." />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {sesiones.map((s) => (
        <div key={s.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 'var(--os-text-base)', fontWeight: 600, color: 'var(--os-text)', textTransform: 'capitalize' }}>{s.tipo}</span>
            <span style={{ fontSize: 'var(--os-text-xs)', fontFamily: 'var(--os-font-mono)', color: 'var(--os-muted)' }}>
              {new Date(s.fecha + 'T12:00:00').toLocaleDateString('es-EC', { day: 'numeric', month: 'short' })}
            </span>
          </div>
          <p style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', margin: '4px 0 0' }}>
            {s.sets_log?.length ? `${s.sets_log.length} sets` : ''}{s.duracion_min ? ` · ${s.duracion_min} min` : ''}{s.rpe_sesion ? ` · RPE ${s.rpe_sesion}` : ''}
          </p>
        </div>
      ))}
    </div>
  );
}
