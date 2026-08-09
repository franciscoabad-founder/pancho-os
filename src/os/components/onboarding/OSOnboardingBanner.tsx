import { useEffect, useState } from 'react';
import OSOnboardingFlow, { type Respuestas } from './OSOnboardingFlow';
import { PASOS_SALUD } from './flujoSalud';

interface Props {
  modulo: 'salud';
}

// Banner "Configura tu plan (2 min)" para modulos con onboarding propio. Vive en
// la pagina .astro (no dentro del dashboard del modulo, que es de otro dueño) y
// abre el flujo en overlay de pantalla completa cuando se toca.
export default function OSOnboardingBanner({ modulo }: Props) {
  const [completado, setCompletado] = useState<boolean | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [prefill, setPrefill] = useState<Respuestas>({});

  async function chequearEstado() {
    try {
      const res = await fetch(`/api/os/onboarding?modulo=${modulo}`);
      const data = await res.json();
      return !!data?.estado?.completado_at;
    } catch {
      return false;
    }
  }

  useEffect(() => {
    let cancelado = false;
    chequearEstado().then((val) => { if (!cancelado) setCompletado(val); });
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modulo]);

  async function abrir() {
    // Prefill del peso actual desde el ultimo registro de cuerpo_log + unidad configurada,
    // sin bloquear la apertura del flujo si alguna de las dos llamadas falla.
    const previa: Respuestas = {};
    try {
      const [resCuerpo, resConfig] = await Promise.all([
        fetch('/api/os/salud/cuerpo').then((r) => r.json()).catch(() => null),
        fetch('/api/os/salud/config').then((r) => r.json()).catch(() => null),
      ]);
      const unidad = resConfig?.config?.unidad_peso === 'lb' ? 'lb' : 'kg';
      const pesoKg = resCuerpo?.mediciones?.[0]?.peso_kg;
      if (typeof pesoKg === 'number') {
        previa.peso_actual = { valor: pesoKg, unidad };
      }
    } catch {
      // Sin prefill: el usuario ingresa el peso a mano.
    }
    setPrefill(previa);
    setAbierto(true);
  }

  async function aplicarPlan() {
    const res = await fetch('/api/os/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aplicar: 'salud' }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'No se pudo aplicar tu plan');
  }

  if (completado !== false) return null;

  return (
    <>
      <button
        type="button"
        onClick={abrir}
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
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--os-text)', margin: 0 }}>Configura tu plan de salud</p>
          <p style={{ fontSize: 12, color: 'var(--os-muted)', margin: '2px 0 0' }}>2 minutos · metas, targets, ayuno y dias de entreno</p>
        </div>
        <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--os-muted)', flexShrink: 0 }}>chevron_right</span>
      </button>

      {abierto && (
        <OSOnboardingFlow
          modulo="salud"
          pasos={PASOS_SALUD}
          respuestasIniciales={prefill}
          onCompletar={aplicarPlan}
          onFinish={() => { setAbierto(false); chequearEstado().then(setCompletado); }}
        />
      )}
    </>
  );
}
