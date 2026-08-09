import { useEffect, useMemo, useState } from 'react';
import type { SistemaState } from '../data/types';

interface Props {
  initialState: SistemaState;
}

const LOCAL_KEY = 'pancho-os-system-state';

function cloneState(state: SistemaState): SistemaState {
  return JSON.parse(JSON.stringify(state));
}

function statusColor(status: string) {
  if (status === 'activo') return 'var(--os-champagne)';
  if (status === 'error') return 'var(--os-error)';
  return 'var(--os-warn)';
}

export default function OSSistema({ initialState }: Props) {
  const [state, setState] = useState<SistemaState>(() => cloneState(initialState));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('Cargando estado...');

  useEffect(() => {
    let cancelled = false;

    async function loadState() {
      const local = localStorage.getItem(LOCAL_KEY);
      if (local) {
        try {
          setState(JSON.parse(local));
          setMessage('Estado local cargado. Sincronizando...');
        } catch {
          localStorage.removeItem(LOCAL_KEY);
        }
      }

      try {
        const res = await fetch('/api/os/system');
        const data = await res.json();
        if (!cancelled && data.state) {
          setState(data.state);
          setMessage(data.source === 'supabase' ? 'Sincronizado con Supabase.' : 'Usando estado base del OS.');
        }
      } catch {
        if (!cancelled) setMessage('Sin conexion al estado remoto. Trabajando local.');
      }
    }

    loadState();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
  }, [state]);

  const stackAlert = useMemo(() => state.priority_stack.length > 5, [state.priority_stack.length]);
  const completed = state.onboarding.completado;

  async function save() {
    setSaving(true);
    setMessage('Guardando...');
    try {
      const res = await fetch('/api/os/system', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || String(res.status));
      setState(data.state);
      localStorage.setItem(LOCAL_KEY, JSON.stringify(data.state));
      setMessage('Guardado. n8n/Hermes pueden leer esta version.');
    } catch (err) {
      setMessage(`Guardado local. Pendiente remoto: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  function updateObjective(index: number, field: 'titulo' | 'descripcion' | 'metrica', value: string) {
    setState((prev) => {
      const next = cloneState(prev);
      next.objetivos_90d[index][field] = value;
      return next;
    });
  }

  function updatePriority(index: number, field: 'proyecto' | 'tarea' | 'owner', value: string) {
    setState((prev) => {
      const next = cloneState(prev);
      next.priority_stack[index][field] = value;
      return next;
    });
  }

  function toggleOnboarding() {
    setState((prev) => ({
      ...prev,
      onboarding: { ...prev.onboarding, completado: !prev.onboarding.completado },
    }));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="os-kpi-grid">
        <div className="os-kpi">
          <p className="os-kpi-label">Objetivos 90d</p>
          <p className="os-kpi-value">{state.objetivos_90d.length}</p>
          <span style={{ fontSize: 11, color: 'var(--os-muted)' }}>Norte activo</span>
        </div>
        <div className="os-kpi">
          <p className="os-kpi-label">Prioridad</p>
          <p className="os-kpi-value">{state.priority_stack.length}</p>
          <span style={{ fontSize: 11, color: stackAlert ? 'var(--os-warn)' : 'var(--os-muted)' }}>
            {stackAlert ? 'Stack mayor a 5' : 'Dentro de limite'}
          </span>
        </div>
        <div className="os-kpi">
          <p className="os-kpi-label">Modulos</p>
          <p className="os-kpi-value">{state.modulos.filter((m) => m.estado === 'activo').length}</p>
          <span style={{ fontSize: 11, color: 'var(--os-muted)' }}>Activos</span>
        </div>
        <div className="os-kpi">
          <p className="os-kpi-label">Onboarding</p>
          <p className="os-kpi-value">{completed ? 'OK' : 'PEN'}</p>
          <span style={{ fontSize: 11, color: 'var(--os-muted)' }}>{completed ? 'Completo' : 'Pendiente'}</span>
        </div>
      </div>

      {!completed && (
        <div className="os-domino" style={{ marginBottom: 0 }}>
          <p className="os-eyebrow" style={{ marginBottom: 8 }}>Onboarding pendiente</p>
          <p style={{ margin: '0 0 6px', color: 'var(--os-text)', fontWeight: 700, fontSize: 15 }}>
            Empieza en la tarjeta “Onboarding del agente”.
          </p>
          <p style={{ margin: 0, color: 'var(--os-text-2)', fontSize: 13, lineHeight: 1.5 }}>
            Llena foco, ritmo, tono y finanzas. Cuando este listo, presiona Completar y luego Guardar sistema.
          </p>
        </div>
      )}

      <div className="os-card os-card-accent">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          <div>
            <p className="os-section-title" style={{ marginBottom: 4 }}>Onboarding del agente</p>
            <p style={{ margin: 0, color: 'var(--os-text-2)', fontSize: 13 }}>Esto le dice a Mateo como operar tu sistema sin preguntarte lo obvio cada vez.</p>
          </div>
          <button className="os-btn os-btn-ghost" type="button" onClick={toggleOnboarding}>
            {completed ? 'Reabrir' : 'Completar'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span className="os-eyebrow os-eyebrow-muted">Nombre</span>
            <input
              className="os-input"
              value={state.onboarding.nombre}
              onChange={(e) => setState((prev) => ({ ...prev, onboarding: { ...prev.onboarding, nombre: e.target.value } }))}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span className="os-eyebrow os-eyebrow-muted">Ritmo</span>
            <input
              className="os-input"
              value={state.onboarding.ritmo}
              onChange={(e) => setState((prev) => ({ ...prev, onboarding: { ...prev.onboarding, ritmo: e.target.value } }))}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5, gridColumn: '1 / -1' }}>
            <span className="os-eyebrow os-eyebrow-muted">Foco 90 dias</span>
            <textarea
              className="os-input"
              rows={3}
              value={state.onboarding.foco_90_dias}
              onChange={(e) => setState((prev) => ({ ...prev, onboarding: { ...prev.onboarding, foco_90_dias: e.target.value } }))}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5, gridColumn: '1 / -1' }}>
            <span className="os-eyebrow os-eyebrow-muted">Tono del agente</span>
            <textarea
              className="os-input"
              rows={2}
              value={state.onboarding.tono_agente}
              onChange={(e) => setState((prev) => ({ ...prev, onboarding: { ...prev.onboarding, tono_agente: e.target.value } }))}
            />
          </label>
        </div>
      </div>

      <div className="os-card os-card-accent">
        <div style={{ marginBottom: 12 }}>
          <p className="os-section-title" style={{ marginBottom: 4 }}>Onboarding financiero</p>
          <p style={{ margin: 0, color: 'var(--os-text-2)', fontSize: 13, lineHeight: 1.5 }}>
            Esto alimenta la revision financiera de Hermes: gap mensual, deuda prioritaria, cuentas y reglas de asignacion.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '0.5fr 0.8fr 0.6fr', gap: 10, marginBottom: 10 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span className="os-eyebrow os-eyebrow-muted">Moneda</span>
            <input
              className="os-input"
              value={state.finanzas_onboarding?.moneda_base ?? ''}
              onChange={(e) => setState((prev) => ({
                ...prev,
                finanzas_onboarding: { ...prev.finanzas_onboarding, moneda_base: e.target.value },
              }))}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span className="os-eyebrow os-eyebrow-muted">Ingreso mensual necesario</span>
            <input
              className="os-input"
              placeholder="Ej: 4500"
              value={state.finanzas_onboarding?.ingreso_mensual_necesario ?? ''}
              onChange={(e) => setState((prev) => ({
                ...prev,
                finanzas_onboarding: { ...prev.finanzas_onboarding, ingreso_mensual_necesario: e.target.value },
              }))}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span className="os-eyebrow os-eyebrow-muted">Runway meta</span>
            <input
              className="os-input"
              placeholder="Meses"
              value={state.finanzas_onboarding?.runway_objetivo_meses ?? ''}
              onChange={(e) => setState((prev) => ({
                ...prev,
                finanzas_onboarding: { ...prev.finanzas_onboarding, runway_objetivo_meses: e.target.value },
              }))}
            />
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span className="os-eyebrow os-eyebrow-muted">Deuda prioritaria</span>
            <textarea
              className="os-input"
              rows={3}
              placeholder="Acreedor, monto, tasa, fecha limite"
              value={state.finanzas_onboarding?.deuda_prioritaria ?? ''}
              onChange={(e) => setState((prev) => ({
                ...prev,
                finanzas_onboarding: { ...prev.finanzas_onboarding, deuda_prioritaria: e.target.value },
              }))}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span className="os-eyebrow os-eyebrow-muted">Regla de asignacion</span>
            <textarea
              className="os-input"
              rows={3}
              value={state.finanzas_onboarding?.regla_asignacion ?? ''}
              onChange={(e) => setState((prev) => ({
                ...prev,
                finanzas_onboarding: { ...prev.finanzas_onboarding, regla_asignacion: e.target.value },
              }))}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span className="os-eyebrow os-eyebrow-muted">Cuentas a conectar</span>
            <textarea
              className="os-input"
              rows={3}
              value={(state.finanzas_onboarding?.cuentas_a_conectar ?? []).join('\n')}
              onChange={(e) => setState((prev) => ({
                ...prev,
                finanzas_onboarding: {
                  ...prev.finanzas_onboarding,
                  cuentas_a_conectar: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean),
                },
              }))}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span className="os-eyebrow os-eyebrow-muted">Cadencia</span>
            <textarea
              className="os-input"
              rows={3}
              value={state.finanzas_onboarding?.cadencia_revision ?? ''}
              onChange={(e) => setState((prev) => ({
                ...prev,
                finanzas_onboarding: { ...prev.finanzas_onboarding, cadencia_revision: e.target.value },
              }))}
            />
          </label>
        </div>
      </div>

      <div className="os-card">
        <p className="os-section-title">Objetivos 90 dias</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {state.objetivos_90d.map((o, index) => (
            <div key={o.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 0.7fr) 1.4fr minmax(140px, 0.7fr)', gap: 8 }}>
              <input className="os-input" value={o.titulo} onChange={(e) => updateObjective(index, 'titulo', e.target.value)} />
              <input className="os-input" value={o.descripcion} onChange={(e) => updateObjective(index, 'descripcion', e.target.value)} />
              <input className="os-input" placeholder="Metrica" value={o.metrica ?? ''} onChange={(e) => updateObjective(index, 'metrica', e.target.value)} />
            </div>
          ))}
        </div>
      </div>

      <div className="os-card">
        <p className="os-section-title">Priority Stack</p>
        {stackAlert && (
          <p style={{ color: 'var(--os-warn)', fontSize: 12, margin: '0 0 10px' }}>
            Hay mas de cinco prioridades. Conviene bajar una antes de sumar otra.
          </p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {state.priority_stack.map((p, index) => (
            <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '32px minmax(130px, 0.6fr) 1.4fr minmax(100px, 0.45fr)', gap: 8, alignItems: 'center' }}>
              <span className="os-num" style={{ fontSize: 12 }}>{p.orden}</span>
              <input className="os-input" value={p.proyecto} onChange={(e) => updatePriority(index, 'proyecto', e.target.value)} />
              <input className="os-input" value={p.tarea} onChange={(e) => updatePriority(index, 'tarea', e.target.value)} />
              <input className="os-input" value={p.owner ?? ''} onChange={(e) => updatePriority(index, 'owner', e.target.value)} />
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="os-card">
          <p className="os-section-title">Modulos</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {state.modulos.map((m) => (
              <div key={m.id} style={{ padding: 10, border: '1px solid var(--os-line-soft)', borderRadius: 8, background: 'var(--os-fill-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <strong style={{ color: 'var(--os-text)', fontSize: 13 }}>{m.nombre}</strong>
                  <span style={{ color: statusColor(m.estado), fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{m.estado}</span>
                </div>
                <p style={{ color: 'var(--os-muted)', fontSize: 12, lineHeight: 1.45, margin: '5px 0 0' }}>{m.descripcion}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="os-card">
          <p className="os-section-title">Conexiones</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {state.conexiones.map((c) => (
              <div key={c.id} style={{ padding: 10, border: '1px solid var(--os-line-soft)', borderRadius: 8, background: 'var(--os-fill-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <strong style={{ color: 'var(--os-text)', fontSize: 13 }}>{c.nombre}</strong>
                  <span style={{ color: statusColor(c.estado), fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{c.estado}</span>
                </div>
                <p style={{ color: 'var(--os-muted)', fontSize: 12, lineHeight: 1.45, margin: '5px 0 0', wordBreak: 'break-word' }}>{c.detalle}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ position: 'sticky', bottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'var(--os-surface)', border: '1px solid var(--os-line-accent)', borderRadius: 12, padding: '10px 12px', boxShadow: 'var(--os-shadow-card)' }}>
        <span style={{ color: 'var(--os-muted)', fontSize: 12 }}>{message}</span>
        <button className="os-btn" type="button" onClick={save} disabled={saving}>
          {saving ? 'Guardando' : 'Guardar sistema'}
        </button>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .os-card div[style*="grid-template-columns"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
