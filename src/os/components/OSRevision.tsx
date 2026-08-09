import { useEffect, useState } from 'react';
import { Spinner, ToastProvider, useToast } from './ui';

// Vista Revision: weekly + monthly review en vivo desde /api/os/revision,
// mas el norte de objetivos 90 dias desde /api/os/objetivos.
// `contenido` es jsonb libre; aca fijamos la forma que ya usaba el demo
// (completado/que_parar/que_escalar/energia/nota y wins/pendientes/decision_clave/numero).

interface Objetivo {
  id: string;
  orden: number | null;
  titulo: string;
  descripcion: string | null;
}

interface ContenidoWeekly {
  completado: string[];
  que_parar: string[];
  que_escalar: string[];
  energia: 'alta' | 'media' | 'baja';
  nota: string;
}
interface ContenidoMonthly {
  wins: string[];
  pendientes: string[];
  decision_clave: string;
  numero_destacado: string;
  numero_label: string;
}

const WEEKLY_VACIO: ContenidoWeekly = { completado: [], que_parar: [], que_escalar: [], energia: 'media', nota: '' };
const MONTHLY_VACIO: ContenidoMonthly = { wins: [], pendientes: [], decision_clave: '', numero_destacado: '', numero_label: '' };

function isoWeek(d: Date): { anio: number; semana: number } {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = date.getTime();
  const anio = date.getUTCFullYear();
  const jan4 = new Date(Date.UTC(anio, 0, 4));
  const jan4Day = (jan4.getUTCDay() + 6) % 7;
  jan4.setUTCDate(jan4.getUTCDate() - jan4Day + 3);
  const semana = 1 + Math.round((firstThursday - jan4.getTime()) / (7 * 24 * 3600 * 1000));
  return { anio, semana };
}

function periodoSemanal(): string {
  const { anio, semana } = isoWeek(new Date());
  return `${anio}-W${String(semana).padStart(2, '0')}`;
}
function periodoMensual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const linea = (arr: string[]) => arr.join('\n');
const desdeLinea = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);

const textareaStyle: React.CSSProperties = {
  width: '100%', background: 'var(--os-fill-subtle)', border: '1px solid var(--os-line)',
  borderRadius: 8, padding: '8px 10px', fontSize: 13, color: 'var(--os-text)',
  fontFamily: 'var(--os-font-body)', outline: 'none', resize: 'vertical', boxSizing: 'border-box',
};
const inputStyle: React.CSSProperties = { ...textareaStyle, resize: 'none' };
const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--os-font-display)', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
  textTransform: 'uppercase', color: 'var(--os-muted)', margin: '0 0 4px', display: 'block',
};

function OSRevisionInner() {
  const toast = useToast();
  const [objetivos, setObjetivos] = useState<Objetivo[]>([]);
  const [weekly, setWeekly] = useState<ContenidoWeekly>(WEEKLY_VACIO);
  const [monthly, setMonthly] = useState<ContenidoMonthly>(MONTHLY_VACIO);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [guardandoW, setGuardandoW] = useState(false);
  const [guardandoM, setGuardandoM] = useState(false);
  const [flashW, setFlashW] = useState(false);
  const [flashM, setFlashM] = useState(false);

  const pSemanal = periodoSemanal();
  const pMensual = periodoMensual();

  async function load() {
    try {
      const [rObj, rW, rM] = await Promise.all([
        fetch('/api/os/objetivos', { cache: 'no-store' }),
        fetch(`/api/os/revision?tipo=semanal&periodo=${encodeURIComponent(pSemanal)}`, { cache: 'no-store' }),
        fetch(`/api/os/revision?tipo=mensual&periodo=${encodeURIComponent(pMensual)}`, { cache: 'no-store' }),
      ]);
      const dObj = await rObj.json();
      const dW = await rW.json();
      const dM = await rM.json();
      if (!rObj.ok) throw new Error(dObj.error || String(rObj.status));
      if (!rW.ok) throw new Error(dW.error || String(rW.status));
      if (!rM.ok) throw new Error(dM.error || String(rM.status));
      setObjetivos(dObj.objetivos ?? []);
      setWeekly({ ...WEEKLY_VACIO, ...(dW.revision?.contenido ?? {}) });
      setMonthly({ ...MONTHLY_VACIO, ...(dM.revision?.contenido ?? {}) });
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function guardarSemanal() {
    setGuardandoW(true);
    try {
      const res = await fetch('/api/os/revision', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'semanal', periodo: pSemanal, contenido: weekly }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || String(res.status));
      setFlashW(true); setTimeout(() => setFlashW(false), 1600);
    } catch (err) {
      toast.show('Error: ' + (err instanceof Error ? err.message : String(err)), 'error');
    } finally {
      setGuardandoW(false);
    }
  }

  async function guardarMensual() {
    setGuardandoM(true);
    try {
      const res = await fetch('/api/os/revision', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'mensual', periodo: pMensual, contenido: monthly }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || String(res.status));
      setFlashM(true); setTimeout(() => setFlashM(false), 1600);
    } catch (err) {
      toast.show('Error: ' + (err instanceof Error ? err.message : String(err)), 'error');
    } finally {
      setGuardandoM(false);
    }
  }

  if (loading) {
    return <Spinner label="Cargando revision..." />;
  }
  if (error && objetivos.length === 0 && !weekly.nota && !monthly.decision_clave) {
    return (
      <div className="os-card-2" style={{ padding: '1rem' }}>
        <p style={{ color: 'var(--os-error)', fontSize: 13, margin: 0 }}>No se pudo cargar la revision: {error}</p>
      </div>
    );
  }

  return (
    <div>
      {error && <p style={{ color: 'var(--os-error)', fontSize: 12, marginBottom: 10 }}>{error}</p>}

      {/* Objetivos 90 dias (norte de la revision) */}
      <div className="os-card os-card-accent" style={{ marginBottom: '1rem' }}>
        <p className="os-eyebrow" style={{ margin: '0 0 0.75rem' }}>Norte · Objetivos 90 dias</p>
        {objetivos.length === 0 ? (
          <p style={{ fontSize: 12.5, color: 'var(--os-muted)', margin: 0 }}>Sin objetivos definidos todavia.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {objetivos.map((o, i) => (
              <div key={o.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span className="os-num" style={{ fontSize: 11, minWidth: 18, paddingTop: 1 }}>{i + 1}</span>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--os-text)' }}>{o.titulo}.</span>
                  {o.descripcion && <span style={{ fontSize: 12, color: 'var(--os-muted)', marginLeft: 5 }}>{o.descripcion}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="os-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>

        {/* Weekly review */}
        <div className="os-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--os-accent-light)' }}>event_repeat</span>
              <p className="os-section-title" style={{ margin: 0 }}>Weekly Review</p>
            </div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--os-muted)', margin: '0 0 1rem' }}>Editando periodo {pSemanal}</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <span style={labelStyle}>Completado (una linea por item)</span>
              <textarea style={textareaStyle} rows={4} value={linea(weekly.completado)}
                onChange={(e) => setWeekly((w) => ({ ...w, completado: desdeLinea(e.target.value) }))} />
            </div>
            <div>
              <span style={labelStyle}>Que parar</span>
              <textarea style={textareaStyle} rows={2} value={linea(weekly.que_parar)}
                onChange={(e) => setWeekly((w) => ({ ...w, que_parar: desdeLinea(e.target.value) }))} />
            </div>
            <div>
              <span style={labelStyle}>Que escalar</span>
              <textarea style={textareaStyle} rows={2} value={linea(weekly.que_escalar)}
                onChange={(e) => setWeekly((w) => ({ ...w, que_escalar: desdeLinea(e.target.value) }))} />
            </div>
            <div>
              <span style={labelStyle}>Energia</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['alta', 'media', 'baja'] as const).map((e) => (
                  <button key={e} onClick={() => setWeekly((w) => ({ ...w, energia: e }))}
                    className={weekly.energia === e ? 'os-pill os-pill-accent' : 'os-tag'}
                    style={{ cursor: 'pointer', border: 'none' }}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span style={labelStyle}>Nota</span>
              <textarea style={textareaStyle} rows={2} value={weekly.nota}
                onChange={(e) => setWeekly((w) => ({ ...w, nota: e.target.value }))} />
            </div>
            <button className="os-btn" disabled={guardandoW} onClick={guardarSemanal} style={{ alignSelf: 'flex-start' }}>
              {guardandoW ? 'Guardando...' : flashW ? 'Guardado' : 'Guardar semanal'}
            </button>
          </div>
        </div>

        {/* Monthly review */}
        <div className="os-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.375rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--os-accent-light)' }}>calendar_month</span>
            <p className="os-section-title" style={{ margin: 0 }}>Monthly Review</p>
          </div>
          <p style={{ fontSize: 12, color: 'var(--os-muted)', margin: '0 0 1rem' }}>Editando periodo {pMensual}</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <span style={labelStyle}>Numero destacado</span>
                <input style={inputStyle} value={monthly.numero_destacado}
                  onChange={(e) => setMonthly((m) => ({ ...m, numero_destacado: e.target.value }))} />
              </div>
              <div style={{ flex: 2 }}>
                <span style={labelStyle}>Label del numero</span>
                <input style={inputStyle} value={monthly.numero_label}
                  onChange={(e) => setMonthly((m) => ({ ...m, numero_label: e.target.value }))} />
              </div>
            </div>
            <div>
              <span style={labelStyle}>Wins del mes</span>
              <textarea style={textareaStyle} rows={3} value={linea(monthly.wins)}
                onChange={(e) => setMonthly((m) => ({ ...m, wins: desdeLinea(e.target.value) }))} />
            </div>
            <div>
              <span style={labelStyle}>Pendientes</span>
              <textarea style={textareaStyle} rows={3} value={linea(monthly.pendientes)}
                onChange={(e) => setMonthly((m) => ({ ...m, pendientes: desdeLinea(e.target.value) }))} />
            </div>
            <div>
              <span style={labelStyle}>Decision clave</span>
              <textarea style={textareaStyle} rows={2} value={monthly.decision_clave}
                onChange={(e) => setMonthly((m) => ({ ...m, decision_clave: e.target.value }))} />
            </div>
            <button className="os-btn" disabled={guardandoM} onClick={guardarMensual} style={{ alignSelf: 'flex-start' }}>
              {guardandoM ? 'Guardando...' : flashM ? 'Guardado' : 'Guardar mensual'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OSRevision() {
  return (
    <ToastProvider>
      <OSRevisionInner />
    </ToastProvider>
  );
}
