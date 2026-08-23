// "Mis dispositivos": la pantalla de credenciales del OS, en /sistema.
//
// Hasta ahora la unica auth de agente era OS_API_TOKENS, texto plano en el .env
// del VPS: invisible desde la app, sin fecha de ultimo uso y revocable solo por
// SSH. Esta isla muestra las dos poblaciones juntas:
//
//   - os_devices: emparejados por codigo, token hasheado, revocables de un clic.
//   - OS_API_TOKENS: solo el nombre (kimi, grok...), en gris y sin boton de
//     revocar. No es un olvido, esta explicado en la fila misma y en el
//     comentario de FilaTokenEnv.
//
// El flujo de alta tiene dos mitades porque hay dos dispositivos involucrados,
// y el QR es lo que las une:
//
//   1. Aca se genera la solicitud (pair/start). Devuelve un device_id y un
//      codigo de 6 digitos.
//   2. El QR codifica la URL /pair/<device_id>, no los 6 digitos. Esa es la
//      pieza que cierra el circuito: el dispositivo nuevo escanea, abre esa
//      pagina publica y asi hereda el device_id, que es lo unico contra lo que
//      pair/status entrega el token. Si el QR llevara solo el codigo, el
//      dispositivo no tendria forma de reclamar nada y confirmar dejaria una
//      credencial huerfana en os_devices.
//   3. Pancho confirma el codigo aca (pair/confirm, con sesion). Recien ahi
//      nace el token, y sale una sola vez hacia /pair/<device_id>.
//
// Esta pantalla nunca ve un token crudo, ni siquiera en la respuesta de
// confirmar.
//
// Tambien funciona al reves, sin QR: un agente o una CLI llama pair/start por
// su cuenta, muestra su codigo, y Pancho lo tipea abajo.

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, EmptyState, FieldInput, FieldSelect, Spinner, ToastProvider, useConfirm, useToast } from './ui';
import { configParaTexto, qrMatrizTexto, qrPathSvg } from '../../lib/qr';

type KindDispositivo = 'desktop' | 'android' | 'agent' | 'browser';

interface Dispositivo {
  id: string;
  label: string;
  kind: KindDispositivo;
  created_at: string;
  last_seen_at: string | null;
  revoked_at: string | null;
  created_via: string | null;
}

interface TokenEnv {
  nombre: string;
  kind: 'agent';
  origen: 'env';
}

interface Pairing {
  device_id: string;
  code: string;
  expires_at: string;
}

const ICONO_KIND: Record<KindDispositivo, string> = {
  desktop: 'desktop_windows',
  android: 'smartphone',
  agent: 'smart_toy',
  browser: 'language',
};

const NOMBRE_KIND: Record<KindDispositivo, string> = {
  desktop: 'Escritorio',
  android: 'Android',
  agent: 'Agente',
  browser: 'Navegador',
};

function fechaCorta(iso: string | null): string {
  if (!iso) return 'nunca';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'nunca';
  return d.toLocaleString('es-EC', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function mmss(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

async function leerError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return typeof data?.error === 'string' ? data.error : `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

// --- QR ----------------------------------------------------------------------

/** URL absoluta que abre el dispositivo nuevo. Es lo que va adentro del QR. */
function urlPairing(deviceId: string): string {
  // En SSR no hay window. El panel solo se monta despues de un fetch en el
  // cliente, asi que este fallback no deberia usarse nunca; esta para que el
  // componente no explote si algun dia se renderiza del lado del servidor.
  const origen = typeof window === 'undefined' ? 'https://os.franciscoabad.com' : window.location.origin;
  return `${origen}/pair/${deviceId}`;
}

function QrPairing({ url, lado = 176 }: { url: string; lado?: number }) {
  // useMemo porque la matriz se prueba con las 8 mascaras y el contador de
  // expiracion re-renderiza este arbol cada segundo.
  const qr = useMemo(() => {
    // El encoder propio llega hasta 106 bytes (5-L). Una URL normal de pairing
    // son ~70, pero si el origen fuera larguisimo preferimos no dibujar QR
    // antes que reventar la pantalla: el codigo y la URL en texto siguen
    // sirviendo para completar el emparejamiento a mano.
    if (!configParaTexto(url)) return null;
    const matriz = qrMatrizTexto(url);
    return { path: qrPathSvg(matriz), total: matriz.length + 8 }; // 4 modulos de zona tranquila por lado
  }, [url]);

  if (!qr) return null;

  return (
    <svg
      width={lado}
      height={lado}
      viewBox={`0 0 ${qr.total} ${qr.total}`}
      role="img"
      aria-label="Codigo QR con el enlace para emparejar este dispositivo"
      style={{ borderRadius: 'var(--os-r-sm)', background: '#fff', flexShrink: 0 }}
      shapeRendering="crispEdges"
    >
      <path d={qr.path} fill="#000" />
    </svg>
  );
}

// --- filas -------------------------------------------------------------------

function EstadoPill({ revocado }: { revocado: boolean }) {
  return (
    <span
      style={{
        fontSize: 'var(--os-text-xs)', fontWeight: 600, padding: '2px 8px',
        borderRadius: 999, whiteSpace: 'nowrap',
        // Regla de color del OS: hecho/activo = champagne, nunca verde.
        background: revocado ? 'rgba(212, 83, 126, 0.12)' : 'var(--os-fill-subtle)',
        color: revocado ? '#D4537E' : 'var(--os-champagne)',
        border: `1px solid ${revocado ? 'rgba(212, 83, 126, 0.3)' : 'var(--os-line)'}`,
      }}
    >
      {revocado ? 'revocado' : 'activo'}
    </span>
  );
}

function CeldaKind({ kind }: { kind: KindDispositivo }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--os-text-2)', fontSize: 'var(--os-text-sm)' }}>
      <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 18 }}>
        {ICONO_KIND[kind]}
      </span>
      {NOMBRE_KIND[kind]}
    </span>
  );
}

const celda: CSSProperties = { padding: '10px 8px', borderBottom: '1px solid var(--os-line-soft)', verticalAlign: 'middle' };
const encabezado: CSSProperties = {
  ...celda, textAlign: 'left', fontFamily: 'var(--os-font-display)', fontSize: 'var(--os-text-xs)',
  fontWeight: 700, letterSpacing: '0.04em', color: 'var(--os-muted)', textTransform: 'uppercase',
};

function FilaDispositivo({ device, onRevocar }: { device: Dispositivo; onRevocar: (d: Dispositivo) => void }) {
  const revocado = Boolean(device.revoked_at);
  return (
    <tr style={{ opacity: revocado ? 0.55 : 1 }}>
      <td style={celda}>
        <span style={{ fontWeight: 600, color: 'var(--os-text)' }}>{device.label}</span>
      </td>
      <td style={celda}><CeldaKind kind={device.kind} /></td>
      <td style={{ ...celda, fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', whiteSpace: 'nowrap' }}>
        {fechaCorta(device.last_seen_at)}
      </td>
      <td style={celda}><EstadoPill revocado={revocado} /></td>
      <td style={{ ...celda, textAlign: 'right' }}>
        {revocado ? null : (
          <Button variant="danger" size="sm" onClick={() => onRevocar(device)}>Revocar</Button>
        )}
      </td>
    </tr>
  );
}

// Las keys de OS_API_TOKENS se listan pero NO se pueden revocar desde aca, y el
// boton no existe en vez de existir deshabilitado: viven en el .env del VPS, no
// en la base. Revocarlas de verdad es editar ese archivo y reiniciar PM2, cosa
// que el servidor no puede hacerse a si mismo (y no queremos que pueda: seria
// darle a la app permiso de reescribir sus propias credenciales). Migrarlas a
// os_devices exige rotar el token con cada agente, y eso es otra tarea.
function FilaTokenEnv({ token }: { token: TokenEnv }) {
  return (
    <tr>
      <td style={celda}>
        <span style={{ fontWeight: 600, color: 'var(--os-text-2)' }}>{token.nombre}</span>
        <span className="os-mono" style={{ marginLeft: 8, fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)' }}>
          OS_API_TOKENS
        </span>
      </td>
      <td style={celda}><CeldaKind kind="agent" /></td>
      <td style={{ ...celda, fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)' }}>sin registro</td>
      <td style={celda}>
        <span
          style={{
            fontSize: 'var(--os-text-xs)', fontWeight: 600, padding: '2px 8px', borderRadius: 999,
            background: 'var(--os-fill-subtle)', color: 'var(--os-muted)', border: '1px solid var(--os-line)',
            whiteSpace: 'nowrap',
          }}
        >
          solo lectura
        </span>
      </td>
      <td style={{ ...celda, textAlign: 'right', fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)' }}>
        se revoca en el .env
      </td>
    </tr>
  );
}

// --- alta --------------------------------------------------------------------

function PanelPairing({
  pairing,
  onCancelar,
  onVencido,
}: {
  pairing: Pairing;
  onCancelar: () => void;
  onVencido: () => void;
}) {
  const [restante, setRestante] = useState(() => Date.parse(pairing.expires_at) - Date.now());
  // onVencido en ref para que el intervalo no se reinicie en cada render del
  // padre (y el contador no salte).
  const vencidoRef = useRef(onVencido);
  vencidoRef.current = onVencido;

  useEffect(() => {
    const fin = Date.parse(pairing.expires_at);
    const id = window.setInterval(() => {
      const ms = fin - Date.now();
      setRestante(ms);
      if (ms <= 0) {
        window.clearInterval(id);
        vencidoRef.current();
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [pairing.expires_at]);

  const url = urlPairing(pairing.device_id);

  return (
    <Card variant="sunken" accent style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <QrPairing url={url} />
        <div style={{ minWidth: 220, flex: 1 }}>
          <p className="os-eyebrow" style={{ marginBottom: 6 }}>Paso 1 · escanea desde el dispositivo nuevo</p>
          <p style={{ margin: '0 0 12px', fontSize: 'var(--os-text-sm)', color: 'var(--os-muted)', lineHeight: 1.5 }}>
            El QR abre la pagina de emparejamiento en ese dispositivo. Si no podes escanear, entra a mano a{' '}
            <span className="os-mono" style={{ color: 'var(--os-text-2)', wordBreak: 'break-all' }}>{url}</span>.
          </p>
          <p className="os-eyebrow" style={{ marginBottom: 6 }}>Paso 2 · confirma este codigo abajo</p>
          <p
            className="os-mono"
            style={{
              margin: '0 0 8px', fontSize: 'clamp(2rem, 8vw, 2.75rem)', fontWeight: 700,
              letterSpacing: '0.18em', color: 'var(--os-text)', lineHeight: 1.1,
            }}
          >
            {pairing.code}
          </p>
          <p style={{ margin: '0 0 12px', fontSize: 'var(--os-text-sm)', color: 'var(--os-muted)', lineHeight: 1.5 }}>
            Vence en{' '}
            <strong className="os-mono" style={{ color: restante < 60_000 ? '#D4537E' : 'var(--os-text-2)' }}>
              {mmss(restante)}
            </strong>
            . El token nace al confirmar y sale una sola vez, hacia la pagina que abrio el dispositivo nuevo.
          </p>
          <Button variant="ghost" size="sm" onClick={onCancelar}>Descartar codigo</Button>
        </div>
      </div>
    </Card>
  );
}

// --- isla --------------------------------------------------------------------

function OSDispositivosInner() {
  const toast = useToast();
  const { confirm, sheet } = useConfirm();

  const [devices, setDevices] = useState<Dispositivo[]>([]);
  const [tokensEnv, setTokensEnv] = useState<TokenEnv[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Distinto de `error`: el endpoint respondio bien pero la parte de Supabase
  // fallo. La lista del .env se sigue viendo.
  const [avisoDb, setAvisoDb] = useState<string | null>(null);

  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [generando, setGenerando] = useState(false);
  const [kindNuevo, setKindNuevo] = useState<KindDispositivo>('android');
  const [labelNuevo, setLabelNuevo] = useState('');

  const [codigoConfirmar, setCodigoConfirmar] = useState('');
  const [confirmando, setConfirmando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch('/api/os-auth/devices');
      if (!res.ok) throw new Error(await leerError(res));
      const data = await res.json();
      setDevices(Array.isArray(data.devices) ? data.devices : []);
      setTokensEnv(Array.isArray(data.tokensEnv) ? data.tokensEnv : []);
      // devicesError llega dentro de un 200: la mitad del .env se pudo leer y la
      // de la base no. Va crudo a pantalla porque si la migracion 20260823000000
      // no esta aplicada Supabase dice "Could not find the table
      // 'public.os_devices'", que es exactamente lo que hay que leer para saber
      // que falta correr el SQL.
      setAvisoDb(typeof data.devicesError === 'string' ? data.devicesError : null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  async function generarCodigo() {
    setGenerando(true);
    try {
      const res = await fetch('/api/os-auth/pair/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: kindNuevo, label: labelNuevo.trim() || undefined }),
      });
      if (!res.ok) throw new Error(await leerError(res));
      const data = (await res.json()) as Pairing;
      setPairing(data);
      setCodigoConfirmar(data.code);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setGenerando(false);
    }
  }

  async function confirmarCodigo() {
    const code = codigoConfirmar.replace(/[^0-9]/g, '').slice(0, 6);
    if (code.length !== 6) {
      toast.show('El codigo son 6 digitos.', 'error');
      return;
    }
    setConfirmando(true);
    try {
      const res = await fetch('/api/os-auth/pair/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) throw new Error(await leerError(res));
      const data = await res.json();
      // El emparejamiento todavia no termino del todo: falta que el dispositivo
      // se lleve su token. Decirlo evita que Pancho cierre la pantalla del otro
      // lado antes de tiempo y quede una credencial que nadie puede usar.
      toast.show(`${data?.device?.label ?? 'Dispositivo'} confirmado. Toma el token en el dispositivo nuevo.`, 'ok');
      setPairing(null);
      setCodigoConfirmar('');
      setLabelNuevo('');
      await cargar();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setConfirmando(false);
    }
  }

  async function revocar(device: Dispositivo) {
    const ok = await confirm({
      title: `Revocar ${device.label}`,
      text: 'Su token deja de servir en la proxima peticion. La fila se conserva para auditoria, pero el dispositivo tiene que emparejarse de nuevo.',
      confirmLabel: 'Revocar',
      danger: true,
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/os-auth/devices/${encodeURIComponent(device.id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await leerError(res));
      toast.show(`${device.label} revocado.`, 'ok');
      await cargar();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : String(err), 'error');
    }
  }

  const hayFilas = devices.length > 0 || tokensEnv.length > 0;

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div>
          <p className="os-eyebrow" style={{ marginBottom: 4 }}>Credenciales</p>
          <h2 style={{ margin: 0, fontFamily: 'var(--os-font-display)', fontSize: 'var(--os-text-lg)', fontWeight: 800, color: 'var(--os-text)' }}>
            Mis dispositivos
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: 'var(--os-text-sm)', color: 'var(--os-muted)', lineHeight: 1.5 }}>
            Todo lo que puede hablarle al OS con un token. Los emparejados se revocan de un clic.
          </p>
        </div>
        <Button size="sm" onClick={() => { void generarCodigo(); }} disabled={generando}>
          <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 16 }}>add_link</span>
          {generando ? 'Generando...' : 'Agregar dispositivo'}
        </Button>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
        <div style={{ minWidth: 150 }}>
          <FieldSelect
            label="Tipo"
            value={kindNuevo}
            onChange={(e) => setKindNuevo(e.target.value as KindDispositivo)}
          >
            <option value="android">Android</option>
            <option value="desktop">Escritorio</option>
            <option value="agent">Agente</option>
            <option value="browser">Navegador</option>
          </FieldSelect>
        </div>
        <div style={{ minWidth: 200, flex: 1 }}>
          <FieldInput
            label="Nombre (opcional)"
            placeholder="Pixel de Pancho"
            value={labelNuevo}
            maxLength={80}
            onChange={(e) => setLabelNuevo(e.target.value)}
          />
        </div>
      </div>

      {pairing && (
        <PanelPairing
          pairing={pairing}
          onCancelar={() => { setPairing(null); setCodigoConfirmar(''); }}
          onVencido={() => {
            setPairing(null);
            setCodigoConfirmar('');
            toast.show('El codigo vencio. Genera uno nuevo.', 'error');
          }}
        />
      )}

      <Card variant="sunken" style={{ marginTop: 12 }}>
        <p className="os-eyebrow" style={{ marginBottom: 6 }}>Confirmar emparejamiento</p>
        <p style={{ margin: '0 0 10px', fontSize: 'var(--os-text-sm)', color: 'var(--os-muted)', lineHeight: 1.5 }}>
          Confirma el codigo <strong>despues</strong> de que el dispositivo nuevo abrio su pagina de emparejamiento (por
          QR o a mano). Tambien sirve para el caso inverso: un agente que pidio su propio codigo y te lo dicta. Recien al
          confirmar se crea el token, y sale solo hacia ese dispositivo: esta pantalla no lo ve nunca.
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ width: 180 }}>
            <FieldInput
              label="Codigo"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              className="os-input os-mono"
              value={codigoConfirmar}
              onChange={(e) => setCodigoConfirmar(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
              onKeyDown={(e) => { if (e.key === 'Enter') void confirmarCodigo(); }}
              style={{ letterSpacing: '0.2em' }}
            />
          </div>
          <Button size="sm" onClick={() => { void confirmarCodigo(); }} disabled={confirmando}>
            {confirmando ? 'Confirmando...' : 'Confirmar'}
          </Button>
        </div>
      </Card>

      {avisoDb && (
        <Card variant="sunken" style={{ marginTop: 12, borderColor: 'rgba(212, 83, 126, 0.35)' }}>
          <p style={{ margin: 0, fontSize: 'var(--os-text-sm)', color: '#D4537E', lineHeight: 1.5 }}>
            <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 16, verticalAlign: '-3px', marginRight: 6 }}>
              database_off
            </span>
            No se pudo leer os_devices: <span className="os-mono">{avisoDb}</span>
          </p>
          <p style={{ margin: '6px 0 0', fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', lineHeight: 1.5 }}>
            Si dice que la tabla no existe, falta aplicar la migracion
            supabase/migrations/20260823000000_os_devices_pairing.sql. El pairing no funciona hasta entonces; las keys
            del .env de abajo si.
          </p>
        </Card>
      )}

      <div style={{ marginTop: 16 }}>
        {cargando ? (
          <Spinner inline label="Cargando dispositivos..." />
        ) : error ? (
          <EmptyState
            icon="cloud_off"
            title="No se pudo leer la lista"
            text={error}
            action={<Button size="sm" variant="secondary" onClick={() => { void cargar(); }}>Reintentar</Button>}
          />
        ) : !hayFilas ? (
          <EmptyState
            icon="devices"
            title="Ningun dispositivo emparejado"
            text="Genera un codigo, escanea el QR desde el dispositivo que quieras autorizar y confirma el codigo aca."
          />
        ) : (
          // overflowX porque en movil la tabla no entra: scrollea la tabla, no la pagina.
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
              <thead>
                <tr>
                  <th style={encabezado}>Dispositivo</th>
                  <th style={encabezado}>Tipo</th>
                  <th style={encabezado}>Ultimo uso</th>
                  <th style={encabezado}>Estado</th>
                  <th style={{ ...encabezado, textAlign: 'right' }}>Accion</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d) => (
                  <FilaDispositivo key={d.id} device={d} onRevocar={(dev) => { void revocar(dev); }} />
                ))}
                {tokensEnv.map((t) => (
                  <FilaTokenEnv key={`env:${t.nombre}`} token={t} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {tokensEnv.length > 0 && (
        <p style={{ margin: '10px 0 0', fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', lineHeight: 1.5 }}>
          Las filas marcadas <strong>solo lectura</strong> son keys de OS_API_TOKENS: viven en el .env del VPS, no en la
          base. Se ven aca para saber que existen, pero revocarlas sigue siendo editar ese archivo y reiniciar PM2.
        </p>
      )}

      {sheet}
    </Card>
  );
}

export default function OSDispositivos() {
  return (
    <ToastProvider>
      <OSDispositivosInner />
    </ToastProvider>
  );
}
