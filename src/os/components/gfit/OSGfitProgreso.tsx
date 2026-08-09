import { useEffect, useState } from 'react';
import type { UnidadPeso } from './tipos';
import { GRUPO_ES } from './tipos';
import { card, card2, btn, btnIcon, pill, chip, eyebrow } from './estilos';
import { EmptyState } from '../ui';
import { formatearPeso, kgALbs } from '../../../lib/gfit/unidades';

// ═══════════════════════════════════════════════════════════════════════════
// GFIT — tab Progreso (parity Jefit). Un solo golpe de datos desde
// /api/os/gfit/progreso + /api/os/gfit/logros. Ambos endpoints devuelven
// `breakdown3m` y `recovery` como diccionarios (Record<grupo, valor>), no
// arreglos — verificado contra la respuesta real del endpoint (ver
// lib/gfit/volumen.ts#muscleBreakdown y lib/gfit/recovery.ts#estadoRecuperacion).
// ═══════════════════════════════════════════════════════════════════════════

interface RangoDatos { total: number; porDia: { fecha: string; total: number }[] }

interface ProgresoData {
  calendario: string[];
  volumen: Record<string, RangoDatos>;
  tiempo: Record<string, RangoDatos>;
  breakdown3m: Record<string, number>;
  unoRm: { ejercicio_id: string; nombre: string; est_1rm: number }[];
  recovery: Record<string, { rate_pct: number; horas_restantes: number }>;
}

interface LogroObtenido { nivel: number; obtenido_at: string }
interface LogroApi {
  id: string;
  slug: string;
  nombre: string;
  descripcion: string;
  ciencia: string;
  premio_xp: number;
  premio_oro: number;
  orden: number | null;
  obtenidos: LogroObtenido[];
}
interface OtorgadoLogro { slug: string; nivel: number; nombre: string; premio_xp: number; premio_oro: number }

// ─── helpers de fecha / agregación ───────────────────────────────────────────

function claveSemana(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00`);
  const dia = (d.getDay() + 6) % 7; // lunes = 0
  d.setDate(d.getDate() - dia);
  return d.toLocaleDateString('en-CA');
}
function claveMes(fecha: string): string {
  return fecha.slice(0, 7); // YYYY-MM
}
function agregarPorClave(porDia: { fecha: string; total: number }[], claveFn: (f: string) => string): { fecha: string; total: number }[] {
  const mapa = new Map<string, number>();
  for (const p of porDia) mapa.set(claveFn(p.fecha), (mapa.get(claveFn(p.fecha)) ?? 0) + p.total);
  return Array.from(mapa.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([fecha, total]) => ({ fecha, total: Math.round(total * 100) / 100 }));
}
// 7d/14d: diario. 1m: semanal. 12m/all: mensual (mantiene el número de barras <= ~30).
function serieParaRango(rango: string, porDia: { fecha: string; total: number }[]): { fecha: string; total: number }[] {
  if (rango === '7d' || rango === '14d') return porDia;
  if (rango === '1m') return agregarPorClave(porDia, claveSemana);
  return agregarPorClave(porDia, claveMes);
}
function pesoAcumulado(totalKg: number, unidad: UnidadPeso): number {
  return Math.round(unidad === 'lb' ? kgALbs(totalKg) : totalKg);
}
function formatearFechaLogro(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'short' }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

// ─── mapeo de icono por logro (Material Symbols outlined) ────────────────────

const ICONO_LOGRO: Record<string, string> = {
  'racha-de-hierro': 'local_fire_department',
  'record-personal': 'military_tech',
  'primer-paso': 'flag',
  'reinicio-con-fuerza': 'restart_alt',
  'volumen-mil': 'fitness_center',
  'constancia-de-oro': 'verified',
  'doble-progresion': 'trending_up',
  'explorador-muscular': 'explore',
  'caja-sorpresa': 'redeem',
  antirrendicion: 'replay',
  'mentor-de-si-mismo': 'self_improvement',
  'ano-completo': 'calendar_month',
};
function iconoLogro(slug: string): string {
  if (ICONO_LOGRO[slug]) return ICONO_LOGRO[slug];
  if (slug.includes('racha')) return 'local_fire_department';
  if (slug.includes('record')) return 'military_tech';
  if (slug.includes('primer')) return 'flag';
  if (slug.includes('reinicio')) return 'restart_alt';
  if (slug.includes('volumen')) return 'fitness_center';
  if (slug.includes('constancia')) return 'verified';
  if (slug.includes('progresion')) return 'trending_up';
  if (slug.includes('explorador')) return 'explore';
  if (slug.includes('sorpresa')) return 'redeem';
  if (slug.includes('rendicion')) return 'replay';
  if (slug.includes('mentor')) return 'self_improvement';
  if (slug.includes('ano') || slug.includes('completo')) return 'calendar_month';
  return 'emoji_events';
}

const GRUPOS_RECOVERY = Object.keys(GRUPO_ES).filter((g) => g !== 'cardio');
const PILLS_RANGO: { key: string; label: string }[] = [
  { key: 'r7d', label: '7d' }, { key: 'r14d', label: '14d' }, { key: 'r1m', label: '1m' }, { key: 'r12m', label: '12m' }, { key: 'all', label: 'Todo' },
];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

// ═══════════════════════════════════════════════════════════════════════════
// Sub-componentes
// ═══════════════════════════════════════════════════════════════════════════

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={card}>
      <p style={{ ...eyebrow, marginBottom: 10 }}>{titulo}</p>
      {children}
    </div>
  );
}

function CalendarioMes({ fechasEntrenadas }: { fechasEntrenadas: Set<string> }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const hoyStr = new Date().toLocaleDateString('en-CA');
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const primerDia = new Date(year, month, 1);
  const offset = (primerDia.getDay() + 6) % 7; // lunes = 0
  const diasEnMes = new Date(year, month + 1, 0).getDate();

  const celdas: Array<{ fecha: string | null; dia: number | null }> = [];
  for (let i = 0; i < offset; i++) celdas.push({ fecha: null, dia: null });
  for (let d = 1; d <= diasEnMes; d++) {
    celdas.push({ fecha: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, dia: d });
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <button style={{ ...btnIcon, width: 30, height: 30 }} onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))} aria-label="Mes anterior">
          <span className="material-symbols-outlined" style={{ fontSize: 17 }}>chevron_left</span>
        </button>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--os-text)', margin: 0, textTransform: 'capitalize' }}>{MESES[month]} {year}</p>
        <button style={{ ...btnIcon, width: 30, height: 30 }} onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))} aria-label="Mes siguiente">
          <span className="material-symbols-outlined" style={{ fontSize: 17 }}>chevron_right</span>
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 4 }}>
        {DIAS_SEMANA.map((d) => <span key={d} style={{ fontSize: 11, color: 'var(--os-muted)', textAlign: 'center' }}>{d}</span>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
        {celdas.map((c, i) => {
          if (!c.fecha) return <span key={`vacio-${i}`} />;
          const entrenado = fechasEntrenadas.has(c.fecha);
          const esHoy = c.fecha === hoyStr;
          return (
            <div key={c.fecha} style={{
              aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7,
              fontSize: 11, fontWeight: 700, boxSizing: 'border-box',
              background: entrenado ? 'var(--os-accent)' : 'var(--os-fill-subtle)',
              color: entrenado ? '#fff' : 'var(--os-text-2)',
              border: esHoy ? '2px solid var(--os-accent)' : '2px solid transparent',
            }}>{c.dia}</div>
          );
        })}
      </div>
    </div>
  );
}

function BarrasVerticales({ datos, unidad, tipo }: { datos: { fecha: string; total: number }[]; unidad: UnidadPeso; tipo: 'kg' | 'min' }) {
  if (!datos.length) return <EmptyState icon="bar_chart" title="Sin datos en este rango" text="Completa sesiones para ver la comparativa." />;
  const max = Math.max(1, ...datos.map((d) => d.total));
  const W = Math.max(160, datos.length * 20);
  const H = 84;
  const gap = 4;
  const barW = Math.max(3, (W - gap * (datos.length - 1)) / datos.length);
  return (
    <div className="os-hscroll">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ minWidth: Math.min(W, 280), display: 'block' }}>
        {datos.map((d, i) => {
          const x = i * (barW + gap);
          const bh = Math.max(1.5, (d.total / max) * (H - 6));
          const y = H - bh;
          const valorTexto = tipo === 'kg' ? `${pesoAcumulado(d.total, unidad)} ${unidad}` : `${Math.round(d.total)} min`;
          return (
            <rect key={d.fecha} x={x} y={y} width={barW} height={bh} rx={2} fill="var(--os-champagne)">
              <title>{`${d.fecha}: ${valorTexto}`}</title>
            </rect>
          );
        })}
      </svg>
    </div>
  );
}

function TarjetaComparativa({ titulo, tipo, datosPorRango, unidad }: {
  titulo: string; tipo: 'kg' | 'min'; datosPorRango: Record<string, RangoDatos>; unidad: UnidadPeso;
}) {
  const [abierta, setAbierta] = useState(false);
  const [rango, setRango] = useState('r7d');
  const semana = datosPorRango.r7d ?? { total: 0, porDia: [] };
  const actual = datosPorRango[rango] ?? { total: 0, porDia: [] };
  const serie = serieParaRango(rango, actual.porDia);
  const totalTexto = tipo === 'kg' ? `${pesoAcumulado(semana.total, unidad)} ${unidad}` : `${Math.round(semana.total)} min`;

  return (
    <div style={card2}>
      <div
        role="button" tabIndex={0} aria-expanded={abierta}
        style={{ display: 'flex', flexDirection: 'column', gap: 4, cursor: 'pointer' }}
        onClick={() => setAbierta((v) => !v)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAbierta((v) => !v); } }}
      >
        <p style={eyebrow}>{titulo}</p>
        <p style={{ fontFamily: 'var(--os-font-rounded)', fontSize: 25, fontWeight: 800, color: 'var(--os-text)', margin: 0 }}>{totalTexto}</p>
      </div>
      {abierta && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }} onClick={(e) => e.stopPropagation()}>
          <div className="os-hscroll" style={{ display: 'flex', gap: 4 }}>
            {PILLS_RANGO.map((r) => (
              <button key={r.key} style={{ ...pill(rango === r.key), padding: '6px 11px', minHeight: 36, fontSize: 11 }} onClick={() => setRango(r.key)}>{r.label}</button>
            ))}
          </div>
          <BarrasVerticales datos={serie} unidad={unidad} tipo={tipo} />
          <p style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', margin: 0 }}>
            {tipo === 'kg' ? `${pesoAcumulado(actual.total, unidad)} ${unidad}` : `${Math.round(actual.total)} min`} en el rango seleccionado
          </p>
        </div>
      )}
    </div>
  );
}

function BreakdownMuscular({ datos }: { datos: Record<string, number> }) {
  const filas = Object.entries(datos)
    .map(([grupo, sets]) => ({ grupo, sets, label: GRUPO_ES[grupo] ?? grupo }))
    .sort((a, b) => b.sets - a.sets);
  if (!filas.length) return <EmptyState icon="exercise" title="Sin series registradas" text="No hay series en los últimos 3 meses." />;
  const max = Math.max(1, ...filas.map((f) => f.sets));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {filas.map((f) => (
        <div key={f.grupo}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--os-text-xs)', marginBottom: 3 }}>
            <span style={{ color: 'var(--os-text-2)', fontWeight: 600 }}>{f.label}</span>
            <span style={{ color: 'var(--os-muted)' }}>{f.sets} sets</span>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: 'var(--os-fill-subtle)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(f.sets / max) * 100}%`, background: 'var(--os-accent)', borderRadius: 999 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ListaUnoRm({ datos, unidad }: { datos: { ejercicio_id: string; nombre: string; est_1rm: number }[]; unidad: UnidadPeso }) {
  if (!datos.length) return <EmptyState icon="military_tech" title="Sin 1RM estimado" text="Aún no hay suficientes datos para estimar tu 1RM." />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {datos.map((u) => (
        <div key={u.ejercicio_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--os-line-soft)' }}>
          <span style={{ fontSize: 'var(--os-text-sm)', color: 'var(--os-text)', fontWeight: 600 }}>{u.nombre}</span>
          <span style={{ fontFamily: 'var(--os-font-rounded)', fontSize: 17, fontWeight: 800, color: 'var(--os-champagne)' }}>
            {formatearPeso(u.est_1rm, unidad)} <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--os-muted)' }}>{unidad}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function TablaRecovery({ recovery }: { recovery: Record<string, { rate_pct: number; horas_restantes: number }> }) {
  const filas = GRUPOS_RECOVERY
    .map((g) => {
      const r = recovery[g];
      return { grupo: g, label: GRUPO_ES[g] ?? g, rate_pct: r?.rate_pct ?? 100, horas_restantes: r?.horas_restantes ?? 0 };
    })
    .sort((a, b) => a.rate_pct - b.rate_pct);

  const th: React.CSSProperties = { textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--os-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 4px 8px', borderBottom: '1px solid var(--os-line-soft)' };
  const td: React.CSSProperties = { padding: '7px 4px', borderBottom: '1px solid var(--os-line-soft)', color: 'var(--os-text-2)', fontSize: 'var(--os-text-xs)' };

  return (
    <div className="os-hscroll">
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 280 }}>
        <thead>
          <tr>
            <th style={th}>Músculo</th>
            <th style={th}>Recuperación</th>
            <th style={{ ...th, textAlign: 'right' }}>Tiempo restante</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => {
            const color = f.rate_pct >= 95 ? 'var(--os-champagne)' : f.rate_pct < 30 ? 'var(--os-error)' : 'var(--os-accent)';
            const tiempoTexto = f.rate_pct >= 95 ? 'Recuperado' : `${Math.round(f.horas_restantes)} h`;
            return (
              <tr key={f.grupo}>
                <td style={td}>{f.label}</td>
                <td style={td}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ flex: 1, height: 8, borderRadius: 999, background: 'var(--os-fill-subtle)', overflow: 'hidden', minWidth: 60 }}>
                      <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, f.rate_pct))}%`, background: color, borderRadius: 999 }} />
                    </div>
                    <span style={{ fontSize: 11, color, fontWeight: 700, width: 34, textAlign: 'right', flexShrink: 0 }}>{Math.round(f.rate_pct)}%</span>
                  </div>
                </td>
                <td style={{ ...td, textAlign: 'right', color: f.rate_pct >= 95 ? 'var(--os-champagne)' : 'var(--os-muted)', fontWeight: f.rate_pct >= 95 ? 700 : 400 }}>{tiempoTexto}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function LogroCard({ logro }: { logro: LogroApi }) {
  const [abierto, setAbierto] = useState(false);
  const obtenido = (logro.obtenidos ?? []).length > 0;
  const ultimo = obtenido ? logro.obtenidos[logro.obtenidos.length - 1] : null;
  return (
    <div
      style={{ ...card2, padding: 10, display: 'flex', flexDirection: 'column', gap: 8, cursor: 'pointer' }}
      role="button" tabIndex={0} aria-expanded={abierto}
      onClick={() => setAbierto((v) => !v)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAbierto((v) => !v); } }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          background: obtenido ? 'rgba(181,152,90,0.16)' : 'var(--os-fill-subtle)',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: obtenido ? 'var(--os-champagne)' : 'var(--os-muted)' }}>{iconoLogro(logro.slug)}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 'var(--os-text-xs)', fontWeight: 700, margin: 0, color: obtenido ? 'var(--os-text)' : 'var(--os-muted)', lineHeight: 1.25 }}>{logro.nombre}</p>
          {obtenido && ultimo ? (
            <p style={{ fontSize: 11, color: 'var(--os-champagne)', margin: '2px 0 0', fontWeight: 700 }}>Obtenido · {formatearFechaLogro(ultimo.obtenido_at)}</p>
          ) : (
            <span style={{ ...chip, color: 'var(--os-muted)', background: 'var(--os-fill-subtle)', marginTop: 3 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 11 }}>lock</span> Bloqueado
            </span>
          )}
        </div>
      </div>
      {abierto && (
        <div style={{ borderTop: '1px solid var(--os-line-soft)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <p style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-text-2)', margin: 0, lineHeight: 1.4 }}>{logro.descripcion}</p>
          <p style={{ fontSize: 11, color: 'var(--os-muted)', fontStyle: 'italic', margin: 0, lineHeight: 1.4 }}>{logro.ciencia}</p>
          <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
            <span className="os-pill os-pill-accent">+{logro.premio_xp} XP</span>
            <span className="os-pill os-pill-gold">+{logro.premio_oro} oro</span>
          </div>
        </div>
      )}
    </div>
  );
}

function GridLogros({ logros }: { logros: LogroApi[] }) {
  if (!logros.length) return <EmptyState icon="emoji_events" title="Sin logros disponibles" text="Los logros aparecerán cuando entrenes." />;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
      {logros.map((l) => <LogroCard key={l.id} logro={l} />)}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Componente principal
// ═══════════════════════════════════════════════════════════════════════════

export default function OSGfitProgreso({ unidad }: { unidad: UnidadPeso }) {
  const [data, setData] = useState<ProgresoData | null>(null);
  const [logros, setLogros] = useState<LogroApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function cargar() {
    setLoading(true);
    setError('');
    try {
      const [resProgreso, resLogros] = await Promise.all([
        fetch('/api/os/gfit/progreso'),
        fetch('/api/os/gfit/logros'),
      ]);
      const dataProgreso = await resProgreso.json();
      const dataLogros = await resLogros.json();
      if (dataProgreso.error) throw new Error(dataProgreso.error);
      if (dataLogros.error) throw new Error(dataLogros.error);
      setData(dataProgreso);
      setLogros(dataLogros.logros ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el progreso.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargar();
    let cancelado = false;

    // Evalúa logros nuevos en segundo plano (fire-and-forget): si hay otorgados,
    // dispara el evento de XP/oro (para que OSJugadorBar anime) y refresca la lista.
    (async () => {
      try {
        const res = await fetch('/api/os/gfit/logros', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ evaluar: true }),
        });
        const data: { otorgados?: OtorgadoLogro[] } = await res.json();
        if (cancelado || !data.otorgados?.length) return;
        const xp = data.otorgados.reduce((a, o) => a + (o.premio_xp ?? 0), 0);
        const oro = data.otorgados.reduce((a, o) => a + (o.premio_oro ?? 0), 0);
        window.dispatchEvent(new CustomEvent('os:xp', { detail: { xp, oro } }));
        const r = await fetch('/api/os/gfit/logros');
        const d = await r.json();
        if (!cancelado) setLogros(d.logros ?? []);
      } catch {
        // evaluación de logros es best-effort: si falla, la pantalla ya cargó igual.
      }
    })();

    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[0, 1, 2, 3].map((i) => <div key={i} className="os-pulse-dot" style={{ ...card, height: i === 0 ? 150 : 90 }} />)}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={card}>
        <EmptyState
          icon="cloud_off"
          title="No pudimos cargar tu progreso"
          text="Intenta de nuevo en un momento."
          action={<button style={btn} onClick={cargar}>Reintentar</button>}
        />
      </div>
    );
  }

  const fechasEntrenadas = new Set(data.calendario);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <Seccion titulo="Consistencia">
        <CalendarioMes fechasEntrenadas={fechasEntrenadas} />
      </Seccion>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <TarjetaComparativa titulo="Volumen esta semana" tipo="kg" datosPorRango={data.volumen} unidad={unidad} />
        <TarjetaComparativa titulo="Tiempo esta semana" tipo="min" datosPorRango={data.tiempo} unidad={unidad} />
      </div>

      <Seccion titulo="Grupos musculares · últimos 3 meses">
        <BreakdownMuscular datos={data.breakdown3m} />
      </Seccion>

      <Seccion titulo="1RM estimado">
        <ListaUnoRm datos={data.unoRm} unidad={unidad} />
      </Seccion>

      <Seccion titulo="Recuperación muscular">
        <TablaRecovery recovery={data.recovery} />
      </Seccion>

      <Seccion titulo="Logros">
        <GridLogros logros={logros} />
      </Seccion>
    </div>
  );
}
