// Tab "Foto" del sheet de captura: foto desde galeria (input file SIN capture, en movil
// abre la galeria), redimensionada client-side (canvas, max 1280px lado largo, JPEG 0.8)
// y enviada a /api/os/salud/foto-comida. El flujo n8n multimodal devuelve una estimacion
// que el usuario revisa y EDITA antes de guardar; nada se registra sin su confirmacion
// (manual-first). Contrato completo en apps/web/docs/contrato-foto-comida.md.
import { useRef, useState, type ChangeEvent } from 'react';
import type { Momento } from './tipos';
import { input, btn, btnGhost, btnIcon, card2, eyebrow, chip, chipMuted } from './estilos';
import { Spinner } from '../../ui';

interface Props {
  momento: Momento;
  dia: string;
  tipoDia: string;
  onAgregado: () => void;
}

// Item de la estimacion tal como lo devuelve /api/os/salud/foto-comida.
interface AlimentoEstimado {
  descripcion: string;
  cantidad_g: number | null;
  kcal: number | null;
  proteina_g: number | null;
  carbos_g: number | null;
  grasa_g: number | null;
}

// Version editable (strings, para que los inputs numericos permitan vacio).
interface AlimentoEditable {
  descripcion: string;
  cantidad_g: string;
  kcal: string;
  proteina_g: string;
  carbos_g: string;
  grasa_g: string;
}

const MAX_LADO = 1280;
const CALIDAD_JPEG = 0.8;
const CONFIANZA_MINIMA = 0.6;

// Redimensiona la imagen client-side (canvas) a max MAX_LADO px en el lado largo y la
// recomprime como JPEG. Asi el payload queda muy por debajo del limite de 4MB del endpoint.
function redimensionarFoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const factor = Math.min(1, MAX_LADO / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * factor));
      const h = Math.max(1, Math.round(img.height * factor));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas no disponible en este navegador')); return; }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', CALIDAD_JPEG));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')); };
    img.src = url;
  });
}

const strDeNum = (v: number | null): string => (v == null ? '' : String(v));
function numDeStr(s: string): number | null {
  if (!s.trim()) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export default function TabFoto({ momento, dia, tipoDia, onAgregado }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [foto, setFoto] = useState<string | null>(null);
  const [descripcion, setDescripcion] = useState('');
  const [estimando, setEstimando] = useState(false);
  const [error, setError] = useState('');
  const [reintentable, setReintentable] = useState(false);
  const [alimentos, setAlimentos] = useState<AlimentoEditable[] | null>(null);
  const [confianza, setConfianza] = useState<number | null>(null);
  const [notas, setNotas] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function elegirFoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(''); setReintentable(false); setAlimentos(null); setConfianza(null); setNotas(null);
    try {
      setFoto(await redimensionarFoto(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo procesar la imagen');
    }
  }

  async function estimar() {
    if (!foto) return;
    setEstimando(true); setError(''); setReintentable(false);
    try {
      const res = await fetch('/api/os/salud/foto-comida', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ foto_base64: foto, descripcion: descripcion.trim() || undefined, momento }),
      });
      const data = await res.json().catch(() => ({} as Record<string, unknown>));
      if (res.status === 501) {
        setError('El flujo de foto no esta configurado aun. Usa Buscar o Mas mientras tanto.');
        return;
      }
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : `El flujo de foto respondio ${res.status}`);
        setReintentable(true);
        return;
      }
      const est = data.estimacion as { alimentos?: AlimentoEstimado[]; confianza?: number | null; notas?: string | null } | undefined;
      if (!est || !Array.isArray(est.alimentos) || !est.alimentos.length) {
        setError('El flujo no reconocio alimentos en la foto. Prueba con otra foto o agrega una descripcion.');
        setReintentable(true);
        return;
      }
      setAlimentos(est.alimentos.map((a) => ({
        descripcion: a.descripcion,
        cantidad_g: strDeNum(a.cantidad_g),
        kcal: strDeNum(a.kcal),
        proteina_g: strDeNum(a.proteina_g),
        carbos_g: strDeNum(a.carbos_g),
        grasa_g: strDeNum(a.grasa_g),
      })));
      setConfianza(typeof est.confianza === 'number' ? est.confianza : null);
      setNotas(typeof est.notas === 'string' && est.notas ? est.notas : null);
    } catch {
      setError('No se pudo contactar el flujo de foto. Revisa tu conexion.');
      setReintentable(true);
    } finally {
      setEstimando(false);
    }
  }

  function editar(i: number, campo: keyof AlimentoEditable, valor: string) {
    if (!alimentos) return;
    setAlimentos(alimentos.map((a, idx) => (idx === i ? { ...a, [campo]: valor } : a)));
  }

  function quitar(i: number) {
    if (!alimentos) return;
    const rest = alimentos.filter((_, idx) => idx !== i);
    setAlimentos(rest.length ? rest : null);
  }

  function reiniciar() {
    setFoto(null); setDescripcion(''); setAlimentos(null); setConfianza(null); setNotas(null);
    setError(''); setReintentable(false);
  }

  // Guarda cada alimento confirmado via el contrato de macros directos de comidas-log
  // (descripcion_libre + macros), igual que una entrada libre del tab "Mas". Guardado
  // secuencial: si uno falla, los ya guardados salen de la lista y se muestra el error
  // para reintentar solo con los pendientes (sin duplicar).
  async function confirmar() {
    if (!alimentos) return;
    const validos = alimentos.filter((a) => a.descripcion.trim());
    if (!validos.length) { setError('Cada alimento necesita una descripcion'); return; }
    setGuardando(true); setError('');
    const pendientes = [...validos];
    try {
      while (pendientes.length) {
        const a = pendientes[0];
        const res = await fetch('/api/os/salud/comidas-log', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            descripcion_libre: a.descripcion.trim(),
            cantidad_g: numDeStr(a.cantidad_g),
            kcal: numDeStr(a.kcal),
            proteina_g: numDeStr(a.proteina_g),
            carbos_g: numDeStr(a.carbos_g),
            grasa_g: numDeStr(a.grasa_g),
            momento, fecha: dia, tipo_dia: tipoDia,
          }),
        });
        const data = await res.json().catch(() => ({} as Record<string, unknown>));
        if (!res.ok || data.error) {
          throw new Error(typeof data.error === 'string' ? data.error : 'Error al guardar');
        }
        pendientes.shift();
      }
      onAgregado();
    } catch (e) {
      setAlimentos(pendientes.length ? pendientes : null);
      setError(`No se pudo guardar "${pendientes[0]?.descripcion ?? ''}": ${e instanceof Error ? e.message : 'error'}. Los anteriores si quedaron registrados.`);
    } finally {
      setGuardando(false);
    }
  }

  const confianzaBaja = confianza != null && confianza < CONFIANZA_MINIMA;

  // ── Fase revision: lista editable de la estimacion ─────────────────────────
  if (alimentos) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {foto && <img src={foto} alt="Foto de la comida" style={{ width: 52, height: 52, borderRadius: 14, objectFit: 'cover', flexShrink: 0 }} />}
          <div style={{ minWidth: 0 }}>
            <p style={eyebrow}>Estimacion</p>
            {confianza != null && (
              <span style={confianzaBaja ? { ...chipMuted, color: 'var(--os-warn)' } : chip}>
                confianza {Math.round(confianza * 100)}%
              </span>
            )}
          </div>
        </div>

        {confianzaBaja && (
          <p style={{ margin: 0, fontSize: 'var(--os-text-xs)', color: 'var(--os-warn)' }}>
            Confianza baja: revisa las cantidades antes de guardar.
          </p>
        )}
        {notas && (
          <p style={{ margin: 0, fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)' }}>{notas}</p>
        )}
        {error && <p style={{ margin: 0, fontSize: 'var(--os-text-sm)', color: 'var(--os-error)' }}>{error}</p>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 320, overflowY: 'auto' }}>
          {alimentos.map((a, i) => (
            <div key={i} style={{ ...card2, display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input style={{ ...input, flex: 1 }} placeholder="Alimento" value={a.descripcion} onChange={(e) => editar(i, 'descripcion', e.target.value)} />
                <button style={btnIcon} title="Quitar" onClick={() => quitar(i)}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                <input style={input} type="number" placeholder="g" title="Cantidad (g)" value={a.cantidad_g} onChange={(e) => editar(i, 'cantidad_g', e.target.value)} />
                <input style={input} type="number" placeholder="kcal" title="Calorias" value={a.kcal} onChange={(e) => editar(i, 'kcal', e.target.value)} />
                <input style={input} type="number" placeholder="P (g)" title="Proteina (g)" value={a.proteina_g} onChange={(e) => editar(i, 'proteina_g', e.target.value)} />
                <input style={input} type="number" placeholder="C (g)" title="Carbohidratos (g)" value={a.carbos_g} onChange={(e) => editar(i, 'carbos_g', e.target.value)} />
                <input style={input} type="number" placeholder="G (g)" title="Grasa (g)" value={a.grasa_g} onChange={(e) => editar(i, 'grasa_g', e.target.value)} />
              </div>
            </div>
          ))}
        </div>

        <button style={btn} disabled={guardando} onClick={confirmar}>
          {guardando ? 'Guardando...' : `Agregar ${alimentos.length} alimento${alimentos.length === 1 ? '' : 's'}`}
        </button>
        <button style={btnGhost} disabled={guardando} onClick={reiniciar}>Empezar de nuevo con otra foto</button>
      </div>
    );
  }

  // ── Fase captura: elegir foto, descripcion opcional y estimar ──────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Sin atributo capture: en movil abre la galeria en vez de la camara. */}
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={elegirFoto} />

      {!foto && (
        <button
          onClick={() => fileRef.current?.click()}
          style={{ ...card2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '26px 12px', cursor: 'pointer', width: '100%' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 32, color: 'var(--os-accent-light)' }}>add_photo_alternate</span>
          <span style={{ fontSize: 'var(--os-text-sm)', color: 'var(--os-text)', fontWeight: 700, fontFamily: 'var(--os-font-display)' }}>Elegir foto de la galeria</span>
          <span style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)' }}>La IA estima alimentos y macros; tu confirmas antes de guardar.</span>
        </button>
      )}

      {foto && (
        <>
          <img src={foto} alt="Foto elegida" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 14, border: '1px solid var(--os-line-soft)' }} />
          <input
            style={input}
            placeholder="Descripcion opcional (ej. sin arroz, doble proteina)"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
          {error && <p style={{ margin: 0, fontSize: 'var(--os-text-sm)', color: 'var(--os-error)' }}>{error}</p>}
          {estimando && <Spinner inline label="Estimando con IA (puede tardar unos segundos)..." />}
          <button style={btn} disabled={estimando} onClick={estimar}>
            {estimando ? 'Estimando...' : reintentable ? 'Reintentar' : 'Estimar'}
          </button>
          <button style={btnGhost} disabled={estimando} onClick={() => fileRef.current?.click()}>Cambiar foto</button>
        </>
      )}
      {!foto && error && <p style={{ margin: 0, fontSize: 'var(--os-text-sm)', color: 'var(--os-error)' }}>{error}</p>}
    </div>
  );
}
