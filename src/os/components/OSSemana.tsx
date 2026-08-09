import { useEffect, useState, type CSSProperties } from 'react';
import { Spinner } from './ui';

// Vista Semana: la metodologia modo x funcion, hecha visible.
//
// Maker/Manager y promover/vender/construir/entregar son ejes ORTOGONALES:
//   * el MODO (forma de atencion) vive en el DIA,
//   * la FUNCION (etapa de la cadena de valor) vive en el BLOQUE,
//   * y la CARA de cada bloque se DERIVA del cruce. Por eso el mismo bloque
//     "vender" propone cosas distintas el martes (manager) que el viernes (maker).
// El balance se cuadra por SEMANA y no por dia, porque partir cada dia en tres
// fragmentaria el dia Maker, que es justo lo que Maker/Manager existe para evitar.
//
// Toda la derivacion la hace /api/os/semana; aca solo se pinta.

const card: CSSProperties = {
  background: 'var(--os-surface)', border: 'none', borderRadius: 'var(--os-r-card)',
  boxShadow: 'var(--os-shadow-card)', padding: '1rem',
};
const card2: CSSProperties = {
  ...card, background: 'var(--os-surface-2)', boxShadow: 'none',
  border: '1px solid var(--os-line-soft)', padding: '0.85rem',
};
const btnGhost: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  background: 'var(--os-fill-subtle)', color: 'var(--os-text-2)', border: '1px solid var(--os-line)',
  borderRadius: 'var(--os-r-sm)', padding: '9px 13px', minHeight: 40, fontSize: 12.5, cursor: 'pointer',
};

const DIAS_LARGO = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];

const MODO_LABEL: Record<string, string> = { maker: 'Maker', manager: 'Manager', off: 'Off' };
// El modo pinta la forma de atencion, no un juicio de valor: ambos son necesarios.
const MODO_COLOR: Record<string, string> = {
  maker: 'var(--os-accent)',
  manager: 'var(--os-accent-light)',
  off: 'var(--os-muted)',
};

const FUNCION_LABEL: Record<string, string> = {
  promover: 'Promover', vender: 'Vender', construir: 'Construir', entregar: 'Entregar',
};
const FUNCION_ICONO: Record<string, string> = {
  promover: 'campaign', vender: 'handshake', construir: 'build', entregar: 'local_shipping',
};

interface Bloque {
  id: string; orden: number; funcion: string;
  hora_inicio: string | null; hora_fin: string | null;
  minutos: number; cara: string | null; acciones: string[];
}
interface Dia {
  dia: number; modo: string; sale: boolean; etiqueta: string | null; nota: string | null;
  bloques: Bloque[];
}
interface Balance {
  funcion: string; horas_objetivo: number; horas_planificadas: number;
  horas_reales: number; pct_real: number | null;
}
interface Aviso { nivel: string; funcion: string; mensaje: string }
interface Data {
  semana_inicio: string; semana_fin: string; dias: Dia[]; balance: Balance[]; avisos: Aviso[];
}

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null);

export default function OSSemana() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [abierto, setAbierto] = useState<string | null>(null);

  async function cargar() {
    try {
      const res = await fetch('/api/os/semana', { cache: 'no-store' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || String(res.status));
      setData(d);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }
  useEffect(() => { cargar(); }, []);

  async function registrar(funcion: string, minutos: number) {
    try {
      const res = await fetch('/api/os/semana', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ log: { funcion, minutos } }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || String(res.status));
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (error && !data) {
    return <div style={card}><p style={{ color: 'var(--os-error)', fontSize: 13, margin: 0 }}>No se pudo cargar la semana: {error}</p></div>;
  }
  if (!data) {
    return <Spinner label="Cargando la semana..." />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* Avisos. Separan a proposito el fallo de DISENO del de EJECUCION. */}
      {data.avisos.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.avisos.map((a, i) => (
            <div key={i} style={{
              ...card2,
              borderLeft: `3px solid ${a.nivel === 'alerta' ? 'var(--os-error)' : 'var(--os-muted)'}`,
              display: 'flex', gap: 10, alignItems: 'flex-start',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: a.nivel === 'alerta' ? 'var(--os-error)' : 'var(--os-muted)', flexShrink: 0 }}>
                {a.nivel === 'alerta' ? 'priority_high' : 'info'}
              </span>
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--os-text-2)', lineHeight: 1.5 }}>{a.mensaje}</p>
            </div>
          ))}
        </div>
      )}

      {/* Balance semanal: objetivo vs planificado vs real. */}
      <div style={card}>
        <p className="os-eyebrow" style={{ marginBottom: 4 }}>Balance de la semana</p>
        <p style={{ fontSize: 12, color: 'var(--os-muted)', margin: '0 0 12px', lineHeight: 1.5 }}>
          El objetivo es lo que quieres darle. Lo planificado es lo que tu semana disenada le da.
          Lo real es lo que le diste. Si lo planificado no llega al objetivo, el problema es el
          diseno de la semana, no la disciplina.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {data.balance.map((b) => {
            const pct = b.horas_objetivo > 0 ? Math.min(100, (b.horas_reales / b.horas_objetivo) * 100) : 0;
            const pctPlan = b.horas_objetivo > 0 ? Math.min(100, (b.horas_planificadas / b.horas_objetivo) * 100) : 0;
            const completo = b.horas_objetivo > 0 && b.horas_reales >= b.horas_objetivo;
            return (
              <div key={b.funcion}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 17, color: 'var(--os-muted)' }}>
                    {FUNCION_ICONO[b.funcion]}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--os-text)', flex: 1 }}>
                    {FUNCION_LABEL[b.funcion]}
                  </span>
                  <span style={{ fontSize: 12, color: completo ? 'var(--os-champagne)' : 'var(--os-text-2)', fontWeight: 700 }}>
                    {b.horas_reales}h / {b.horas_objetivo}h
                  </span>
                </div>
                {/* Barra: real (relleno) sobre planificado (marca). */}
                <div style={{ position: 'relative', height: 8, borderRadius: 999, background: 'var(--os-fill-subtle)', overflow: 'hidden' }}>
                  <div style={{
                    position: 'absolute', inset: 0, width: `${pct}%`, borderRadius: 999,
                    background: completo ? 'var(--os-champagne)' : 'var(--os-accent)', transition: 'width .3s ease',
                  }} />
                  <div title={`Planificado: ${b.horas_planificadas}h`} style={{
                    position: 'absolute', top: -2, bottom: -2, left: `calc(${pctPlan}% - 1px)`,
                    width: 2, background: 'var(--os-text-2)', opacity: 0.55,
                  }} />
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--os-muted)', flex: 1 }}>
                    Planificado {b.horas_planificadas}h
                  </span>
                  <button type="button" style={{ ...btnGhost, minHeight: 36, padding: '4px 10px', fontSize: 11 }}
                    onClick={() => registrar(b.funcion, 30)}>+30 min</button>
                  <button type="button" style={{ ...btnGhost, minHeight: 36, padding: '4px 10px', fontSize: 11 }}
                    onClick={() => registrar(b.funcion, 60)}>+1 h</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Los 7 dias. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {data.dias.map((d) => {
          const off = d.modo === 'off';
          return (
            <div key={d.dia} style={{ ...card, opacity: off ? 0.75 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'var(--os-font-rounded)', fontSize: 15, fontWeight: 800, color: 'var(--os-text)' }}>
                  {DIAS_LARGO[d.dia - 1]}
                </span>
                <span style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase',
                  color: MODO_COLOR[d.modo], border: `1px solid ${MODO_COLOR[d.modo]}`,
                  borderRadius: 999, padding: '2px 8px',
                }}>{MODO_LABEL[d.modo]}</span>
                {d.sale && (
                  <span style={{ fontSize: 11, color: 'var(--os-muted)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>directions_car</span>
                    sale
                  </span>
                )}
                <span style={{ flex: 1 }} />
                {d.etiqueta && <span style={{ fontSize: 11.5, color: 'var(--os-muted)' }}>{d.etiqueta}</span>}
              </div>

              {off ? (
                <p style={{ margin: '8px 0 0', fontSize: 12.5, color: 'var(--os-muted)', lineHeight: 1.5 }}>
                  {d.nota || 'Descanso.'} Un dia off no tiene funciones: no propone nada a proposito.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                  {d.bloques.map((b) => {
                    const k = `${d.dia}-${b.id}`;
                    const open = abierto === k;
                    return (
                      <div key={b.id} style={card2}>
                        <button type="button" onClick={() => setAbierto(open ? null : k)}
                          style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--os-accent)', flexShrink: 0 }}>
                            {FUNCION_ICONO[b.funcion]}
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--os-text)' }}>
                            {FUNCION_LABEL[b.funcion]}
                          </span>
                          {hhmm(b.hora_inicio) && (
                            <span style={{ fontSize: 11.5, color: 'var(--os-muted)' }}>
                              {hhmm(b.hora_inicio)} a {hhmm(b.hora_fin)}
                            </span>
                          )}
                          <span style={{ flex: 1 }} />
                          {/* La cara derivada: la prueba visible de que el eje es ortogonal. */}
                          <span style={{ fontSize: 11, color: 'var(--os-muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                            cara {b.cara}
                          </span>
                          <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--os-muted)' }}>
                            {open ? 'expand_less' : 'expand_more'}
                          </span>
                        </button>
                        {open && (
                          <ul style={{ margin: '9px 0 0', paddingLeft: 26, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {b.acciones.map((a) => (
                              <li key={a} style={{ fontSize: 12.5, color: 'var(--os-text-2)', lineHeight: 1.5 }}>{a}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {error && <p style={{ color: 'var(--os-error)', fontSize: 12, margin: 0 }}>{error}</p>}
    </div>
  );
}
