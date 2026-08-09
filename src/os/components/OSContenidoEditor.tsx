import { useState } from 'react';
import { Button } from './ui';

// Editor rapido de borradores (solo en sesion, sin persistencia todavia).

interface Borrador {
  id: string;
  titulo: string;
  cuerpo: string;
  plataforma: string;
  fecha: string;
}

const PLATAFORMAS = ['linkedin', 'instagram', 'blog'] as const;
type Plataforma = typeof PLATAFORMAS[number];

const PLAT_COLOR: Record<string, string> = {
  linkedin:  'var(--os-accent)',
  instagram: 'var(--os-champagne)',
  blog:      'var(--os-accent-light)',
};
// Tints con alpha (var() no se puede concatenar con sufijo hex).
const PLAT_BG: Record<string, string> = {
  linkedin:  'rgba(59,78,217,0.13)',
  instagram: 'rgba(181,152,90,0.13)',
  blog:      'rgba(107,122,232,0.13)',
};

export default function OSContenidoEditor() {
  const [borradores, setBorradores] = useState<Borrador[]>([]);
  const [titulo, setTitulo] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [plataforma, setPlataforma] = useState<Plataforma>('linkedin');
  const [flash, setFlash] = useState(false);

  const guardar = () => {
    if (!titulo.trim() && !cuerpo.trim()) return;
    const nuevo: Borrador = {
      id: Date.now().toString(),
      titulo: titulo.trim() || '(sin titulo)',
      cuerpo: cuerpo.trim(),
      plataforma,
      fecha: new Date().toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' }),
    };
    setBorradores(prev => [nuevo, ...prev]);
    setTitulo('');
    setCuerpo('');
    setFlash(true);
    setTimeout(() => setFlash(false), 1800);
  };

  const eliminar = (id: string) => setBorradores(prev => prev.filter(b => b.id !== id));

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--os-fill-subtle)',
    border: '1px solid var(--os-line)',
    borderRadius: 7,
    padding: '0.625rem 0.75rem',
    minHeight: 36,
    color: 'var(--os-text)',
    fontFamily: 'var(--os-font-body)',
    outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <div>
      {/* Editor */}
      <div className="os-card-2" style={{ marginBottom: '1rem' }}>
        <p className="os-section-title" style={{ marginBottom: '0.875rem' }}>
          Nuevo borrador
        </p>

        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          {PLATAFORMAS.map(p => (
            <button
              key={p}
              onClick={() => setPlataforma(p)}
              style={{
                padding: '3px 10px',
                minHeight: 36,
                borderRadius: 5,
                border: `1px solid ${plataforma === p ? PLAT_COLOR[p] : 'var(--os-line)'}`,
                background: plataforma === p ? PLAT_BG[p] : 'transparent',
                color: plataforma === p ? PLAT_COLOR[p] : 'var(--os-muted)',
                fontFamily: 'var(--os-font-display)',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'all 0.14s',
              }}
            >{p}</button>
          ))}
        </div>

        <input
          type="text"
          value={titulo}
          onChange={e => setTitulo(e.target.value)}
          placeholder="Titulo o hook..."
          style={{ ...inputStyle, fontSize: 'var(--os-text-base)', marginBottom: 8 }}
        />
        <textarea
          value={cuerpo}
          onChange={e => setCuerpo(e.target.value)}
          placeholder="Contenido del post..."
          rows={6}
          style={{ ...inputStyle, fontSize: 'var(--os-text-sm)', resize: 'vertical', lineHeight: 1.5, marginBottom: 10 }}
        />
        {/* TODO: AI assist - generar variantes, mejorar hook */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', fontFamily: 'var(--os-font-mono)' }}>
            {cuerpo.length} car
          </span>
          <Button size="sm" onClick={guardar} style={flash ? { background: 'rgba(59,78,217,0.35)' } : undefined}>
            {flash ? 'Guardado' : 'Guardar borrador'}
          </Button>
        </div>
      </div>

      {/* Lista de borradores */}
      {borradores.length > 0 && (
        <div className="os-card-2">
          <p className="os-section-title" style={{ marginBottom: '0.75rem' }}>
            Borradores en sesion ({borradores.length})
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {borradores.map(b => (
              <div key={b.id} style={{ padding: '0.625rem 0.75rem', borderRadius: 7, background: 'var(--os-fill-subtle)', border: '1px solid var(--os-line-soft)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 'var(--os-text-sm)', fontWeight: 600, color: 'var(--os-text)' }}>{b.titulo}</span>
                    <span style={{ fontSize: 11, color: PLAT_COLOR[b.plataforma] ?? 'var(--os-muted)', fontFamily: 'var(--os-font-display)', letterSpacing: '0.08em', textTransform: 'uppercase', flexShrink: 0 }}>{b.plataforma}</span>
                    <span style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', flexShrink: 0 }}>{b.fecha}</span>
                  </div>
                  {b.cuerpo && (
                    <p style={{ fontSize: 'var(--os-text-sm)', color: 'var(--os-muted)', margin: 0, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {b.cuerpo}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => eliminar(b.id)}
                  aria-label="Eliminar borrador"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--os-muted)', padding: '2px 4px', minWidth: 36, minHeight: 36, flexShrink: 0, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
