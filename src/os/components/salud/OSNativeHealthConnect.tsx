import { useEffect, useState } from 'react';

type NativeHealthEvent = {
  type: 'state' | 'snapshot' | 'error';
  state?: 'ready' | 'needs_permission' | 'unavailable' | 'error';
  background?: boolean;
  payload?: string;
  message?: string;
};

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

  return (
    <section style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }} aria-label="Health Connect">
      <div>
        <p style={{ margin: 0, fontWeight: 700, color: 'var(--os-text)' }}>Health Connect</p>
        <p style={{ margin: '4px 0 0', color: 'var(--os-muted)', fontSize: 'var(--os-text-sm)' }}>
          {state === 'checking' && 'Comprobando permisos de Android…'}
          {state === 'needs_permission' && 'Conecta pasos, sueño y peso desde tu teléfono.'}
          {state === 'ready' && (message || 'Conectado. Los datos de hoy se sincronizan directamente con tu OS.')}
          {state === 'unavailable' && 'Health Connect no está disponible en este teléfono.'}
          {state === 'error' && message}
        </p>
      </div>
      {state !== 'unavailable' && state !== 'checking' && (
        <button type="button" className="os-btn os-btn-primary" onClick={action.run}>{action.label}</button>
      )}
    </section>
  );
}
