import { useEffect, useState } from 'react';

// Franja delgada del jugador (Version B: motor transversal). Vive en el shell
// Ultramarine (OSLayout) pero usa estetica hibrida discreta: mono, linea de 1px,
// sin radios, sin colores del modulo Habitos salvo el rojo hazard para HP bajo
// (canon: apps/web/docs/os-diseno-conductual.md). Si el fetch falla o el jugador
// no existe todavia (tabla `jugador` sin migrar), no renderiza nada.

interface NivelInfo { nivel: number; xpEnNivel: number; xpSiguiente: number; progreso: number }
interface JugadorConfig { hp_activo?: boolean; oro_activo?: boolean; loot_activo?: boolean }
interface Jugador {
  xp_total: number; oro: number; hp: number; hp_max: number;
  config: JugadorConfig; nivel: NivelInfo;
}
interface EstadoResponse { jugador: Jugador | null; error?: string }

const CACHE_KEY = 'os-jugador';
const TTL_MS = 60_000;
const HAZARD = '#F87171';

function leerCache(): Jugador | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw) as { ts: number; data: Jugador };
    if (Date.now() - ts > TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

function guardarCache(data: Jugador) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // sessionStorage no disponible: sin cache, no rompe nada.
  }
}

function barraXp(pct: number): string {
  const llenos = Math.round((pct / 100) * 5);
  return '▮'.repeat(llenos) + '▯'.repeat(Math.max(0, 5 - llenos));
}

export default function OSJugadorBar() {
  const [jugador, setJugador] = useState<Jugador | null>(() => leerCache());
  const [oculto, setOculto] = useState(false);

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      try {
        const res = await fetch('/api/os/juego/estado');
        const data: EstadoResponse = await res.json();
        if (cancelado) return;
        if (data.error || !data.jugador) {
          setOculto(true);
          return;
        }
        setJugador(data.jugador);
        guardarCache(data.jugador);
      } catch {
        if (!cancelado) setOculto(true);
      }
    }

    const cache = leerCache();
    if (!cache) cargar();
    else cargar(); // igual revalida en segundo plano; el cache solo evita el parpadeo inicial.

    function onXp(ev: Event) {
      const detail = (ev as CustomEvent<{ xp?: number; oro?: number; hp?: number }>).detail ?? {};
      setJugador((cur) => {
        if (!cur) return cur;
        const siguiente: Jugador = {
          ...cur,
          xp_total: cur.xp_total + (detail.xp ?? 0),
          oro: cur.oro + (detail.oro ?? 0),
          hp: detail.hp != null ? detail.hp : cur.hp,
        };
        guardarCache(siguiente);
        return siguiente;
      });
    }
    window.addEventListener('os:xp', onXp);

    return () => {
      cancelado = true;
      window.removeEventListener('os:xp', onXp);
    };
  }, []);

  if (oculto || !jugador) return null;

  const config = jugador.config ?? {};
  const hpActivo = config.hp_activo !== false;
  const oroActivo = config.oro_activo !== false;
  const hpPct = jugador.hp_max > 0 ? jugador.hp / jugador.hp_max : 0;
  const hpBajo = hpPct < 0.3;

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        height: 28, padding: '0 10px',
        fontFamily: 'var(--os-font-mono)', fontSize: 11, fontWeight: 700,
        letterSpacing: '0.06em', textTransform: 'uppercase',
        color: 'var(--os-text-2)', background: 'transparent',
        borderBottom: '1px solid var(--os-line)', whiteSpace: 'nowrap',
      }}
      title="Estado del jugador"
    >
      <span>NV.{String(jugador.nivel.nivel).padStart(2, '0')}</span>
      <span style={{ letterSpacing: '0.02em' }}>{barraXp(jugador.nivel.progreso * 100)}</span>
      <span>{String(jugador.xp_total).padStart(4, '0')}XP</span>
      {hpActivo && (
        <span style={{ color: hpBajo ? HAZARD : 'var(--os-text-2)' }}>
          ♥{jugador.hp}
        </span>
      )}
      {oroActivo && <span style={{ color: 'var(--os-champagne)' }}>⛁{jugador.oro}</span>}
    </div>
  );
}
