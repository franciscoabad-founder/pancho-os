import { useEffect, useState } from 'react';

type NativeHealthEvent = {
  type: 'state' | 'snapshot' | 'error';
  state?: 'ready' | 'needs_permission' | 'unavailable' | 'error';
  background?: boolean;
  payload?: string;
  message?: string;
};

type BiometricaDia = Record<string, number | string | null | undefined>;

// Metricas de Health Connect que muestra la tarjeta cuando llegan con dato.
// Las claves coinciden con el payload de HealthConnectSync.kt y las columnas
// de biometricas_dia (migracion 20260830000003_biometricas_health_connect.sql).
const METRICAS_HEALTH_CONNECT: { campo: string; label: string; unidad: string; decimales?: number }[] = [
  { campo: 'fc_promedio', label: 'FC promedio', unidad: 'lpm' },
  { campo: 'fc_reposo', label: 'FC reposo', unidad: 'lpm' },
  { campo: 'vfc_ms', label: 'VFC', unidad: 'ms' },
  { campo: 'calorias_activas_kcal', label: 'Calorías activas', unidad: 'kcal' },
  { campo: 'calorias_totales_kcal', label: 'Calorías totales', unidad: 'kcal' },
  { campo: 'distancia_m', label: 'Distancia', unidad: 'm' },
  { campo: 'ejercicio_min', label: 'Ejercicio', unidad: 'min' },
  { campo: 'cadencia_pasos_promedio', label: 'Cadencia', unidad: 'pasos/min' },
  { campo: 'velocidad_promedio_ms', label: 'Velocidad', unidad: 'm/s', decimales: 1 },
  { campo: 'potencia_promedio_w', label: 'Potencia', unidad: 'W' },
  { campo: 'pisos_subidos', label: 'Pisos subidos', unidad: '' },
  { campo: 'elevacion_ganada_m', label: 'Elevación ganada', unidad: 'm' },
  { campo: 'saturacion_o2_pct', label: 'Saturación O2', unidad: '%', decimales: 1 },
  { campo: 'frecuencia_respiratoria', label: 'Frec. respiratoria', unidad: 'rpm', decimales: 1 },
  { campo: 'presion_sistolica_mmhg', label: 'Presión sistólica', unidad: 'mmHg' },
  { campo: 'presion_diastolica_mmhg', label: 'Presión diastólica', unidad: 'mmHg' },
  { campo: 'glucosa_mg_dl', label: 'Glucosa', unidad: 'mg/dL' },
  { campo: 'temperatura_c', label: 'Temperatura', unidad: '°C', decimales: 1 },
  { campo: 'temperatura_basal_c', label: 'Temperatura basal', unidad: '°C', decimales: 1 },
  { campo: 'grasa_corporal_pct', label: 'Grasa corporal', unidad: '%', decimales: 1 },
  { campo: 'masa_osea_kg', label: 'Masa ósea', unidad: 'kg', decimales: 1 },
  { campo: 'masa_magra_kg', label: 'Masa magra', unidad: 'kg', decimales: 1 },
  { campo: 'altura_cm', label: 'Altura', unidad: 'cm', decimales: 1 },
  { campo: 'tmb_kcal_dia', label: 'Metabolismo basal', unidad: 'kcal/día' },
  { campo: 'vo2_max', label: 'VO2 max', unidad: 'mL/kg/min', decimales: 1 },
  { campo: 'hidratacion_ml', label: 'Hidratación', unidad: 'mL' },
  { campo: 'energia_consumida_kcal', label: 'Energía consumida', unidad: 'kcal' },
];

declare global {
  interface Window {
    PanchoNative?: {
      isAndroidApp(): boolean;
      healthStatus(): void;
      requestHealthPermissions(): void;
      syncHealth(): void;
    };
  }
}

const card: React.CSSProperties = {
  background: 'var(--os-surface-2)',
  border: '1px solid var(--os-line-soft)',
  borderRadius: 'var(--os-r-card)',
  padding: '1rem',
};

/** Solo se muestra dentro de la APK. El navegador normal conserva el mismo OS. */
export default function OSNativeHealthConnect() {
  const [state, setState] = useState<'checking' | 'ready' | 'needs_permission' | 'unavailable' | 'error'>('checking');
  const [message, setMessage] = useState('');
  const [backgroundEnabled, setBackgroundEnabled] = useState(false);
  const [ultimaBiometrica, setUltimaBiometrica] = useState<BiometricaDia | null>(null);

  useEffect(() => {
    if (!window.PanchoNative?.isAndroidApp()) return;

    const onHealth = async (event: Event) => {
      const detail = (event as CustomEvent<NativeHealthEvent>).detail;
      if (detail.type === 'state' && detail.state) {
        setState(detail.state);
        setBackgroundEnabled(detail.background === true);
        if (detail.state === 'ready') {
          setMessage(detail.background === true ? 'Actualizando tus datos de hoy…' : 'Conectado. Activa la sincronización en segundo plano para actualizar automáticamente.');
          window.PanchoNative?.syncHealth();
        }
        return;
      }
      if (detail.type === 'error') {
        setState('error');
        setMessage(detail.message ?? 'No se pudo leer Health Connect.');
        return;
      }
      if (detail.type !== 'snapshot' || !detail.payload) return;

      try {
        setMessage('Guardando datos de Health Connect…');
        const res = await fetch('/api/biometricas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: detail.payload,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setState('ready');
        setMessage('Datos sincronizados con Pancho OS.');
        try {
          setUltimaBiometrica(JSON.parse(detail.payload));
        } catch {
          // El payload nativo siempre es JSON valido; si algo raro llega, se ignora
          // y la tarjeta simplemente no muestra el detalle de metricas.
        }
      } catch {
        setState('error');
        setMessage('Health Connect leyó los datos, pero el OS no pudo guardarlos. Reintenta con conexión.');
      }
    };

    window.addEventListener('pancho-native-health', onHealth);
    window.PanchoNative.healthStatus();
    return () => window.removeEventListener('pancho-native-health', onHealth);
  }, []);

  if (typeof window === 'undefined' || !window.PanchoNative?.isAndroidApp()) return null;

  const action = state === 'needs_permission' || (state === 'ready' && !backgroundEnabled)
    ? { label: 'Dar acceso a Health Connect', run: () => window.PanchoNative?.requestHealthPermissions() }
    : { label: 'Sincronizar ahora', run: () => window.PanchoNative?.syncHealth() };

  const metricasConDato = ultimaBiometrica
    ? METRICAS_HEALTH_CONNECT.filter((m) => typeof ultimaBiometrica[m.campo] === 'number')
    : [];

  return (
    <section style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12 }} aria-label="Health Connect">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <p style={{ margin: 0, fontWeight: 700, color: 'var(--os-text)' }}>Health Connect</p>
          <p style={{ margin: '4px 0 0', color: 'var(--os-muted)', fontSize: 'var(--os-text-sm)' }}>
            {state === 'checking' && 'Comprobando permisos de Android…'}
            {state === 'needs_permission' && 'Conecta pasos, sueño, frecuencia cardiaca y más desde tu teléfono.'}
            {state === 'ready' && (message || 'Conectado. Los datos de hoy se sincronizan directamente con tu OS.')}
            {state === 'unavailable' && 'Health Connect no está disponible en este teléfono.'}
            {state === 'error' && message}
          </p>
        </div>
        {state !== 'unavailable' && state !== 'checking' && (
          <button type="button" className="os-btn os-btn-primary" onClick={action.run}>{action.label}</button>
        )}
      </div>
      {metricasConDato.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 8 }}>
          {metricasConDato.map((m) => {
            const valor = ultimaBiometrica![m.campo] as number;
            const texto = m.decimales ? valor.toFixed(m.decimales) : Math.round(valor).toString();
            return (
              <div key={m.campo} style={{ background: 'var(--os-surface-1)', borderRadius: 'var(--os-r-sm, 8px)', padding: '6px 8px' }}>
                <p style={{ margin: 0, fontSize: 10, color: 'var(--os-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{m.label}</p>
                <p style={{ margin: '2px 0 0', fontFamily: 'var(--os-font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--os-text)' }}>
                  {texto}{m.unidad && <span style={{ fontSize: 10, color: 'var(--os-muted)' }}> {m.unidad}</span>}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
