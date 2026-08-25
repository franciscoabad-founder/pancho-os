// Modulo Ikigai: diagrama de 4 circulos, zonas de vida con su clasificacion,
// y cobertura (que cuadrante no tiene ninguna zona sirviendolo). Habla solo
// con /api/ikigai.
//
// El diagrama se dibuja con 4 divs circulares posicionados en cruz y
// mix-blend-mode: screen para simular la superposicion clasica sin canvas ni
// d3 -- mismo efecto visual, sin la dependencia.

import { useEffect, useState } from 'react';
import { Button, EmptyState, Spinner, Badge } from './ui';

type Cuadrante = 'amas' | 'bueno' | 'pagan' | 'mundo';

const LABEL: Record<Cuadrante, string> = {
  amas: 'Lo que amo',
  bueno: 'En lo que soy bueno',
  pagan: 'Por lo que me pagan',
  mundo: 'Lo que el mundo necesita',
};

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

const CIRCULO_COLOR: Record<Cuadrante, string> = {
  amas: 'rgba(59, 78, 217, 0.32)',
  bueno: 'rgba(139, 92, 246, 0.28)',
  pagan: 'rgba(181, 152, 90, 0.32)',
  mundo: 'rgba(212, 83, 126, 0.24)',
};

const CIRCULO_POS: Record<Cuadrante, React.CSSProperties> = {
  amas: { top: 0, left: '25%' },
  mundo: { top: 0, left: 'auto', right: '0%' },
  bueno: { top: '25%', left: 0 },
  pagan: { top: '25%', right: 0 },
};

export default function OSIkigai() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [cuadranteActivo, setCuadranteActivo] = useState<Cuadrante>('amas');
  const [textoItem, setTextoItem] = useState('');
  const [nombreZona, setNombreZona] = useState('');
  const [cuadrantesZona, setCuadrantesZona] = useState<Cuadrante[]>([]);

  async function load() {
    try {
      const res = await fetch('/api/ikigai');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || String(res.status));
      setEstado(data as Estado);
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
    await accion(() => llamar('/api/ikigai', { method: 'POST', body: JSON.stringify({ mapa: {} }) }), 'Diagnostico iniciado.');
  }

  async function rediagnosticar() {
    await accion(
      () => llamar('/api/ikigai', { method: 'POST', body: JSON.stringify({ mapa: { titulo: `Rediagnóstico ${new Date().toLocaleDateString('es')}` } }) }),
      'Nueva versión creada. La anterior queda guardada para comparar.'
    );
  }

  async function agregarItem() {
    if (!estado?.mapa || !textoItem.trim()) return;
    await accion(() =>
      llamar('/api/ikigai', { method: 'POST', body: JSON.stringify({ item: { mapa_id: estado.mapa!.id, cuadrante: cuadranteActivo, texto: textoItem } }) })
    );
    setTextoItem('');
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

  if (loading) return <Spinner label="Cargando ikigai..." />;

  if (!estado?.mapa) {
    return (
      <div className="os-card-2">
        <EmptyState
          icon="self_improvement"
          title="Sin diagnóstico todavía"
          text="El ikigai es el bloque B01 de tu propia metodología WCM: propósito antes que ejecución."
          action={<Button size="sm" onClick={iniciarPrimerMapa}>Empezar diagnóstico</Button>}
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {error && <p style={{ color: 'var(--os-error)', fontSize: 'var(--os-text-xs)' }}>Error: {error}</p>}
      {aviso && <p style={{ color: 'var(--os-champagne)', fontSize: 'var(--os-text-xs)' }}>{aviso}</p>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p className="os-eyebrow">Versión {estado.mapa.version}{estado.mapa.titulo ? ` · ${estado.mapa.titulo}` : ''}</p>
        <Button size="sm" variant="ghost" onClick={rediagnosticar}>Rediagnosticar</Button>
      </div>

      {/* Diagrama de 4 circulos */}
      <div style={{ position: 'relative', width: '100%', maxWidth: 520, aspectRatio: '1', margin: '0 auto', mixBlendMode: 'normal' as const }}>
        {(['amas', 'bueno', 'pagan', 'mundo'] as Cuadrante[]).map((c) => (
          <div
            key={c}
            style={{
              position: 'absolute',
              width: '75%',
              height: '75%',
              borderRadius: '50%',
              background: CIRCULO_COLOR[c],
              mixBlendMode: 'screen',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'center',
              paddingTop: 16,
              ...CIRCULO_POS[c],
            }}
          >
            <span style={{ fontFamily: 'var(--os-font-display)', fontWeight: 700, fontSize: 'var(--os-text-xs)', color: 'var(--os-text)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {LABEL[c]}
            </span>
          </div>
        ))}
        <div style={{
          position: 'absolute', top: '38%', left: '38%', width: '24%', height: '24%',
          borderRadius: '50%', background: 'var(--os-champagne)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 24px rgba(181,152,90,0.5)',
        }}>
          <span style={{ fontFamily: 'var(--os-font-display)', fontWeight: 900, fontSize: 'var(--os-text-xs)', color: 'var(--os-ink, #0E1738)' }}>IKIGAI</span>
        </div>
      </div>

      {/* Captura de items por cuadrante */}
      <div className="os-card-2" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p className="os-eyebrow" style={{ marginBottom: 0 }}>Agregar frase</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['amas', 'bueno', 'pagan', 'mundo'] as Cuadrante[]).map((c) => (
            <button
              key={c}
              onClick={() => setCuadranteActivo(c)}
              style={{
                ...chipStyle,
                background: cuadranteActivo === c ? 'rgba(59,78,217,0.14)' : 'none',
                border: cuadranteActivo === c ? '1px solid rgba(59,78,217,0.35)' : '1px solid var(--os-line)',
                color: cuadranteActivo === c ? 'var(--os-accent-light)' : 'var(--os-muted)',
              }}
            >
              {LABEL[c]}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            style={inputStyle}
            placeholder="Ej: Diseñar sistemas"
            value={textoItem}
            onChange={(e) => setTextoItem(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && agregarItem()}
          />
          <Button size="sm" onClick={agregarItem} disabled={!textoItem.trim()}>Agregar</Button>
        </div>
        {estado.items.filter((i) => i.cuadrante === cuadranteActivo).length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {estado.items.filter((i) => i.cuadrante === cuadranteActivo).map((i) => (
              <Badge key={i.id}>{i.texto}</Badge>
            ))}
          </div>
        )}
      </div>

      {/* Cobertura */}
      {estado.cobertura.huecos.length > 0 && (
        <div className="os-card-2" style={{ borderColor: 'rgba(212,83,126,0.3)' }}>
          <p className="os-eyebrow" style={{ marginBottom: 4 }}>Huecos de cobertura</p>
          <p style={{ fontSize: 'var(--os-text-sm)', color: 'var(--os-text-2)', margin: 0 }}>
            Ninguna zona de vida sirve a: {estado.cobertura.huecos.map((h) => LABEL[h]).join(', ')}.
          </p>
        </div>
      )}

      {/* Zonas de vida */}
      <div className="os-card-2" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p className="os-eyebrow" style={{ marginBottom: 0 }}>Zonas de vida</p>
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
          {(['amas', 'bueno', 'pagan', 'mundo'] as Cuadrante[]).map((c) => (
            <button
              key={c}
              onClick={() => toggleCuadranteZona(c)}
              style={{
                ...chipStyle,
                background: cuadrantesZona.includes(c) ? 'rgba(181,152,90,0.18)' : 'none',
                border: cuadrantesZona.includes(c) ? '1px solid rgba(181,152,90,0.4)' : '1px solid var(--os-line)',
                color: cuadrantesZona.includes(c) ? 'var(--os-champagne)' : 'var(--os-muted)',
              }}
            >
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
