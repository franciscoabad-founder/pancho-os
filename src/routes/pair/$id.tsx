// /pair/<device_id> -- la mitad del emparejamiento que corre EN EL DISPOSITIVO
// NUEVO. Es la pagina que abre el telefono al escanear el QR de /sistema.
//
// Por que existe: pair/status entrega el token contra el device_id, y ese id lo
// recibe solamente quien llamo a pair/start. Cuando el codigo lo genera Pancho
// desde el escritorio, el device_id se queda en SU navegador; el dispositivo
// nuevo se lleva unicamente lo que dice el QR. Por eso el QR codifica la URL de
// esta pagina y no los 6 digitos: al abrirla, el telefono hereda el device_id y
// recien ahi puede poller su propio pairing. Sin esta pagina el flujo del boton
// "Agregar dispositivo" no cierra, y confirmarlo dejaria una fila activa en
// os_devices con un token que nadie puede reclamar.
//
// PUBLICA a proposito (src/server/osAuthPolicy.ts la lista): el dispositivo que
// se empareja todavia no tiene sesion, justamente la esta pidiendo. Lo unico
// que consigue quien abra esta URL sin permiso es ver "esperando confirmacion":
// el token no nace hasta que Pancho confirma el codigo desde /sistema, y ahi el
// codigo es la barrera.
//
// El token se muestra UNA vez y ya: la respuesta de pair/status marca
// delivered_at en el mismo request, asi que recargar esta pagina despues no lo
// vuelve a traer. Eso es deliberado, y la pantalla lo dice antes de mostrarlo.

import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';

export const Route = createFileRoute('/pair/$id')({
  head: () => ({
    meta: [
      { title: 'Emparejar dispositivo · OS · Francisco Abad' },
      { name: 'robots', content: 'noindex, nofollow' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1.0, viewport-fit=cover' },
    ],
  }),
  component: PairPage,
});

const INTERVALO_POLL_MS = 2500;

type Estado =
  | { fase: 'cargando' }
  | { fase: 'pendiente'; expiraEn: string }
  | { fase: 'listo'; token: string; label: string }
  | { fase: 'error'; mensaje: string };

function mmss(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function PairPage() {
  const { id } = Route.useParams();
  const [estado, setEstado] = useState<Estado>({ fase: 'cargando' });
  const [copiado, setCopiado] = useState(false);

  // El poll se corta solo al llegar a un estado final. `activo` en ref y no en
  // estado para que el timer lo lea sin re-suscribirse.
  const activo = useRef(true);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/os-auth/pair/status?device_id=${encodeURIComponent(id)}`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        activo.current = false;
        setEstado({ fase: 'error', mensaje: typeof data?.error === 'string' ? data.error : `HTTP ${res.status}` });
        return;
      }

      if (data?.status === 'confirmed' && typeof data.token === 'string') {
        // Estado final: se corta el poll ANTES de pintar. Volver a preguntar no
        // solo es inutil, devolveria 410 y borraria el token de la pantalla.
        activo.current = false;
        setEstado({ fase: 'listo', token: data.token, label: typeof data.label === 'string' ? data.label : '' });
        return;
      }

      setEstado({ fase: 'pendiente', expiraEn: typeof data?.expires_at === 'string' ? data.expires_at : '' });
    } catch (err) {
      // Un fallo de red no es final: el telefono puede estar cambiando de wifi
      // a datos justo ahora. Se sigue intentando.
      setEstado({ fase: 'error', mensaje: err instanceof Error ? err.message : String(err) });
    }
  }, [id]);

  useEffect(() => {
    activo.current = true;
    void poll();
    const timer = window.setInterval(() => {
      if (!activo.current) {
        window.clearInterval(timer);
        return;
      }
      void poll();
    }, INTERVALO_POLL_MS);
    return () => {
      activo.current = false;
      window.clearInterval(timer);
    };
  }, [poll]);

  async function copiar(token: string) {
    try {
      await navigator.clipboard.writeText(token);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin permiso de portapapeles (http, o navegador viejo): el token esta a
      // la vista y se puede seleccionar a mano, que es el plan B razonable.
      setCopiado(false);
    }
  }

  return (
    <main
      style={{
        minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px 16px', background: 'var(--os-bg, #060C1E)', color: 'var(--os-text, #F4F6FB)',
        fontFamily: 'var(--os-font-body, Gotham, Montserrat, Arial, sans-serif)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 460 }}>
        <p className="os-eyebrow" style={{ marginBottom: 6 }}>Growth OS</p>
        <h1
          style={{
            margin: '0 0 16px', fontFamily: 'var(--os-font-display, Gotham, Montserrat, Arial, sans-serif)',
            fontSize: 'clamp(1.4rem, 6vw, 1.9rem)', fontWeight: 800, lineHeight: 1.2,
          }}
        >
          Emparejar este dispositivo
        </h1>

        {estado.fase === 'cargando' && (
          <p style={{ color: 'var(--os-muted, #8A93AC)', fontSize: 'var(--os-text-sm, 0.9rem)' }}>
            Consultando el estado del emparejamiento...
          </p>
        )}

        {estado.fase === 'pendiente' && <PanelPendiente expiraEn={estado.expiraEn} />}

        {estado.fase === 'listo' && (
          <PanelToken token={estado.token} label={estado.label} copiado={copiado} onCopiar={copiar} />
        )}

        {estado.fase === 'error' && (
          <div
            style={{
              padding: 16, borderRadius: 'var(--os-r-md, 14px)',
              background: 'rgba(212, 83, 126, 0.10)', border: '1px solid rgba(212, 83, 126, 0.35)',
            }}
          >
            <p style={{ margin: 0, fontWeight: 600, color: '#D4537E' }}>No se pudo completar</p>
            <p style={{ margin: '6px 0 0', fontSize: 'var(--os-text-sm, 0.9rem)', color: 'var(--os-text-2, #C7CEE0)', lineHeight: 1.5 }}>
              {estado.mensaje}
            </p>
            <p style={{ margin: '10px 0 0', fontSize: 'var(--os-text-xs, 0.78rem)', color: 'var(--os-muted, #8A93AC)', lineHeight: 1.5 }}>
              Genera un codigo nuevo desde Mi Sistema y volve a escanear el QR.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

function PanelPendiente({ expiraEn }: { expiraEn: string }) {
  const [restante, setRestante] = useState(() => (expiraEn ? Date.parse(expiraEn) - Date.now() : 0));

  useEffect(() => {
    if (!expiraEn) return;
    const fin = Date.parse(expiraEn);
    const timer = window.setInterval(() => setRestante(fin - Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [expiraEn]);

  return (
    <div
      style={{
        padding: 16, borderRadius: 'var(--os-r-md, 14px)',
        background: 'var(--os-fill-subtle, rgba(255,255,255,0.04))',
        border: '1px solid var(--os-line, rgba(255,255,255,0.10))',
      }}
    >
      <p style={{ margin: 0, fontWeight: 600 }}>Esperando la confirmacion</p>
      <p style={{ margin: '8px 0 0', fontSize: 'var(--os-text-sm, 0.9rem)', color: 'var(--os-text-2, #C7CEE0)', lineHeight: 1.6 }}>
        En el OS, entra a <strong>Mi Sistema</strong> y confirma el codigo de 6 digitos que aparece junto a este QR.
        Cuando lo hagas, esta pantalla te va a dar el token de acceso.
      </p>
      {expiraEn && (
        <p style={{ margin: '12px 0 0', fontSize: 'var(--os-text-xs, 0.78rem)', color: 'var(--os-muted, #8A93AC)' }}>
          El codigo vence en{' '}
          <strong className="os-mono" style={{ color: restante < 60_000 ? '#D4537E' : 'var(--os-text-2, #C7CEE0)' }}>
            {mmss(restante)}
          </strong>
        </p>
      )}
      <p style={{ margin: '12px 0 0', fontSize: 'var(--os-text-xs, 0.78rem)', color: 'var(--os-muted, #8A93AC)', lineHeight: 1.5 }}>
        Deja esta pagina abierta. Se consulta sola cada pocos segundos.
      </p>
    </div>
  );
}

function PanelToken({
  token,
  label,
  copiado,
  onCopiar,
}: {
  token: string;
  label: string;
  copiado: boolean;
  onCopiar: (token: string) => void;
}) {
  return (
    <div
      style={{
        padding: 16, borderRadius: 'var(--os-r-md, 14px)',
        background: 'var(--os-fill-subtle, rgba(255,255,255,0.04))',
        border: '1px solid var(--os-champagne, #E4CDA7)',
      }}
    >
      <p style={{ margin: 0, fontWeight: 600, color: 'var(--os-champagne, #E4CDA7)' }}>
        Listo{label ? `: ${label}` : ''}
      </p>
      <p style={{ margin: '8px 0 12px', fontSize: 'var(--os-text-sm, 0.9rem)', color: 'var(--os-text-2, #C7CEE0)', lineHeight: 1.6 }}>
        Guarda este token ahora. <strong>Se muestra una sola vez</strong>: recargar esta pagina no lo vuelve a traer, y
        si lo perdes hay que emparejar de nuevo.
      </p>
      <p
        className="os-mono"
        style={{
          margin: 0, padding: 12, borderRadius: 'var(--os-r-sm, 10px)', wordBreak: 'break-all',
          background: 'rgba(0,0,0,0.35)', border: '1px solid var(--os-line, rgba(255,255,255,0.10))',
          fontSize: 'var(--os-text-sm, 0.9rem)', lineHeight: 1.6, userSelect: 'all',
        }}
      >
        {token}
      </p>
      <button
        type="button"
        onClick={() => onCopiar(token)}
        style={{
          marginTop: 12, width: '100%', padding: '10px 14px', borderRadius: 'var(--os-r-sm, 10px)',
          border: '1px solid var(--os-champagne, #E4CDA7)', background: 'transparent',
          color: 'var(--os-champagne, #E4CDA7)', fontWeight: 600, fontSize: 'var(--os-text-sm, 0.9rem)',
          cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        {copiado ? 'Copiado' : 'Copiar token'}
      </button>
      <p style={{ margin: '12px 0 0', fontSize: 'var(--os-text-xs, 0.78rem)', color: 'var(--os-muted, #8A93AC)', lineHeight: 1.5 }}>
        Se usa como cabecera <span className="os-mono">X-OS-Token</span> (o <span className="os-mono">Authorization: Bearer</span>)
        contra la API del OS. Se puede revocar cuando quieras desde Mi Sistema.
      </p>
    </div>
  );
}
