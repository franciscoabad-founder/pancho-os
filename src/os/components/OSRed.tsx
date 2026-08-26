// Modulo Networking Room: diagnostico de red personal (Willburn + Ibarra &
// Hunter), scorecard de apertura, y personas vencidas para tocar esta semana.
// Habla solo con /api/red.
//
// Nota deliberada de contenido: esto es red PERSONAL, no CRM de ventas. Sin
// lenguaje de fundraising/inversionistas -- ver la correccion al export de
// Stitch en design-system/stitch-v3 antes de portar nada de ahi tal cual.

import { useEffect, useState } from 'react';
import { Button, EmptyState, Spinner, Badge, ProgressBar, Tabs } from './ui';

type TipoLazo = 'operacional' | 'personal' | 'estrategico';
type Banda = 'muy-abierta' | 'abierta' | 'ideal' | 'algo-cerrada' | 'cerrada' | 'muy-cerrada';

const BANDA_LABEL: Record<Banda, string> = {
  'muy-abierta': 'Muy abierta',
  abierta: 'Abierta',
  ideal: 'Ideal',
  'algo-cerrada': 'Algo cerrada',
  cerrada: 'Cerrada',
  'muy-cerrada': 'Muy cerrada',
};

const LAZO_LABEL: Record<TipoLazo, string> = { operacional: 'Operacional', personal: 'Personal', estrategico: 'Estratégico' };

interface Persona {
  id: string;
  nombre: string;
  iniciales: string | null;
  area: string;
  cercania: number;
  tipo_lazo: TipoLazo;
  ultima_interaccion: string | null;
  frecuencia_dias: number;
}

interface Diagnostico {
  apertura: { densidad: number; banda: Banda; distanciaAlIdeal: number };
  diversidad: { entropia: number; porArea: Array<{ area: string; pct: number }> };
  balance: { operacional: number; personal: number; estrategico: number; alerta: string | null };
  totalPersonas: number;
  limiteRecomendado: number;
}

interface Plan {
  meta: string;
  frontera: string | null;
  horizonte_fin: string | null;
}

const inputStyle: React.CSSProperties = {
  background: 'var(--os-fill-subtle)', border: '1px solid var(--os-line)', borderRadius: 6,
  padding: '7px 11px', minHeight: 36, fontSize: 'var(--os-text-sm)', color: 'var(--os-text)',
  fontFamily: 'var(--os-font-body)', outline: 'none', width: '100%', boxSizing: 'border-box',
};

const chipStyle: React.CSSProperties = {
  borderRadius: 999, cursor: 'pointer', padding: '5px 12px', minHeight: 32,
  fontSize: 'var(--os-text-xs)', fontFamily: 'var(--os-font-display)', fontWeight: 700,
};

function chipEstilo(activo: boolean): React.CSSProperties {
  return {
    ...chipStyle,
    background: activo ? 'rgba(59,78,217,0.14)' : 'none',
    border: activo ? '1px solid rgba(59,78,217,0.35)' : '1px solid var(--os-line)',
    color: activo ? 'var(--os-accent-light)' : 'var(--os-muted)',
  };
}

function diasDesde(fecha: string | null): number | null {
  if (!fecha) return null;
  const hoy = new Date();
  const d = new Date(`${fecha}T00:00:00`);
  return Math.floor((hoy.getTime() - d.getTime()) / 86_400_000);
}

function estaVencida(p: Persona): boolean {
  const dias = diasDesde(p.ultima_interaccion);
  if (dias === null) return true;
  return dias >= p.frecuencia_dias;
}

// Numero de semana ISO, para el fuente_ref idempotente del puente de tareas.
function semanaIso(fecha: Date): string {
  const d = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const semana = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(semana).padStart(2, '0')}`;
}

export default function OSRed() {
  const [tab, setTab] = useState<'personas' | 'scorecard' | 'plan'>('personas');
  const [pasoGuiado, setPasoGuiado] = useState<1 | 2 | 3>(1);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [diagnostico, setDiagnostico] = useState<Diagnostico | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const [nombre, setNombre] = useState('');
  const [area, setArea] = useState('');
  const [cercania, setCercania] = useState(2);
  const [tipoLazo, setTipoLazo] = useState<TipoLazo>('personal');

  const [metaPlan, setMetaPlan] = useState('');
  const [fronteraPlan, setFronteraPlan] = useState('');

  async function load() {
    try {
      const [rPersonas, rDiag, rPlan] = await Promise.all([
        fetch('/api/red'),
        fetch('/api/red?diagnostico=1'),
        fetch('/api/red?plan=1'),
      ]);
      const dPersonas = await rPersonas.json();
      const dDiag = await rDiag.json();
      const dPlan = await rPlan.json();
      if (!rPersonas.ok) throw new Error(dPersonas.error || String(rPersonas.status));
      setPersonas(dPersonas.personas ?? []);
      setDiagnostico(dDiag as Diagnostico);
      setPlan((dPlan.plan as Plan) ?? null);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function llamar(url: string, init: RequestInit): Promise<Record<string, unknown>> {
    const res = await fetch(url, init);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error || String(res.status));
    return data as Record<string, unknown>;
  }

  async function accion(fn: () => Promise<unknown>, mensaje?: string) {
    try {
      await fn();
      setError('');
      if (mensaje) setAviso(mensaje);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function agregarPersona() {
    if (!nombre.trim()) return;
    await accion(() => llamar('/api/red', { method: 'POST', body: JSON.stringify({ persona: { nombre, area: area || 'general', cercania, tipo_lazo: tipoLazo } }) }));
    setNombre(''); setArea('');
  }

  async function marcarContacto(id: string) {
    await accion(() => llamar('/api/red', { method: 'POST', body: JSON.stringify({ contacto: { persona_id: id } }) }), 'Contacto registrado.');
  }

  async function crearPlan() {
    if (!metaPlan.trim()) return;
    await accion(() => llamar('/api/red', { method: 'POST', body: JSON.stringify({ plan: { meta: metaPlan, frontera: fronteraPlan } }) }), 'Plan creado.');
    setMetaPlan(''); setFronteraPlan('');
  }

  async function generarTareas() {
    const semana = semanaIso(new Date());
    await accion(async () => {
      const r = await llamar('/api/red', { method: 'POST', body: JSON.stringify({ generar_tareas: { semana } }) });
      const resultado = r.resultado as { items_creados: number; items_duplicados: number };
      setAviso(
        resultado.items_creados > 0
          ? `${resultado.items_creados} tarea(s) agregada(s) a tu lista.`
          : 'Ya estaban todas generadas esta semana, o nadie está vencido.'
      );
    });
  }

  if (loading) return <Spinner label="Cargando Networking Room..." />;

  const vencidos = personas.filter(estaVencida);
  const dist = distanciaPct(diagnostico?.apertura.densidad ?? 0.5);

  // Ruta corta basada en el diagnóstico de Willburn: mapear, leer el patrón
  // y convertirlo en una conversación concreta. No crea datos adicionales ni
  // reemplaza las pestañas; sólo hace explícito el siguiente paso.
  const pasoCta = pasoGuiado === 1
    ? personas.length === 0 ? 'Ir a personas' : 'Revisar scorecard'
    : pasoGuiado === 2 ? 'Definir plan' : vencidos.length > 0 ? 'Mandar contactos a tareas' : plan ? 'Volver a personas' : 'Crear plan';

  function avanzarRuta() {
    if (pasoGuiado === 1) {
      if (personas.length === 0) { setTab('personas'); return; }
      setPasoGuiado(2); setTab('scorecard'); return;
    }
    if (pasoGuiado === 2) { setPasoGuiado(3); setTab('plan'); return; }
    if (vencidos.length > 0) { void generarTareas(); return; }
    if (!plan) { setTab('plan'); return; }
    setPasoGuiado(1); setTab('personas');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {error && <p style={{ color: 'var(--os-error)', fontSize: 'var(--os-text-xs)' }}>Error: {error}</p>}
      {aviso && <p style={{ color: 'var(--os-champagne)', fontSize: 'var(--os-text-xs)' }}>{aviso}</p>}

      <section className="os-card-2" aria-label="Ruta guiada de diagnóstico" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <p className="os-eyebrow" style={{ marginBottom: 4 }}>Ruta guiada · 3 pasos</p>
            <p style={{ margin: 0, color: 'var(--os-text)', fontSize: 'var(--os-text-base)', fontWeight: 700 }}>
              {pasoGuiado === 1 ? 'Mapea a las personas importantes' : pasoGuiado === 2 ? 'Lee el patrón de tu red' : 'Elige una acción pequeña'}
            </p>
          </div>
          <span style={{ color: 'var(--os-muted)', fontSize: 'var(--os-text-xs)' }}>Paso {pasoGuiado} de 3</span>
        </div>
        <p style={{ margin: 0, color: 'var(--os-muted)', fontSize: 'var(--os-text-sm)', lineHeight: 1.45 }}>
          {pasoGuiado === 1
            ? 'Anota hasta 16 personas con contacto directo en los últimos seis meses. Incluye vínculos operacionales, personales y estratégicos.'
            : pasoGuiado === 2
              ? 'Compara apertura, diversidad, cercanía y tipo de vínculo. El scorecard orienta la conversación; no es una etiqueta permanente.'
              : vencidos.length > 0
                ? `Tienes ${vencidos.length} contacto(s) vencido(s). Conviértelos en tareas para esta semana.`
                : plan
                  ? 'Tu plan está definido. Da seguimiento a una persona esta semana y registra el contacto.'
                  : 'Define una meta de red y la frontera que quieres cruzar para convertir el diagnóstico en práctica.'}
        </p>
        <div style={{ display: 'flex', gap: 6 }} aria-hidden="true">
          {[1, 2, 3].map((n) => <span key={n} style={{ height: 4, flex: 1, borderRadius: 999, background: n <= pasoGuiado ? 'var(--os-accent)' : 'var(--os-line)' }} />)}
        </div>
        <div><Button size="sm" onClick={avanzarRuta}>{pasoCta}</Button></div>
      </section>

      {vencidos.length > 0 && (
        <div className="os-card-2" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p className="os-eyebrow" style={{ marginBottom: 0 }}>Esta semana toca ({vencidos.length})</p>
            <Button size="sm" variant="ghost" onClick={generarTareas}>Mandar a tareas</Button>
          </div>
          {vencidos.map((p) => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--os-text-sm)', color: 'var(--os-text)' }}>{p.nombre} <span style={{ color: 'var(--os-muted)', fontSize: 'var(--os-text-xs)' }}>· {p.area}</span></span>
              <Button size="sm" variant="ghost" onClick={() => marcarContacto(p.id)}>Listo</Button>
            </div>
          ))}
        </div>
      )}

      <Tabs
        tabs={[
          { id: 'personas', label: 'Personas', count: personas.length },
          { id: 'scorecard', label: 'Scorecard' },
          { id: 'plan', label: 'Plan' },
        ]}
        active={tab}
        onChange={(id) => setTab(id as typeof tab)}
      />

      {tab === 'personas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {personas.length === 0 ? (
            <div className="os-card-2">
              <EmptyState icon="diversity_3" title="Sin personas todavía" text="Agrega hasta 16 personas con las que tuviste contacto directo en los últimos 6 meses." />
            </div>
          ) : (
            personas.map((p) => (
              <div key={p.id} className="os-card-2" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem' }}>
                <div>
                  <p style={{ fontSize: 'var(--os-text-sm)', fontWeight: 700, color: 'var(--os-text)', margin: 0 }}>{p.nombre}</p>
                  <p style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', margin: 0 }}>{p.area} · cercanía {p.cercania}/3</p>
                </div>
                <Badge>{LAZO_LABEL[p.tipo_lazo]}</Badge>
              </div>
            ))
          )}

          <div className="os-card-2" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p className="os-eyebrow" style={{ marginBottom: 0 }}>Agregar persona ({personas.length}/{diagnostico?.limiteRecomendado ?? 16})</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input style={{ ...inputStyle, flex: 2 }} placeholder="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
              <input style={{ ...inputStyle, flex: 1 }} placeholder="Área (trabajo, familia...)" value={area} onChange={(e) => setArea(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <span style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', alignSelf: 'center' }}>Cercanía:</span>
              {[1, 2, 3].map((n) => (
                <button key={n} onClick={() => setCercania(n)} style={chipEstilo(cercania === n)}>{n}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(['operacional', 'personal', 'estrategico'] as TipoLazo[]).map((t) => (
                <button key={t} onClick={() => setTipoLazo(t)} style={chipEstilo(tipoLazo === t)}>{LAZO_LABEL[t]}</button>
              ))}
            </div>
            <Button size="sm" onClick={agregarPersona} disabled={!nombre.trim()}>Agregar</Button>
          </div>
        </div>
      )}

      {tab === 'scorecard' && diagnostico && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="os-card-2">
            <p className="os-eyebrow" style={{ marginBottom: 8 }}>Apertura de red</p>
            <div style={{ position: 'relative', height: 40, background: 'var(--os-fill-subtle)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ position: 'absolute', left: '35%', width: '30%', top: 0, bottom: 0, background: 'rgba(181,152,90,0.18)', borderLeft: '1px solid var(--os-champagne)', borderRight: '1px solid var(--os-champagne)' }} />
              <div style={{ position: 'absolute', left: `calc(${dist}% - 3px)`, top: 4, bottom: 4, width: 6, borderRadius: 999, background: 'var(--os-accent)' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)' }}>Muy abierta</span>
              <span style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-champagne)', fontWeight: 700 }}>IDEAL (centro)</span>
              <span style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)' }}>Muy cerrada</span>
            </div>
            <p style={{ fontSize: 'var(--os-text-sm)', color: 'var(--os-text)', marginTop: 8 }}>
              Tu red está <b>{BANDA_LABEL[diagnostico.apertura.banda]}</b>.
            </p>
          </div>

          <div className="os-card-2">
            <p className="os-eyebrow" style={{ marginBottom: 8 }}>Diversidad por área</p>
            {diagnostico.diversidad.porArea.map((a) => (
              <ProgressBar key={a.area} value={a.pct} max={100} label={a.area} tone="metric" style={{ marginBottom: 6 }} />
            ))}
          </div>

          <div className="os-card-2">
            <p className="os-eyebrow" style={{ marginBottom: 8 }}>Balance de vínculos</p>
            <ProgressBar value={Math.round(diagnostico.balance.operacional * 100)} max={100} label="Operacional" style={{ marginBottom: 6 }} />
            <ProgressBar value={Math.round(diagnostico.balance.personal * 100)} max={100} label="Personal" style={{ marginBottom: 6 }} />
            <ProgressBar value={Math.round(diagnostico.balance.estrategico * 100)} max={100} label="Estratégico" tone={diagnostico.balance.alerta ? 'warn' : 'metric'} />
            {diagnostico.balance.alerta && <p style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-warn)', marginTop: 8 }}>{diagnostico.balance.alerta}</p>}
          </div>
        </div>
      )}

      {tab === 'plan' && (
        <div className="os-card-2" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {plan ? (
            <>
              <div>
                <p className="os-eyebrow" style={{ marginBottom: 4 }}>Meta</p>
                <p style={{ fontSize: 'var(--os-text-base)', color: 'var(--os-text)', margin: 0 }}>{plan.meta}</p>
              </div>
              {plan.frontera && (
                <div style={{ background: 'rgba(59,78,217,0.08)', borderRadius: 8, padding: 12 }}>
                  <p className="os-eyebrow" style={{ marginBottom: 4 }}>La frontera a cruzar</p>
                  <p style={{ fontSize: 'var(--os-text-base)', color: 'var(--os-text)', margin: 0, fontWeight: 700 }}>{plan.frontera}</p>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="os-eyebrow" style={{ marginBottom: 0 }}>Nuevo plan de red</p>
              <input style={inputStyle} placeholder="¿Qué quieres lograr con tu red?" value={metaPlan} onChange={(e) => setMetaPlan(e.target.value)} />
              <input style={inputStyle} placeholder="La frontera a cruzar (algo que hoy no cruzas)" value={fronteraPlan} onChange={(e) => setFronteraPlan(e.target.value)} />
              <Button size="sm" onClick={crearPlan} disabled={!metaPlan.trim()}>Fijar meta</Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Posicion en % del marcador dentro de la barra de apertura (0=izq muy abierta, 100=der muy cerrada).
function distanciaPct(densidad: number): number {
  return Math.max(2, Math.min(98, Math.round(densidad * 100)));
}
