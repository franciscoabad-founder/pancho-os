import { useEffect, useState } from 'react';
import OSOnboardingFlow, { type Respuestas } from './onboarding/OSOnboardingFlow';
import { PASOS_OS } from './onboarding/flujoOs';

// Intro del OS (modulo 'os' de onboarding_estado). Reemplaza el wizard anterior
// (basado en os_system_state.onboarding_completed) por el framework generico de
// onboarding: se muestra una sola vez, en pantalla completa, y no vuelve a
// aparecer una vez que el modulo 'os' queda con completado_at.
//
// El wizard es confirmar-y-ajustar: antes de mostrarlo se trae el estado ya
// sembrado (semana + lineas maker) para prellenar respuestasIniciales. Si el
// prefill falla, se muestra igual el wizard vacio: nunca bloquea.
//
// Se puede POSPONER (cerrar con la X) sin completarlo: el progreso ya se
// persiste en onboarding_estado (paso + respuestas), asi que reabrirlo lo
// retoma donde quedo. Al posponer se guarda una marca local para que no
// reaparezca solo en cada recarga; en su lugar queda un boton "Terminar
// onboarding" para retomarlo cuando se quiera (util para hacer QA del OS sin
// tener aun la info real del onboarding).

const CLAVE_POSPUESTO = 'os_onboarding_pospuesto';

type Estado = 'cargando' | 'oculto' | 'flujo' | 'boton';

async function traerPrefill(): Promise<Respuestas> {
  const prefill: Respuestas = {};
  try {
    const [semanaRes, lineasRes] = await Promise.all([
      fetch('/api/os/semana', { cache: 'no-store' }),
      fetch('/api/os/lineas?maker=1', { cache: 'no-store' }),
    ]);
    const semana = await semanaRes.json().catch(() => null);
    const lineas = await lineasRes.json().catch(() => null);

    if (Array.isArray(semana?.dias)) {
      prefill.dias_maker = semana.dias.filter((d: any) => d.modo === 'maker').map((d: any) => d.dia);
      prefill.dias_off = semana.dias.filter((d: any) => d.modo === 'off').map((d: any) => d.dia);
      prefill.dias_sale = semana.dias.filter((d: any) => d.sale === true).map((d: any) => d.dia);
    }
    if (Array.isArray(semana?.balance)) {
      const presupuesto: Record<string, number> = {};
      for (const b of semana.balance) {
        if (b?.funcion && b.horas_objetivo != null) presupuesto[b.funcion] = b.horas_objetivo;
      }
      if (Object.keys(presupuesto).length) prefill.presupuesto = presupuesto;
    }
    if (Array.isArray(lineas?.lineas)) {
      prefill.lineas_maker = lineas.lineas.map((l: any) => l.nombre);
    }
  } catch {
    // Sin prefill: el wizard se muestra vacio, no bloquea.
  }
  return prefill;
}

export default function OSOnboarding() {
  const [estado, setEstado] = useState<Estado>('cargando');
  const [respuestasIniciales, setRespuestasIniciales] = useState<Respuestas>({});

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const res = await fetch('/api/os/onboarding?modulo=os', { cache: 'no-store' });
        const data = await res.json();
        if (cancelado) return;

        // Ya completado: nunca mas, y limpia la marca de pospuesto por prolijidad.
        if (data?.estado?.completado_at) {
          try { localStorage.removeItem(CLAVE_POSPUESTO); } catch { /* noop */ }
          setEstado('oculto');
          return;
        }

        // Pospuesto en este dispositivo: no forzar, solo dejar el boton para retomar.
        let pospuesto = false;
        try { pospuesto = localStorage.getItem(CLAVE_POSPUESTO) === '1'; } catch { /* noop */ }
        if (pospuesto) {
          setEstado('boton');
          return;
        }

        const prefill = await traerPrefill();
        if (!cancelado) {
          setRespuestasIniciales(prefill);
          setEstado('flujo');
        }
      } catch {
        // Si falla la carga del estado, no forzamos el wizard.
        if (!cancelado) setEstado('oculto');
      }
    })();
    return () => { cancelado = true; };
  }, []);

  // Posponer: cerrar sin completar. Marca local + muestra el boton para retomar.
  function posponer() {
    try { localStorage.setItem(CLAVE_POSPUESTO, '1'); } catch { /* noop */ }
    setEstado('boton');
  }

  // Retomar: reabre el flujo. OSOnboardingFlow lee el estado guardado y arranca
  // en el paso donde se quedo, con las respuestas ya cargadas.
  async function retomar() {
    const prefill = await traerPrefill();
    setRespuestasIniciales(prefill);
    setEstado('flujo');
  }

  // Se dispara al cerrar el flujo (X o al completar el ultimo paso). Se reconsulta
  // el estado real: si quedo completado, se oculta; si no, se pospone.
  async function alCerrarFlujo() {
    try {
      const res = await fetch('/api/os/onboarding?modulo=os', { cache: 'no-store' });
      const data = await res.json();
      if (data?.estado?.completado_at) {
        try { localStorage.removeItem(CLAVE_POSPUESTO); } catch { /* noop */ }
        setEstado('oculto');
        return;
      }
    } catch {
      // Si no se puede confirmar, se trata como pospuesto (no bloquea).
    }
    posponer();
  }

  if (estado === 'cargando' || estado === 'oculto') return null;

  if (estado === 'boton') {
    return (
      <button
        type="button"
        onClick={retomar}
        className="os-card os-card-interactive"
        style={{
          display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left',
          marginBottom: '1rem', border: '1px solid var(--os-line-accent)',
          background: 'linear-gradient(135deg, rgba(59,78,217,0.08), var(--os-surface))',
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 26, color: 'var(--os-accent)', flexShrink: 0 }}>
          auto_awesome
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--os-text)', margin: 0 }}>Terminar onboarding</p>
          <p style={{ fontSize: 12, color: 'var(--os-muted)', margin: '2px 0 0' }}>Retoma la configuracion del OS donde la dejaste</p>
        </div>
        <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--os-muted)', flexShrink: 0 }}>chevron_right</span>
      </button>
    );
  }

  return (
    <OSOnboardingFlow
      modulo="os"
      pasos={PASOS_OS}
      respuestasIniciales={respuestasIniciales}
      onFinish={alCerrarFlujo}
      onCompletar={async () => {
        const res = await fetch('/api/os/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ aplicar: 'os' }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error);
      }}
    />
  );
}
