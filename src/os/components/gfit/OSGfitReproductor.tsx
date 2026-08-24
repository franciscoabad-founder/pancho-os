import { useEffect, useRef, useState } from 'react';
import type { Dia, UnidadPeso } from './tipos';
import { instruccionesEjercicio } from './tipos';
import { useConfirm, Button } from '../ui';
import { card, input, btn, btnGhost } from './estilos';

interface SerieVivo {
  key: string;
  dia_ejercicio_id: string;
  ejercicio_id: string;
  ejercicio_nombre: string;
  orden: number;
  tipo: string;
  peso_kg_plan: number | null;
  reps_plan: number | null;
  duracion_s_plan: number | null;
  descanso_s_plan: number | null;
  /** Pasos del ejercicio, para consultar entre series sin salir del reproductor. */
  instrucciones: string[];

  peso_kg: string;
  reps: string;
  duracion_s: string;
  completado: boolean;
}

interface Props {
  dia: Dia;
  unidad: UnidadPeso;
  onSalir: () => void;
}

// Nota de arquitectura: la sesion padre se crea en /api/salud/sesiones (tabla
// compartida `sesiones`, tipo 'gym'), y cada set completado se registra en
// /api/gfit/sesion-series (tabla `gfit_sesion_series`, que ya referencia
// ejercicios_catalogo). Es el mismo camino que ya usan gfit/progreso y
// gfit/logros para leer el historial. No existe un endpoint /api/gfit/sesiones.
export default function OSGfitReproductor({ dia, unidad, onSalir }: Props) {
  const { confirm, sheet } = useConfirm();
  const [sets, setSets] = useState<SerieVivo[]>([]);
  const [idx, setIdx] = useState(0);
  const [descanso, setDescanso] = useState(0);
  const [terminar, setTerminar] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const duracionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [duracionActiva, setDuracionActiva] = useState(false);
  const [duracionRestante, setDuracionRestante] = useState(0);
  // Colapsado por defecto: el reproductor se usa con el celular en la mano
  // entre series, y tiene que seguir siendo legible de un vistazo.
  const [verComo, setVerComo] = useState(false);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    const arr: SerieVivo[] = [];
    const items = [...(dia.gfit_dia_ejercicios ?? [])].sort((a, b) => a.orden - b.orden);
    items.forEach((it) => {
      const ejs = [...(it.gfit_series_plan ?? [])].sort((a, b) => a.orden - b.orden);
      ejs.forEach((s) => {
        arr.push({
          key: `${it.id}-${s.id}`,
          dia_ejercicio_id: it.id,
          ejercicio_id: it.ejercicio_id,
          ejercicio_nombre: it.ejercicio?.nombre_es ?? it.ejercicio?.nombre_en ?? 'Ejercicio',
          orden: arr.length,
          tipo: s.tipo,
          peso_kg_plan: s.peso_kg,
          reps_plan: s.reps,
          duracion_s_plan: s.duracion_s,
          descanso_s_plan: s.descanso_s,
          instrucciones: instruccionesEjercicio(it.ejercicio),
          peso_kg: s.peso_kg != null ? String(s.peso_kg) : '',
          reps: s.reps != null ? String(s.reps) : '',
          duracion_s: s.duracion_s != null ? String(s.duracion_s) : '',
          completado: false,
        });
      });
    });
    setSets(arr);
  }, [dia]);

  const actual = sets[idx];

  useEffect(() => {
    if (descanso <= 0) { if (timerRef.current) clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(() => setDescanso((d) => (d <= 1 ? 0 : d - 1)), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [descanso]);

  useEffect(() => {
    if (descanso === 0 && timerRef.current) {
      if (navigator.vibrate) navigator.vibrate(200);
    }
  }, [descanso]);

  useEffect(() => {
    if (!duracionActiva || duracionRestante <= 0) {
      if (duracionTimerRef.current) clearInterval(duracionTimerRef.current);
      if (duracionActiva && duracionRestante <= 0) {
         setDuracionActiva(false);
         completarSet();
         if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      }
      return;
    }
    duracionTimerRef.current = setInterval(() => setDuracionRestante((d) => (d <= 1 ? 0 : d - 1)), 1000);
    return () => { if (duracionTimerRef.current) clearInterval(duracionTimerRef.current); };
  }, [duracionActiva, duracionRestante]);


  function actualizar(campo: keyof SerieVivo, valor: string | boolean) {
    setSets(sets.map((s, i) => i === idx ? { ...s, [campo]: valor } : s));
  }

  function completarSet() {
    setDuracionActiva(false);
    const nuevo = sets.map((s, i) => i === idx ? { ...s, completado: true } : s);
    setSets(nuevo);
    if ((actual?.descanso_s_plan ?? 0) > 0 && idx < sets.length - 1) {
      setDescanso(actual!.descanso_s_plan!);
    }
    if (idx < sets.length - 1) {
      setIdx(idx + 1);
    } else {
      setTerminar(true);
    }
  }

  async function guardarSesion() {
    setGuardando(true);
    try {
      const dur = Math.round((Date.now() - startTimeRef.current) / 60000);
      const completados = sets.filter((s) => s.completado);

      // 1) crear la sesion padre en la tabla compartida `sesiones` (tipo gym).
      const resSesion = await fetch('/api/salud/sesiones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'gym',
          duracion_min: dur,
          inicio: new Date(startTimeRef.current).toISOString(),
          fin: new Date().toISOString(),
          notas: `GFIT: ${dia.nombre}`,
        }),
      });
      const dataSesion = await resSesion.json();
      const sesionId = dataSesion?.sesion?.id;

      // 2) registrar cada set completado en gfit_sesion_series (ejercicios_catalogo).
      if (sesionId && completados.length) {
        await Promise.all(completados.map((s, i) =>
          fetch('/api/gfit/sesion-series', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sesion_id: sesionId,
              dia_ejercicio_id: s.dia_ejercicio_id,
              ejercicio_id: s.ejercicio_id,
              orden: i,
              tipo: s.tipo,
              reps: Number(s.reps) || null,
              peso_kg: Number(s.peso_kg) || null,
              duracion_s: Number(s.duracion_s) || null,
            }),
          }),
        ));
      }
    } finally {
      setGuardando(false);
      onSalir();
    }
  }

  if (!sets.length) return <p style={{ color: 'var(--os-text)' }}>Cargando rutinas...</p>;

  const completados = sets.filter((s) => s.completado).length;
  const pct = Math.round((completados / sets.length) * 100);

  if (terminar) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 480, margin: '0 auto' }}>
        <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--os-text)', margin: 0 }}>Terminar sesión</p>
        <p style={{ fontSize: 'var(--os-text-sm)', color: 'var(--os-muted)', margin: 0 }}>{completados} de {sets.length} sets completados · {dia.nombre}</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={btn} disabled={guardando} onClick={guardarSesion}>{guardando ? 'Guardando...' : 'Guardar sesión'}</button>
          <button style={btnGhost} onClick={() => setTerminar(false)}>← Seguir</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 480, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button style={btnGhost} onClick={async () => {
          if (await confirm({ title: 'Salir sin guardar', text: 'Se pierde el progreso de esta sesión.', confirmLabel: 'Salir', danger: true })) onSalir();
        }}>✕</button>
        <div style={{ flex: 1, height: 6, background: 'var(--os-fill-subtle)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--os-accent)', borderRadius: 3, transition: 'width .3s' }} />
        </div>
        <span style={{ fontSize: 'var(--os-text-xs)', fontFamily: 'var(--os-font-mono)', color: 'var(--os-muted)' }}>{idx + 1}/{sets.length}</span>
      </div>

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

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--os-text)' }}>{actual.ejercicio_nombre}</span>
          <span style={{ fontSize: 11, fontFamily: 'var(--os-font-display)', color: 'var(--os-text)', background: 'var(--os-fill-subtle)', padding: '3px 9px', borderRadius: 999 }}>{actual.tipo}</span>
        </div>
        <p style={{ fontSize: 'var(--os-text-sm)', color: 'var(--os-text-2)', margin: '0 0 4px' }}>
          Objetivo: <b>{actual.reps_plan || '-'} reps</b>{actual.peso_kg_plan ? ` × ${actual.peso_kg_plan} kg` : ''} {actual.duracion_s_plan ? ` | ${actual.duracion_s_plan} s` : ''}
        </p>

        {actual.instrucciones.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <button
              onClick={() => setVerComo((v) => !v)}
              style={{
                ...btnGhost,
                minHeight: 'var(--os-tap-min)',
                fontSize: 'var(--os-text-sm)',
                width: '100%',
                textAlign: 'left',
              }}
            >
              {verComo ? 'Ocultar cómo se hace' : 'Cómo se hace'}
            </button>
            {verComo && (
              <ol style={{ margin: '8px 0 0', paddingLeft: 20, color: 'var(--os-text-2)', fontSize: 'var(--os-text-sm)', lineHeight: 1.5 }}>
                {actual.instrucciones.map((paso, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>{paso}</li>
                ))}
              </ol>
            )}
          </div>
        )}

        {actual.duracion_s_plan && (
           <div style={{ textAlign: 'center', margin: '20px 0' }}>
              <p style={{ fontSize: 48, fontFamily: 'var(--os-font-mono)', fontWeight: 800, margin: 0, color: duracionActiva ? 'var(--os-accent)' : 'var(--os-text)' }}>
                {duracionActiva ? duracionRestante : actual.duracion_s_plan}s
              </p>
              {!duracionActiva ? (
                 <button style={{ ...btn, marginTop: 10 }} onClick={() => { setDuracionRestante(actual.duracion_s_plan!); setDuracionActiva(true); }}>
                   ▶ Iniciar Temporizador
                 </button>
              ) : (
                 <button style={{ ...btnGhost, marginTop: 10 }} onClick={() => setDuracionActiva(false)}>
                   ⏸ Pausar
                 </button>
              )}
           </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: actual.duracion_s_plan ? '1fr' : 'repeat(2, 1fr)', gap: 8, marginTop: 8 }}>
          {!actual.duracion_s_plan && (
             <>
                <label style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)' }}>Reps
                  <input style={{ ...input, marginTop: 3, fontSize: 16, textAlign: 'center' }} type="number" inputMode="numeric" value={actual.reps} onChange={(e) => actualizar('reps', e.target.value)} />
                </label>
                <label style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)' }}>Peso (kg)
                  <input style={{ ...input, marginTop: 3, fontSize: 16, textAlign: 'center' }} type="number" inputMode="decimal" value={actual.peso_kg} onChange={(e) => actualizar('peso_kg', e.target.value)} />
                </label>
             </>
          )}
        </div>

        <button style={{ ...btn, width: '100%', marginTop: 14, padding: '12px' }} onClick={completarSet}>
          {idx < sets.length - 1 ? 'Completar set ✓' : 'Completar y terminar'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between', marginTop: 12 }}>
        <button style={btnGhost} disabled={idx === 0} onClick={() => setIdx(idx - 1)}>← Anterior</button>
        <button style={btnGhost} onClick={() => setTerminar(true)}>Terminar sesión</button>
        <button style={btnGhost} disabled={idx >= sets.length - 1} onClick={() => setIdx(idx + 1)}>Saltar →</button>
      </div>
      {sheet}
    </div>
  );
}
