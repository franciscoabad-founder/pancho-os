import { useEffect, useMemo, useState } from 'react';
import { Button, EmptyState, Sheet, Spinner, ToastProvider, useConfirm, useToast } from '../ui';
import { formatearHoras } from '../../../lib/sueno/deuda';
import { formatearHora } from '../../../lib/sueno/modelo';
import type { Ventana } from '../../../lib/sueno/ventanas';
import type { PlanSueno } from '../../../lib/sueno/plan';

/**
 * Modulo Sueno: modelo de dos procesos (Borbely) aplicado al dia de hoy.
 * Todo el calculo vive en el servidor (/api/os/salud/sueno/hoy); aqui solo se
 * pinta y se registra.
 */

interface Sesion {
  id: string; fecha: string; inicio: string; fin: string; minutos: number;
  siesta: boolean; calidad: number | null; fuente: string; notas: string | null;
}
interface DosisFila { id: string; fecha: string; tomado_at: string; mg: number; bebida: string | null }
interface Estado {
  hoy: string;
  config: Record<string, unknown> & {
    necesidad_h: number; necesidad_auto: boolean; hora_dormir: string; hora_despertar: string;
    deuda_objetivo_h: number; siestas_ok: boolean; cafeina_vida_media_h: number; cafeina_umbral_mg: number;
  };
  necesidad: { horas: number; origen: 'auto' | 'config' };
  deuda: {
    horas: number; noches: number; tope: number; topeAlcanzado: boolean; diasSinDato: number;
    promedioHoras: number; nivel: 'saldada' | 'baja' | 'media' | 'alta';
    dias: { fecha: string; horas: number; delta: number; sinDato: boolean }[];
  };
  anclas: { hora_despertar: number; hora_dormir: number; tmin: number; despertar_real: boolean };
  curva: { hora: number; ms: number; alerta: number }[];
  ahora: { hora: number; alerta: number; ventana: string | null } | null;
  ventanas: Ventana[];
  siesta: { desde: number; hasta: number; minutos: number; etiqueta: string; motivo: string } | null;
  cafeina: {
    vida_media_h: number; umbral_mg: number; mg_ahora: number; mg_al_dormir: number;
    total_hoy_mg: number; hora_corte: number | null; dosis: DosisFila[];
  };
  sesiones: Sesion[];
  plan: PlanSueno;
  resumen: string;
}

const TZ_OFFSET = '-05:00';
const card: React.CSSProperties = {
  background: 'var(--os-surface-2)', border: '1px solid var(--os-line-soft)',
  borderRadius: 'var(--os-r-card)', padding: '1rem',
};
const rotulo: React.CSSProperties = {
  fontFamily: 'var(--os-font-display)', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
  textTransform: 'uppercase', color: 'var(--os-muted)', margin: 0,
};
const input: React.CSSProperties = {
  background: 'var(--os-fill-subtle)', border: '1px solid var(--os-line)', borderRadius: 'var(--os-r-sm)',
  padding: '7px 10px', fontSize: 'var(--os-text-sm)', color: 'var(--os-text)',
  fontFamily: 'var(--os-font-body)', outline: 'none', width: '100%', minHeight: 40,
};

const COLOR_NIVEL: Record<Estado['deuda']['nivel'], string> = {
  saldada: 'var(--os-champagne)', baja: 'var(--os-champagne)',
  media: 'var(--os-warn)', alta: 'var(--os-error)',
};
const TEXTO_NIVEL: Record<Estado['deuda']['nivel'], string> = {
  saldada: 'Deuda saldada', baja: 'Deuda baja', media: 'Deuda media', alta: 'Deuda alta',
};
const COLOR_VENTANA: Record<string, string> = {
  inercia: 'rgba(107,114,128,0.16)',
  pico_manana: 'rgba(59,78,217,0.14)',
  bajon_tarde: 'rgba(212,83,126,0.12)',
  segundo_aire: 'rgba(59,78,217,0.09)',
  melatonina: 'rgba(181,152,90,0.16)',
  sueno: 'rgba(181,152,90,0.24)',
};

const hoyISO = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' });
const restar1 = (f: string) => { const d = new Date(`${f}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };
const horaHHMM = (t: string) => (typeof t === 'string' ? t.slice(0, 5) : '');
const soloHora = (iso: string) => new Date(iso).toLocaleTimeString('es-EC', { timeZone: 'America/Guayaquil', hour: '2-digit', minute: '2-digit', hour12: false });

// ── Curva de energia del dia ────────────────────────────────────────────────

function CurvaDia({ estado }: { estado: Estado }) {
  const { curva, ventanas, ahora } = estado;
  if (curva.length < 2) return <EmptyState icon="bedtime" title="Sin curva" text="Falta configurar el horario de sueno." />;

  const W = 720, H = 200, padX = 34, padY = 16;
  const h0 = curva[0].hora, h1 = curva[curva.length - 1].hora;
  const x = (h: number) => padX + ((h - h0) / (h1 - h0)) * (W - padX * 2);
  const y = (a: number) => padY + (1 - a / 100) * (H - padY * 2 - 16);

  const linea = curva.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.hora).toFixed(1)} ${y(p.alerta).toFixed(1)}`).join(' ');
  const area = `${linea} L ${x(h1).toFixed(1)} ${(H - padY).toFixed(1)} L ${x(h0).toFixed(1)} ${(H - padY).toFixed(1)} Z`;

  const ticks: number[] = [];
  for (let h = Math.ceil(h0); h <= h1; h++) if (h % 3 === 0) ticks.push(h);

  return (
    <div className="os-hscroll">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 320, display: 'block' }} role="img" aria-label="Curva de energia del dia">
        <defs>
          <linearGradient id="gradAlerta" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--os-accent)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--os-accent)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {ventanas.filter((v) => COLOR_VENTANA[v.clave]).map((v) => {
          const desde = Math.max(v.desde, h0), hasta = Math.min(v.hasta, h1);
          if (hasta <= desde) return null;
          return (
            <rect key={v.clave} x={x(desde)} y={padY} width={Math.max(1, x(hasta) - x(desde))}
              height={H - padY * 2 - 16} fill={COLOR_VENTANA[v.clave]} />
          );
        })}

        {[25, 50, 75].map((a) => (
          <line key={a} x1={padX} x2={W - padX} y1={y(a)} y2={y(a)} stroke="var(--os-line-soft)" strokeWidth="1" />
        ))}

        <path d={area} fill="url(#gradAlerta)" />
        <path d={linea} fill="none" stroke="var(--os-accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

        {ventanas.filter((v) => v.pico != null && v.pico >= h0 && v.pico <= h1).map((v) => (
          <g key={`p-${v.clave}`}>
            <circle cx={x(v.pico!)} cy={y(v.alerta ?? 50)} r="4"
              fill={v.clave === 'bajon_tarde' ? 'var(--os-error)' : 'var(--os-champagne)'} />
            <text x={x(v.pico!)} y={y(v.alerta ?? 50) - 9} textAnchor="middle"
              style={{ fontSize: 10, fill: 'var(--os-muted)', fontFamily: 'var(--os-font-mono)' }}>
              {formatearHora(v.pico!)}
            </text>
          </g>
        ))}

        {ahora && ahora.hora >= h0 && ahora.hora <= h1 && (
          <g>
            <line x1={x(ahora.hora)} x2={x(ahora.hora)} y1={padY} y2={H - padY - 16}
              stroke="var(--os-text)" strokeWidth="1.5" strokeDasharray="3 3" />
            <circle cx={x(ahora.hora)} cy={y(ahora.alerta)} r="5" fill="var(--os-text)" />
          </g>
        )}

        {ticks.map((h) => (
          <text key={h} x={x(h)} y={H - 2} textAnchor="middle"
            style={{ fontSize: 10, fill: 'var(--os-muted)', fontFamily: 'var(--os-font-mono)' }}>
            {formatearHora(h)}
          </text>
        ))}
        {[0, 50, 100].map((a) => (
          <text key={a} x={padX - 6} y={y(a) + 3} textAnchor="end"
            style={{ fontSize: 9, fill: 'var(--os-muted)', fontFamily: 'var(--os-font-mono)' }}>{a}</text>
        ))}
      </svg>
    </div>
  );
}

// ── Historial de noches ─────────────────────────────────────────────────────

function Historial({ dias, necesidad }: { dias: Estado['deuda']['dias']; necesidad: number }) {
  const max = Math.max(necesidad + 2, ...dias.map((d) => d.horas));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 96 }}>
      {dias.map((d) => {
        const alto = Math.max(2, (d.horas / max) * 80);
        const color = d.sinDato ? 'var(--os-line)' : d.delta < 0 ? 'var(--os-error)' : 'var(--os-champagne)';
        return (
          <div key={d.fecha} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}
            title={d.sinDato ? `${d.fecha}: sin registro` : `${d.fecha}: ${formatearHoras(d.horas)} (${d.delta > 0 ? '+' : ''}${d.delta} h)`}>
            <div style={{ width: '100%', height: alto, background: color, borderRadius: 3, opacity: d.sinDato ? 0.5 : 1 }} />
            <span style={{ fontSize: 9, color: 'var(--os-muted)', fontFamily: 'var(--os-font-mono)' }}>{d.fecha.slice(8)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Componente principal ────────────────────────────────────────────────────

function OSSaludSuenoInner() {
  const { confirm, sheet } = useConfirm();
  const toast = useToast();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [abrirConfig, setAbrirConfig] = useState(false);
  const [form, setForm] = useState({ fecha: hoyISO(), acostarse: '23:00', despertar: '07:00', calidad: '', siesta: false });
  const [cfg, setCfg] = useState({ necesidad_h: '', necesidad_auto: true, hora_dormir: '', hora_despertar: '', deuda_objetivo_h: '', siestas_ok: true, cafeina_vida_media_h: '', cafeina_umbral_mg: '' });

  async function cargar() {
    setLoading(true);
    try {
      const data = await fetch('/api/os/salud/sueno/hoy').then((r) => r.json());
      if (data.error) { setError(data.error); return; }
      setEstado(data);
      setError('');
      setForm((f) => ({
        ...f,
        acostarse: horaHHMM(data.config.hora_dormir),
        despertar: horaHHMM(data.config.hora_despertar),
      }));
      setCfg({
        necesidad_h: String(data.config.necesidad_h),
        necesidad_auto: data.config.necesidad_auto,
        hora_dormir: horaHHMM(data.config.hora_dormir),
        hora_despertar: horaHHMM(data.config.hora_despertar),
        deuda_objetivo_h: String(data.config.deuda_objetivo_h),
        siestas_ok: data.config.siestas_ok,
        cafeina_vida_media_h: String(data.config.cafeina_vida_media_h),
        cafeina_umbral_mg: String(data.config.cafeina_umbral_mg),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el estado de sueno');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { cargar(); }, []);

  async function registrarSueno() {
    if (!form.acostarse || !form.despertar) { toast.show('Faltan las horas', 'error'); return; }
    // Si la hora de acostarse es mayor que la de despertar, la noche empezo el
    // dia anterior. Si es menor (ej. siesta 14:00-14:20), es el mismo dia.
    const cruzaMedianoche = form.acostarse > form.despertar;
    const fechaInicio = cruzaMedianoche ? restar1(form.fecha) : form.fecha;
    setGuardando(true);
    try {
      const res = await fetch('/api/os/salud/sueno', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha: form.fecha,
          inicio: `${fechaInicio}T${form.acostarse}:00${TZ_OFFSET}`,
          fin: `${form.fecha}T${form.despertar}:00${TZ_OFFSET}`,
          calidad: form.calidad || null,
          siesta: form.siesta,
        }),
      });
      const data = await res.json();
      if (data.error) { toast.show(data.error, 'error'); return; }
      toast.show(form.siesta ? 'Siesta registrada' : 'Noche registrada', 'ok');
      setForm((f) => ({ ...f, calidad: '', siesta: false }));
      cargar();
    } finally {
      setGuardando(false);
    }
  }

  async function registrarCafe(mg: number, bebida: string) {
    const res = await fetch('/api/os/salud/sueno/cafeina', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mg, bebida }),
    });
    const data = await res.json();
    if (data.error) { toast.show(data.error, 'error'); return; }
    toast.show(`${mg} mg registrados`, 'ok');
    cargar();
  }

  async function borrarSesion(id: string) {
    if (!(await confirm({ title: 'Borrar registro', text: 'Esta accion no se puede deshacer.', confirmLabel: 'Borrar', danger: true }))) return;
    await fetch(`/api/os/salud/sueno?id=${id}`, { method: 'DELETE' });
    cargar();
  }

  async function guardarConfig() {
    setGuardando(true);
    try {
      const res = await fetch('/api/os/salud/sueno/config', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          necesidad_h: cfg.necesidad_h, necesidad_auto: cfg.necesidad_auto,
          hora_dormir: cfg.hora_dormir, hora_despertar: cfg.hora_despertar,
          deuda_objetivo_h: cfg.deuda_objetivo_h, siestas_ok: cfg.siestas_ok,
          cafeina_vida_media_h: cfg.cafeina_vida_media_h, cafeina_umbral_mg: cfg.cafeina_umbral_mg,
        }),
      });
      const data = await res.json();
      if (data.error) { toast.show(data.error, 'error'); return; }
      toast.show('Configuracion guardada', 'ok');
      setAbrirConfig(false);
      cargar();
    } finally {
      setGuardando(false);
    }
  }

  const bebidasRapidas = useMemo(() => ([
    { key: 'espresso', nombre: 'Espresso', mg: 63 },
    { key: 'americano', nombre: 'Americano', mg: 120 },
    { key: 'filtrado', nombre: 'Filtrado', mg: 95 },
    { key: 'te_negro', nombre: 'Te negro', mg: 47 },
  ]), []);

  if (loading) return <Spinner />;
  if (error) return <EmptyState icon="error" title="No se pudo cargar" text={error} />;
  if (!estado) return null;

  const { deuda, plan, ventanas, cafeina, necesidad } = estado;
  const colorDeuda = COLOR_NIVEL[deuda.nivel];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Cabecera: la deuda y su lectura */}
      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <p style={rotulo}>Deuda de sueno · 14 dias</p>
            <p style={{ fontFamily: 'var(--os-font-mono)', fontSize: 34, fontWeight: 700, color: colorDeuda, margin: '4px 0 0', lineHeight: 1 }}>
              {formatearHoras(deuda.horas)}
            </p>
            <p style={{ fontSize: 'var(--os-text-sm)', color: 'var(--os-muted)', margin: '4px 0 0' }}>
              {TEXTO_NIVEL[deuda.nivel]} · objetivo {formatearHoras(plan.objetivoH)}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setAbrirConfig(true)}>Ajustes</Button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(96px,1fr))', gap: 8 }}>
          {[
            { label: 'Necesidad', val: formatearHoras(necesidad.horas), nota: necesidad.origen === 'auto' ? 'estimada' : 'manual' },
            { label: 'Promedio 14d', val: formatearHoras(deuda.promedioHoras), nota: `${14 - deuda.diasSinDato} dias con dato` },
            { label: 'Esta noche', val: formatearHoras(plan.horarioHoy.dormirH), nota: `${plan.horarioHoy.acostarse} a ${plan.horarioHoy.despertar}` },
            {
              label: 'Objetivo en',
              val: plan.nochesParaObjetivo === 0 ? 'Ya' : plan.nochesParaObjetivo === null ? '+14 n' : `${plan.nochesParaObjetivo} n`,
              nota: plan.nochesParaObjetivo === null ? 'no alcanza al ritmo actual' : 'noches',
            },
          ].map((m) => (
            <div key={m.label} style={{ background: 'var(--os-surface)', border: '1px solid var(--os-line-soft)', borderRadius: 'var(--os-r-sm)', padding: '8px 10px' }}>
              <p style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>{m.label}</p>
              <p style={{ fontFamily: 'var(--os-font-mono)', fontSize: 15, fontWeight: 700, color: 'var(--os-champagne)', margin: '2px 0 0' }}>{m.val}</p>
              <p style={{ fontSize: 10, color: 'var(--os-muted)', margin: 0 }}>{m.nota}</p>
            </div>
          ))}
        </div>

        {(deuda.diasSinDato >= 3 || deuda.topeAlcanzado) && (
          <p style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-warn)', margin: 0 }}>
            {deuda.topeAlcanzado
              ? `La deuda toco el tope de ${formatearHoras(deuda.tope)}: el numero real es mayor.`
              : `${deuda.diasSinDato} de 14 dias sin registro cuentan como neutros: la deuda real es probablemente mayor.`}
          </p>
        )}
      </div>

      {/* Curva del dia */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10, gap: 8 }}>
          <p style={rotulo}>Energia de hoy · Proceso C menos Proceso S</p>
          {estado.ahora && (
            <span style={{ fontFamily: 'var(--os-font-mono)', fontSize: 'var(--os-text-sm)', color: 'var(--os-accent-light)' }}>
              ahora {estado.ahora.alerta.toFixed(0)}
            </span>
          )}
        </div>
        <CurvaDia estado={estado} />
        <p style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', margin: '8px 0 0' }}>
          El indice compara el dia consigo mismo y con dias de mas o menos deuda. No mide alerta real: predice la forma del dia.
          {estado.anclas.despertar_real ? ' Anclado a tu despertar real de hoy.' : ' Anclado al horario configurado (aun sin registro de hoy).'}
        </p>
      </div>

      {/* Ventanas */}
      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={rotulo}>Ventanas del dia</p>
        {ventanas.map((v) => (
          <div key={v.clave} style={{
            display: 'flex', gap: 10, padding: '8px 10px', borderRadius: 'var(--os-r-sm)',
            background: estado.ahora?.ventana === v.clave ? 'var(--os-fill-subtle)' : 'transparent',
            border: `1px solid ${estado.ahora?.ventana === v.clave ? 'var(--os-line-accent)' : 'transparent'}`,
          }}>
            <div style={{ width: 4, borderRadius: 2, background: COLOR_VENTANA[v.clave]?.replace(/[\d.]+\)$/, '0.9)') ?? 'var(--os-line)', flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 'var(--os-text-sm)', fontWeight: 600, color: 'var(--os-text)' }}>
                {v.nombre}
                <span style={{ fontFamily: 'var(--os-font-mono)', fontWeight: 400, color: 'var(--os-muted)', marginLeft: 8 }}>{v.etiqueta}</span>
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 'var(--os-text-sm)', color: 'var(--os-muted)', lineHeight: 1.45 }}>{v.queHacer}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Plan */}
      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={rotulo}>Plan para pagar la deuda</p>
        <p style={{ margin: 0, fontSize: 'var(--os-text-sm)', color: 'var(--os-text-2)' }}>{estado.resumen}</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {plan.acciones.map((a) => (
            <div key={a.key} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid var(--os-line-soft)' }}>
              <span style={{
                fontFamily: 'var(--os-font-mono)', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 999,
                background: a.prioridad === 1 ? 'rgba(59,78,217,0.16)' : 'var(--os-fill-subtle)',
                color: a.prioridad === 1 ? 'var(--os-accent-light)' : 'var(--os-muted)', flexShrink: 0, marginTop: 2,
              }}>P{a.prioridad}</span>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 'var(--os-text-sm)', fontWeight: 600, color: 'var(--os-text)' }}>
                  {a.titulo}
                  {a.cuando && <span style={{ fontFamily: 'var(--os-font-mono)', fontWeight: 400, color: 'var(--os-champagne)', marginLeft: 8 }}>{a.cuando}</span>}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 'var(--os-text-sm)', color: 'var(--os-muted)', lineHeight: 1.45 }}>{a.detalle}</p>
              </div>
            </div>
          ))}
        </div>

        {plan.noches.length > 0 && (
          <div className="os-hscroll">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--os-text-sm)', minWidth: 340 }}>
              <thead>
                <tr style={{ color: 'var(--os-muted)', textAlign: 'left' }}>
                  <th style={{ fontWeight: 600, padding: '4px 6px' }}>Noche</th>
                  <th style={{ fontWeight: 600, padding: '4px 6px' }}>Dormir</th>
                  <th style={{ fontWeight: 600, padding: '4px 6px' }}>Ajuste</th>
                  <th style={{ fontWeight: 600, padding: '4px 6px' }}>Deuda al final</th>
                </tr>
              </thead>
              <tbody>
                {plan.noches.map((n) => (
                  <tr key={n.n} style={{ borderTop: '1px solid var(--os-line-soft)', fontFamily: 'var(--os-font-mono)' }}>
                    <td style={{ padding: '5px 6px', color: 'var(--os-muted)' }}>{n.fecha.slice(5)}</td>
                    <td style={{ padding: '5px 6px', color: 'var(--os-text)' }}>{formatearHoras(n.dormirH)}</td>
                    <td style={{ padding: '5px 6px', color: 'var(--os-muted)' }}>
                      {[n.adelantoMin && `-${n.adelantoMin}m cama`, n.estirarMin && `+${n.estirarMin}m despertar`, n.siestaMin && `siesta ${n.siestaMin}m`].filter(Boolean).join(' · ') || '-'}
                    </td>
                    <td style={{ padding: '5px 6px', color: 'var(--os-champagne)' }}>{formatearHoras(n.deudaRestanteH)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cafeina */}
      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={rotulo}>Cafeina</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(96px,1fr))', gap: 8 }}>
          {[
            { label: 'Activa ahora', val: `${cafeina.mg_ahora} mg` },
            { label: 'Al acostarte', val: `${cafeina.mg_al_dormir} mg`, alerta: cafeina.mg_al_dormir > cafeina.umbral_mg },
            { label: 'Hoy', val: `${cafeina.total_hoy_mg} mg` },
            { label: 'Ultimo cafe', val: cafeina.hora_corte === null ? 'ya paso' : formatearHora(cafeina.hora_corte) },
          ].map((m) => (
            <div key={m.label} style={{ background: 'var(--os-surface)', border: '1px solid var(--os-line-soft)', borderRadius: 'var(--os-r-sm)', padding: '8px 10px' }}>
              <p style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>{m.label}</p>
              <p style={{ fontFamily: 'var(--os-font-mono)', fontSize: 15, fontWeight: 700, margin: '2px 0 0', color: m.alerta ? 'var(--os-error)' : 'var(--os-champagne)' }}>{m.val}</p>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {bebidasRapidas.map((b) => (
            <Button key={b.key} variant="secondary" size="sm" onClick={() => registrarCafe(b.mg, b.key)}>
              + {b.nombre} ({b.mg} mg)
            </Button>
          ))}
        </div>
        {cafeina.dosis.filter((d) => d.fecha === estado.hoy).length > 0 && (
          <p style={{ margin: 0, fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', fontFamily: 'var(--os-font-mono)' }}>
            Hoy: {cafeina.dosis.filter((d) => d.fecha === estado.hoy).map((d) => `${soloHora(d.tomado_at)} ${d.mg}mg`).join(' · ')}
          </p>
        )}
      </div>

      {/* Registro */}
      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p style={rotulo}>Registrar sueno</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 6 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)' }}>Dia al despertar</span>
            <input style={{ ...input, background: 'var(--os-surface)' }} type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)' }}>{form.siesta ? 'Inicio' : 'Me acoste'}</span>
            <input style={{ ...input, background: 'var(--os-surface)' }} type="time" value={form.acostarse} onChange={(e) => setForm({ ...form, acostarse: e.target.value })} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)' }}>{form.siesta ? 'Fin' : 'Desperte'}</span>
            <input style={{ ...input, background: 'var(--os-surface)' }} type="time" value={form.despertar} onChange={(e) => setForm({ ...form, despertar: e.target.value })} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)' }}>Calidad (1-5)</span>
            <input style={input} type="number" min={1} max={5} placeholder="opcional" value={form.calidad} onChange={(e) => setForm({ ...form, calidad: e.target.value })} />
          </label>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--os-text-sm)', color: 'var(--os-text-2)' }}>
          <input type="checkbox" checked={form.siesta} onChange={(e) => setForm({ ...form, siesta: e.target.checked })} />
          Es una siesta
        </label>
        <Button disabled={guardando} onClick={registrarSueno}>{guardando ? 'Guardando...' : 'Guardar'}</Button>
      </div>

      {/* Historial */}
      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={rotulo}>Ultimas 14 noches · necesidad {formatearHoras(necesidad.horas)}</p>
        <Historial dias={deuda.dias} necesidad={necesidad.horas} />
        {estado.sesiones.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {estado.sesiones.slice(0, 14).map((s) => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--os-line-soft)' }}>
                <span style={{ fontSize: 'var(--os-text-sm)', color: 'var(--os-text)', fontFamily: 'var(--os-font-mono)' }}>
                  {s.fecha} · {soloHora(s.inicio)} a {soloHora(s.fin)}
                  <span style={{ color: 'var(--os-muted)', marginLeft: 8 }}>
                    {formatearHoras(s.minutos / 60)}{s.siesta ? ' · siesta' : ''}{s.calidad ? ` · ${s.calidad}/5` : ''}{s.fuente !== 'manual' ? ` · ${s.fuente}` : ''}
                  </span>
                </span>
                <Button variant="danger" size="sm" onClick={() => borrarSesion(s.id)} aria-label="Borrar registro">✕</Button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon="bedtime" title="Sin sesiones registradas" text="Registra la noche de ayer para que el modelo tenga de donde partir." />
        )}
      </div>

      <Sheet open={abrirConfig} onClose={() => setAbrirConfig(false)} title="Ajustes de sueno">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--os-text-sm)', color: 'var(--os-text-2)' }}>
            <input type="checkbox" checked={cfg.necesidad_auto} onChange={(e) => setCfg({ ...cfg, necesidad_auto: e.target.checked })} />
            Estimar mi necesidad desde el historico
          </label>
          {[
            { k: 'necesidad_h', label: 'Necesidad de sueno (h)', type: 'number' },
            { k: 'hora_dormir', label: 'Hora habitual de acostarme', type: 'time' },
            { k: 'hora_despertar', label: 'Hora habitual de despertar', type: 'time' },
            { k: 'deuda_objetivo_h', label: 'Deuda objetivo (h)', type: 'number' },
            { k: 'cafeina_vida_media_h', label: 'Vida media de cafeina (h)', type: 'number' },
            { k: 'cafeina_umbral_mg', label: 'Cafeina tolerada al dormir (mg)', type: 'number' },
          ].map((f) => (
            <label key={f.k} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)' }}>{f.label}</span>
              <input style={input} type={f.type} value={(cfg as Record<string, string | boolean>)[f.k] as string}
                onChange={(e) => setCfg({ ...cfg, [f.k]: e.target.value })} />
            </label>
          ))}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--os-text-sm)', color: 'var(--os-text-2)' }}>
            <input type="checkbox" checked={cfg.siestas_ok} onChange={(e) => setCfg({ ...cfg, siestas_ok: e.target.checked })} />
            Permitir siestas en el plan
          </label>
          <Button disabled={guardando} onClick={guardarConfig}>{guardando ? 'Guardando...' : 'Guardar ajustes'}</Button>
        </div>
      </Sheet>

      {sheet}
    </div>
  );
}

export default function OSSaludSueno() {
  return (
    <ToastProvider>
      <OSSaludSuenoInner />
    </ToastProvider>
  );
}
