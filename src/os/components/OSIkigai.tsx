// Modulo Ikigai: diagrama de 4 circulos en cruz (amas arriba, mundo abajo,
// bueno izquierda, pagan derecha -- layout classico, sin solape de texto),
// las 4 listas de frases SIEMPRE visibles (no filtradas por tab, para que
// llenar las 4 categorias se sienta como que paso algo), wizard guiado para
// el primer diagnostico, y zonas de vida con su clasificacion. Habla solo
// con /api/ikigai.

import { useEffect, useState } from 'react';
import { Button, EmptyState, Spinner, Badge, useConfirm } from './ui';

type Cuadrante = 'amas' | 'bueno' | 'pagan' | 'mundo';

const LABEL: Record<Cuadrante, string> = {
  amas: 'Lo que amo',
  bueno: 'En lo que soy bueno',
  pagan: 'Por lo que me pagan',
  mundo: 'Lo que el mundo necesita',
};

// Preguntas guia para cuando a alguien no se le ocurre nada. No son las
// unicas preguntas del mundo, son las que de verdad sacan respuestas
// (marco estandar de coaching de ikigai).
const PREGUNTAS: Record<Cuadrante, string[]> = {
  amas: [
    '¿Qué actividad te hace perder la noción del tiempo?',
    '¿Qué harías igual aunque no te pagaran por eso?',
    '¿Qué hacías de niño que todavía te gustaría hacer?',
  ],
  bueno: [
    '¿En qué te reconocen los demás sin que lo pidas?',
    '¿Qué se te hace fácil que a otros les cuesta mucho?',
    '¿Qué te piden ayuda con frecuencia?',
  ],
  pagan: [
    '¿Por qué te han pagado o cobrado hasta hoy?',
    '¿Qué habilidad tuya tiene demanda real en el mercado?',
    '¿Qué harías por dinero aunque no te apasionara tanto?',
  ],
  mundo: [
    '¿Qué problema te frustra ver sin resolver?',
    '¿Qué necesita tu comunidad que tú podrías dar?',
    '¿Qué cambiarías del mundo si pudieras con una sola cosa?',
  ],
};

const ORDEN_CUADRANTES: Cuadrante[] = ['amas', 'bueno', 'pagan', 'mundo'];

const CLASIFICACION_LABEL: Record<string, string> = {
  ikigai: 'Ikigai (el centro)',
  pasion: 'Pasión',
  mision: 'Misión',
  profesion: 'Profesión',
  vocacion: 'Vocación',
  parcial: 'Parcial',
  vacio: 'Sin cuadrantes',
};

interface Mapa {
  id: string;
  version: number;
  titulo: string | null;
  activo: boolean;
}

interface Item {
  id: string;
  mapa_id: string;
  cuadrante: Cuadrante;
  texto: string;
}

interface Zona {
  id: string;
  nombre: string;
  cuadrantes: Cuadrante[];
  descripcion: string | null;
  clasificacion: string;
}

interface Estado {
  mapa: Mapa | null;
  items: Item[];
  zonas: Zona[];
  cobertura: { porCuadrante: Record<Cuadrante, number>; huecos: Cuadrante[] };
}

const inputStyle: React.CSSProperties = {
  background: 'var(--os-fill-subtle)',
  border: '1px solid var(--os-line)',
  borderRadius: 6,
  padding: '7px 11px',
  minHeight: 36,
  fontSize: 'var(--os-text-sm)',
  color: 'var(--os-text)',
  fontFamily: 'var(--os-font-body)',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

const chipStyle: React.CSSProperties = {
  borderRadius: 999,
  cursor: 'pointer',
  padding: '5px 12px',
  minHeight: 32,
  fontSize: 'var(--os-text-xs)',
  fontFamily: 'var(--os-font-display)',
  fontWeight: 700,
};

function chipEstilo(activo: boolean, tonoChampagne = false): React.CSSProperties {
  const color = tonoChampagne ? 'var(--os-champagne)' : 'var(--os-accent-light)';
  const bg = tonoChampagne ? 'rgba(181,152,90,0.18)' : 'rgba(59,78,217,0.14)';
  const border = tonoChampagne ? '1px solid rgba(181,152,90,0.4)' : '1px solid rgba(59,78,217,0.35)';
  return {
    ...chipStyle,
    background: activo ? bg : 'none',
    border: activo ? border : '1px solid var(--os-line)',
    color: activo ? color : 'var(--os-muted)',
  };
}

const CIRCULO_COLOR: Record<Cuadrante, string> = {
  amas: 'rgba(59, 78, 217, 0.30)',
  bueno: 'rgba(139, 92, 246, 0.26)',
  pagan: 'rgba(181, 152, 90, 0.30)',
  mundo: 'rgba(212, 83, 126, 0.22)',
};

// Layout en cruz dentro de un cuadrado de 100 unidades: amas arriba, mundo
// abajo, bueno izquierda, pagan derecha. Circulo = 58 unidades, offset =
// (100-58)/2 = 21. El bug reportado (labels pisandose) era porque la
// version anterior ponia amas Y mundo los dos en la fila de arriba -- este
// layout es una cruz real, cada circulo en su propio lado.
const CIRCULO_POS: Record<Cuadrante, { top: number; left: number }> = {
  amas: { top: 0, left: 21 },
  mundo: { top: 42, left: 21 },
  bueno: { top: 21, left: 0 },
  pagan: { top: 21, left: 42 },
};

// Posicion del LABEL (fuera del circulo, en el margen del contenedor) para
// que nunca se superponga con otro label ni con el texto de adentro.
const LABEL_POS: Record<Cuadrante, React.CSSProperties> = {
  amas: { top: 0, left: '50%', transform: 'translate(-50%, -100%)', textAlign: 'center' },
  mundo: { bottom: 0, left: '50%', transform: 'translate(-50%, 100%)', textAlign: 'center' },
  bueno: { top: '50%', left: 0, transform: 'translate(-100%, -50%)', textAlign: 'right', width: 110 },
  pagan: { top: '50%', right: 0, transform: 'translate(100%, -50%)', textAlign: 'left', width: 110 },
};

export default function OSIkigai() {
  const { confirm, sheet } = useConfirm();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  // Wizard guiado: activo cuando aun no hay items, o si el usuario lo pide.
  const [wizardActivo, setWizardActivo] = useState(false);
  const [wizardPaso, setWizardPaso] = useState(0);
  const [wizardTexto, setWizardTexto] = useState('');

  // Captura libre por cuadrante (siempre visible, una vez pasado el wizard).
  const [textoPorCuadrante, setTextoPorCuadrante] = useState<Record<Cuadrante, string>>({ amas: '', bueno: '', pagan: '', mundo: '' });

  const [nombreZona, setNombreZona] = useState('');
  const [cuadrantesZona, setCuadrantesZona] = useState<Cuadrante[]>([]);

  async function load() {
    try {
      const res = await fetch('/api/ikigai');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || String(res.status));
      const e = data as Estado;
      setEstado(e);
      // Primera vez (mapa recien creado, cero items): entra directo al wizard.
      if (e.mapa && e.items.length === 0) {
        setWizardActivo(true);
        setWizardPaso(0);
      }
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function llamar(url: string, init: RequestInit): Promise<Record<string, unknown>> {
    const res = await fetch(url, init);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error || String(res.status));
    return data as Record<string, unknown>;
  }

  async function accion(fn: () => Promise<unknown>, mensaje?: string) {
    try {
      await fn();
      setError('');
      if (mensaje) setAviso(mensaje);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function iniciarPrimerMapa() {
    await accion(() => llamar('/api/ikigai', { method: 'POST', body: JSON.stringify({ mapa: {} }) }));
  }

  async function rediagnosticar() {
    const ok = await confirm({
      title: 'Crear nueva versión del diagnóstico',
      text: 'Tus frases y zonas actuales se copian a la versión nueva para que las ajustes, no se pierden. La versión anterior queda guardada intacta para comparar.',
      confirmLabel: 'Crear versión nueva',
    });
    if (!ok) return;
    await accion(
      () => llamar('/api/ikigai', { method: 'POST', body: JSON.stringify({ mapa: { titulo: `Rediagnóstico ${new Date().toLocaleDateString('es')}` } }) }),
      'Nueva versión creada con tus frases anteriores. Ajusta lo que cambió.'
    );
  }

  async function agregarItemEn(cuadrante: Cuadrante, texto: string) {
    if (!estado?.mapa || !texto.trim()) return;
    await accion(() =>
      llamar('/api/ikigai', { method: 'POST', body: JSON.stringify({ item: { mapa_id: estado.mapa!.id, cuadrante, texto } }) })
    );
  }

  async function agregarDesdeCaptura(cuadrante: Cuadrante) {
    const texto = textoPorCuadrante[cuadrante];
    if (!texto.trim()) return;
    await agregarItemEn(cuadrante, texto);
    setTextoPorCuadrante((prev) => ({ ...prev, [cuadrante]: '' }));
  }

  async function agregarDesdeWizard() {
    if (!wizardTexto.trim()) return;
    await agregarItemEn(ORDEN_CUADRANTES[wizardPaso], wizardTexto);
    setWizardTexto('');
  }

  function siguienteEnWizard() {
    if (wizardPaso < 3) {
      setWizardPaso((p) => p + 1);
      setWizardTexto('');
    } else {
      setWizardActivo(false);
    }
  }

  async function crearZona() {
    if (!estado?.mapa || !nombreZona.trim() || cuadrantesZona.length === 0) return;
    await accion(() =>
      llamar('/api/ikigai', { method: 'POST', body: JSON.stringify({ zona: { mapa_id: estado.mapa!.id, nombre: nombreZona, cuadrantes: cuadrantesZona } }) })
    );
    setNombreZona('');
    setCuadrantesZona([]);
  }

  function toggleCuadranteZona(c: Cuadrante) {
    setCuadrantesZona((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  // Sugerencia de zona: agrupa items que sirven a 2+ cuadrantes en simultaneo
  // no es posible detectar solo, pero si hay items en un cuadrante y CERO
  // zonas, se lo decimos explicito -- ese es justo el hueco que confundio.
  function itemsDe(c: Cuadrante): Item[] {
    return estado?.items.filter((i) => i.cuadrante === c) ?? [];
  }

  if (loading) return <Spinner label="Cargando ikigai..." />;

  if (!estado?.mapa) {
    return (
      <div className="os-card-2">
        <EmptyState
          icon="self_improvement"
          title="Sin diagnóstico todavía"
          text="El ikigai es el bloque B01 de tu propia metodología WCM: propósito antes que ejecución. Te voy guiando cuadrante por cuadrante."
          action={<Button size="sm" onClick={iniciarPrimerMapa}>Empezar diagnóstico</Button>}
        />
      </div>
    );
  }

  // --- Modo wizard: un cuadrante a la vez, con preguntas guia -------------
  if (wizardActivo) {
    const cuadrante = ORDEN_CUADRANTES[wizardPaso];
    const yaCapturados = itemsDe(cuadrante);
    return (
      <div className="os-card-2" style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 560 }}>
        {sheet}
        {error && <p style={{ color: 'var(--os-error)', fontSize: 'var(--os-text-xs)' }}>Error: {error}</p>}
        <p className="os-eyebrow" style={{ marginBottom: 0 }}>Paso {wizardPaso + 1} de 4</p>
        <p style={{ fontSize: 'var(--os-text-2xl, 1.25rem)', fontFamily: 'var(--os-font-display)', fontWeight: 700, color: 'var(--os-text)', margin: 0 }}>
          {LABEL[cuadrante]}
        </p>
        <div style={{ background: 'var(--os-fill-subtle)', borderRadius: 8, padding: 12 }}>
          <p style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Si no se te ocurre nada, responde una de estas
          </p>
          {PREGUNTAS[cuadrante].map((p) => (
            <p key={p} style={{ fontSize: 'var(--os-text-sm)', color: 'var(--os-text-2)', margin: '0 0 4px' }}>· {p}</p>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            style={inputStyle}
            placeholder="Escribe una frase corta"
            value={wizardTexto}
            onChange={(e) => setWizardTexto(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && agregarDesdeWizard()}
            autoFocus
          />
          <Button size="sm" onClick={agregarDesdeWizard} disabled={!wizardTexto.trim()}>Agregar</Button>
        </div>
        {yaCapturados.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {yaCapturados.map((i) => <Badge key={i.id}>{i.texto}</Badge>)}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <Button size="sm" variant="ghost" onClick={() => setWizardActivo(false)}>Salir del wizard</Button>
          <Button size="sm" onClick={siguienteEnWizard}>{wizardPaso < 3 ? 'Siguiente cuadrante' : 'Terminar'}</Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {sheet}
      {error && <p style={{ color: 'var(--os-error)', fontSize: 'var(--os-text-xs)' }}>Error: {error}</p>}
      {aviso && <p style={{ color: 'var(--os-champagne)', fontSize: 'var(--os-text-xs)' }}>{aviso}</p>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p className="os-eyebrow" style={{ marginBottom: 0 }}>Versión {estado.mapa.version}{estado.mapa.titulo ? ` · ${estado.mapa.titulo}` : ''}</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="sm" variant="ghost" onClick={() => { setWizardPaso(0); setWizardActivo(true); }}>Wizard guiado</Button>
          <Button size="sm" variant="ghost" onClick={rediagnosticar}>Rediagnosticar</Button>
        </div>
      </div>

      {/* Diagrama de 4 circulos en cruz, sin solape de labels */}
      <div style={{ position: 'relative', width: '100%', maxWidth: 460, aspectRatio: '1', margin: '48px auto' }}>
        {ORDEN_CUADRANTES.map((c) => (
          <div key={c}>
            <div
              style={{
                position: 'absolute',
                width: '58%',
                height: '58%',
                top: `${CIRCULO_POS[c].top}%`,
                left: `${CIRCULO_POS[c].left}%`,
                borderRadius: '50%',
                background: CIRCULO_COLOR[c],
                mixBlendMode: 'screen',
              }}
            />
            <span
              style={{
                position: 'absolute',
                fontFamily: 'var(--os-font-display)',
                fontWeight: 700,
                fontSize: 'var(--os-text-xs)',
                color: 'var(--os-text-2)',
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                whiteSpace: 'nowrap',
                ...LABEL_POS[c],
              }}
            >
              {LABEL[c]}
            </span>
          </div>
        ))}
        <div style={{
          position: 'absolute', top: '38%', left: '38%', width: '24%', height: '24%',
          borderRadius: '50%', background: 'var(--os-champagne)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 24px rgba(181,152,90,0.5)', zIndex: 2,
        }}>
          <span style={{ fontFamily: 'var(--os-font-display)', fontWeight: 900, fontSize: 'var(--os-text-xs)', color: '#0E1738' }}>IKIGAI</span>
        </div>
      </div>

      {/* Las 4 listas SIEMPRE visibles a la vez -- llenar las 4 categorias
          se tiene que sentir como que paso algo, no quedar escondido detras
          de una pestaña activa. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
        {ORDEN_CUADRANTES.map((c) => (
          <div key={c} className="os-card-2" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p className="os-eyebrow" style={{ marginBottom: 0 }}>{LABEL[c]} ({itemsDe(c).length})</p>
            {itemsDe(c).length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {itemsDe(c).map((i) => <Badge key={i.id}>{i.texto}</Badge>)}
              </div>
            )}
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                style={inputStyle}
                placeholder="Agregar frase..."
                value={textoPorCuadrante[c]}
                onChange={(e) => setTextoPorCuadrante((prev) => ({ ...prev, [c]: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && agregarDesdeCaptura(c)}
              />
              <Button size="sm" variant="ghost" onClick={() => agregarDesdeCaptura(c)} disabled={!textoPorCuadrante[c].trim()}>+</Button>
            </div>
          </div>
        ))}
      </div>

      {/* Cobertura: aclara explicitamente que se calcula de ZONAS, no de items */}
      {estado.items.length > 0 && estado.zonas.length === 0 && (
        <div className="os-card-2" style={{ borderColor: 'rgba(181,152,90,0.4)' }}>
          <p className="os-eyebrow" style={{ marginBottom: 4 }}>Siguiente paso</p>
          <p style={{ fontSize: 'var(--os-text-sm)', color: 'var(--os-text-2)', margin: 0 }}>
            Ya tienes {estado.items.length} frases capturadas. La cobertura (qué cuadrante te falta vivir) se calcula de <b>zonas de vida</b>, no de frases sueltas. Crea al menos una zona abajo para ver tu mapa real.
          </p>
        </div>
      )}
      {estado.zonas.length > 0 && estado.cobertura.huecos.length > 0 && (
        <div className="os-card-2" style={{ borderColor: 'rgba(212,83,126,0.3)' }}>
          <p className="os-eyebrow" style={{ marginBottom: 4 }}>Huecos de cobertura</p>
          <p style={{ fontSize: 'var(--os-text-sm)', color: 'var(--os-text-2)', margin: 0 }}>
            Ninguna zona de vida sirve a: {estado.cobertura.huecos.map((h) => LABEL[h]).join(', ')}.
          </p>
        </div>
      )}

      {/* Zonas de vida */}
      <div className="os-card-2" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ padding: '0.75rem', borderRadius: 8, background: 'rgba(59,78,217,0.10)', border: '1px solid rgba(59,78,217,0.22)' }}>
          <p className="os-eyebrow" style={{ marginBottom: 4 }}>Zonas de vida</p>
          <p style={{ fontSize: 'var(--os-text-sm)', color: 'var(--os-text-2)', margin: 0 }}>Una zona es un área real de tu vida o proyecto, marcada por los cuadrantes que satisface. Con ellas el OS detecta qué parte de tu Ikigai aún no estás viviendo.</p>
        </div>
        {estado.zonas.length === 0 && (
          <p style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', margin: 0 }}>Ejemplos: BrainTech, Familia, Salud o Comunidad.</p>
        )}
        {estado.zonas.map((z) => (
          <div key={z.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--os-line-soft)' }}>
            <div>
              <p style={{ fontSize: 'var(--os-text-sm)', fontWeight: 700, color: 'var(--os-text)', margin: 0 }}>{z.nombre}</p>
              <p style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', margin: 0 }}>{z.cuadrantes.map((c) => LABEL[c]).join(' + ')}</p>
            </div>
            <Badge tone={z.clasificacion === 'ikigai' ? 'ok' : undefined}>{CLASIFICACION_LABEL[z.clasificacion] ?? z.clasificacion}</Badge>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
          {ORDEN_CUADRANTES.map((c) => (
            <button key={c} onClick={() => toggleCuadranteZona(c)} style={chipEstilo(cuadrantesZona.includes(c), true)}>
              {LABEL[c]}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input style={inputStyle} placeholder="Nombre de la zona (ej: BrainTech)" value={nombreZona} onChange={(e) => setNombreZona(e.target.value)} />
          <Button size="sm" onClick={crearZona} disabled={!nombreZona.trim() || cuadrantesZona.length === 0}>Crear zona</Button>
        </div>
      </div>
    </div>
  );
}
