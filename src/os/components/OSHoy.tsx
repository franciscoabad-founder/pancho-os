import { useEffect, useState } from 'react';
import { datosDaily } from '../data/daily';
import OSChecklistHoy from './OSChecklistHoy';
import { Spinner } from './ui';

// Isla que reemplaza los datos demo del dashboard "Hoy" por los endpoints reales
// (os_dia, os_wins, os_priority_stack, os_semana, os_objetivos). Fetch en el cliente
// a proposito: este archivo vive en una pagina con `prerender = false`, y reenviar la
// cookie desde el frontmatter .astro es fragil; el fetch del navegador ya manda la
// cookie de sesion sola al ser same-origin. Si un fetch falla, la seccion cae a un
// estado vacio en vez de tumbar la pagina.

interface DiaOS {
  fecha: string;
  domino_titulo: string | null;
  domino_linea: string | null;
  domino_razon: string | null;
  domino_hecho: boolean;
  discomfort_titulo: string | null;
  discomfort_hecho: boolean;
  nota: string | null;
}
interface Win { id: string; fecha: string; texto: string; categoria: string | null; }
interface Prioridad { id: string; orden: number; titulo: string; objetivo_id: string | null; hecho: boolean; }
interface Objetivo { id: string; orden: number; titulo: string; descripcion: string | null; }
interface DiaSemana { dia: number; modo: 'maker' | 'manager' | 'off'; sale: string | null; etiqueta: string | null; }

const DIA_LABEL = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];
const MODO_COLOR: Record<string, string> = { maker: 'var(--os-accent-light)', manager: 'var(--os-muted)', off: 'var(--os-muted)' };
const MODO_BG: Record<string, string> = { maker: 'rgba(59,78,217,0.15)', manager: 'var(--os-fill-subtle)', off: 'var(--os-fill-subtle)' };
const MODO_LABEL: Record<string, string> = { maker: 'Maker', manager: 'Manager', off: 'Off' };

async function safeJson(url: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default function OSHoy() {
  const [dia, setDia] = useState<DiaOS | null>(null);
  const [wins, setWins] = useState<Win[]>([]);
  const [prioridades, setPrioridades] = useState<Prioridad[]>([]);
  const [objetivos, setObjetivos] = useState<Objetivo[]>([]);
  const [semana, setSemana] = useState<DiaSemana[]>([]);
  const [loading, setLoading] = useState(true);

  const [editDomino, setEditDomino] = useState(false);
  const [editDiscomfort, setEditDiscomfort] = useState(false);
  const [formDomino, setFormDomino] = useState({ titulo: '', linea: '', razon: '' });
  const [formDiscomfort, setFormDiscomfort] = useState('');
  const [nuevoWin, setNuevoWin] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    const [diaRes, stackRes, objRes, semRes] = await Promise.all([
      safeJson('/api/os/dia'),
      safeJson('/api/os/priority-stack'),
      safeJson('/api/os/objetivos'),
      safeJson('/api/os/semana'),
    ]);
    if (diaRes) {
      setDia(diaRes.dia ?? null);
      setWins(diaRes.wins ?? []);
    }
    if (stackRes) setPrioridades((stackRes.prioridades ?? []).sort((a: Prioridad, b: Prioridad) => a.orden - b.orden));
    if (objRes) setObjetivos((objRes.objetivos ?? []).sort((a: Objetivo, b: Objetivo) => a.orden - b.orden));
    if (semRes) setSemana(semRes.dias ?? []);
    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function guardarDia(patch: Record<string, unknown>) {
    setGuardando(true);
    try {
      const res = await fetch('/api/os/dia', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (data.dia) setDia(data.dia);
    } catch {
      /* degrade en silencio, el usuario puede reintentar */
    } finally {
      setGuardando(false);
    }
  }

  async function guardarDomino() {
    if (!formDomino.titulo.trim()) return;
    await guardarDia({
      domino_titulo: formDomino.titulo.trim(),
      domino_linea: formDomino.linea.trim() || null,
      domino_razon: formDomino.razon.trim() || null,
    });
    setEditDomino(false);
  }

  async function guardarDiscomfort() {
    if (!formDiscomfort.trim()) return;
    await guardarDia({ discomfort_titulo: formDiscomfort.trim() });
    setEditDiscomfort(false);
  }

  async function toggleDominoHecho() {
    if (!dia) return;
    await guardarDia({ domino_hecho: !dia.domino_hecho });
  }

  async function toggleDiscomfortHecho() {
    if (!dia) return;
    await guardarDia({ discomfort_hecho: !dia.discomfort_hecho });
  }

  async function togglePrioridad(p: Prioridad) {
    setPrioridades((cur) => cur.map((x) => (x.id === p.id ? { ...x, hecho: !x.hecho } : x)));
    try {
      const res = await fetch(`/api/os/priority-stack?id=${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hecho: !p.hecho }),
      });
      const data = await res.json();
      if (data.prioridad) setPrioridades((cur) => cur.map((x) => (x.id === p.id ? data.prioridad : x)));
    } catch {
      setPrioridades((cur) => cur.map((x) => (x.id === p.id ? { ...x, hecho: p.hecho } : x)));
    }
  }

  async function agregarWin() {
    const texto = nuevoWin.trim();
    if (!texto) return;
    setNuevoWin('');
    try {
      const res = await fetch('/api/os/dia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ win: { texto } }),
      });
      const data = await res.json();
      if (data.win) setWins((cur) => [...cur, data.win]);
    } catch {
      /* si falla, el usuario ve que no aparecio y puede reintentar */
    }
  }

  const check = (activo: boolean) => (
    <span
      style={{
        width: 17, height: 17, flexShrink: 0, borderRadius: 4,
        border: activo ? '2px solid var(--os-champagne)' : '2px solid var(--os-line)',
        background: activo ? 'var(--os-champagne)' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.16s',
      }}
    >
      {activo && (
        <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
          <polyline points="1,3.5 3.5,6 8,1" stroke="#1A1A1A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );

  if (loading) {
    return (
      <div className="os-domino" style={{ marginBottom: '1rem' }}>
        <p className="os-eyebrow" style={{ marginBottom: '0.5rem' }}>One Domino</p>
        <Spinner inline label="Cargando el dia..." />
      </div>
    );
  }

  return (
    <>
      {/* One Domino */}
      <div className="os-domino" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <p className="os-eyebrow" style={{ marginBottom: '0.5rem' }}>One Domino</p>
          {dia?.domino_titulo && !editDomino && (
            <button
              onClick={() => {
                setFormDomino({
                  titulo: dia.domino_titulo ?? '',
                  linea: dia.domino_linea ?? '',
                  razon: dia.domino_razon ?? '',
                });
                setEditDomino(true);
              }}
              style={{ background: 'transparent', border: 'none', color: 'var(--os-muted)', fontSize: 11, cursor: 'pointer', padding: 0 }}
            >
              Editar
            </button>
          )}
        </div>

        {editDomino || !dia?.domino_titulo ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              className="os-input"
              placeholder="Cual es tu domino de hoy"
              value={formDomino.titulo}
              onChange={(e) => setFormDomino((f) => ({ ...f, titulo: e.target.value }))}
              style={{ width: '100%' }}
            />
            <input
              className="os-input"
              placeholder="Proyecto o linea (opcional)"
              value={formDomino.linea}
              onChange={(e) => setFormDomino((f) => ({ ...f, linea: e.target.value }))}
              style={{ width: '100%' }}
            />
            <input
              className="os-input"
              placeholder="Por que importa (opcional)"
              value={formDomino.razon}
              onChange={(e) => setFormDomino((f) => ({ ...f, razon: e.target.value }))}
              style={{ width: '100%' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="os-btn" disabled={guardando || !formDomino.titulo.trim()} onClick={guardarDomino}>
                Guardar
              </button>
              {dia?.domino_titulo && (
                <button className="os-btn os-btn-ghost" onClick={() => setEditDomino(false)}>
                  Cancelar
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <button onClick={toggleDominoHecho} style={{ background: 'transparent', border: 'none', padding: '2px 0 0', cursor: 'pointer' }}>
                {check(dia.domino_hecho)}
              </button>
              <div>
                <p
                  style={{
                    fontSize: '1.125rem', fontWeight: 600, color: 'var(--os-text)', margin: '0 0 0.375rem', lineHeight: 1.3,
                    textDecoration: dia.domino_hecho ? 'line-through' : 'none',
                    opacity: dia.domino_hecho ? 0.65 : 1,
                  }}
                >
                  {dia.domino_titulo}
                </p>
                {dia.domino_linea && (
                  <p style={{ fontSize: 12, color: 'var(--os-accent-light)', margin: '0 0 0.5rem' }}>{dia.domino_linea}</p>
                )}
                {dia.domino_razon && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--os-text-2)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--os-accent-light)' }}>lightbulb</span>
                    <span style={{ fontSize: 13, fontStyle: 'italic', lineHeight: 1.4 }}>{dia.domino_razon}</span>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* 2-col: priorities/wins + discomfort/principios (checklist va aparte en el .astro) */}
      <div className="os-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="os-card" style={{ flex: 1 }}>
            <p className="os-section-title">Priority Stack</p>
            {prioridades.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--os-muted)', margin: 0 }}>
                Sin prioridades definidas esta semana.
              </p>
            ) : (
              <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {prioridades.map((p) => (
                  <li key={p.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <button onClick={() => togglePrioridad(p)} style={{ background: 'transparent', border: 'none', padding: '1px 0 0', cursor: 'pointer' }}>
                      {check(p.hecho)}
                    </button>
                    <span
                      style={{
                        fontSize: 13, color: 'var(--os-text)',
                        textDecoration: p.hecho ? 'line-through' : 'none',
                        opacity: p.hecho ? 0.6 : 1,
                      }}
                    >
                      {p.titulo}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="os-card">
            <p className="os-section-title">Wins recientes</p>
            {wins.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--os-muted)', margin: '0 0 0.625rem' }}>Aun no registras wins hoy.</p>
            ) : (
              <ul style={{ listStyle: 'none', margin: '0 0 0.625rem', padding: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
                {wins.map((w) => (
                  <li key={w.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 15, color: 'var(--os-champagne)', flexShrink: 0, marginTop: 1 }}>check_circle</span>
                    <span style={{ fontSize: 13, color: 'var(--os-text-2)', lineHeight: 1.4 }}>{w.texto}</span>
                  </li>
                ))}
              </ul>
            )}
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                className="os-input"
                placeholder="Agregar un win"
                value={nuevoWin}
                onChange={(e) => setNuevoWin(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') agregarWin(); }}
                style={{ flex: 1 }}
              />
              <button className="os-btn" onClick={agregarWin} disabled={!nuevoWin.trim()}>
                Agregar
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="os-card">
            <OSChecklistHoy title="Checklist del dia" />
          </div>

          <div
            className="os-card"
            style={{ borderColor: 'rgba(255,180,171,0.22)', background: 'linear-gradient(180deg,rgba(147,0,10,0.10),var(--os-surface))' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.625rem' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--os-warn)' }}>priority_high</span>
              <p className="os-eyebrow" style={{ color: 'var(--os-warn)', margin: 0 }}>Discomfort First</p>
            </div>

            {editDiscomfort || !dia?.discomfort_titulo ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  className="os-input"
                  placeholder="Lo incomodo que toca hacer hoy"
                  value={formDiscomfort}
                  onChange={(e) => setFormDiscomfort(e.target.value)}
                  style={{ width: '100%' }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="os-btn" disabled={guardando || !formDiscomfort.trim()} onClick={guardarDiscomfort}>
                    Guardar
                  </button>
                  {dia?.discomfort_titulo && (
                    <button className="os-btn os-btn-ghost" onClick={() => setEditDiscomfort(false)}>
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <button onClick={toggleDiscomfortHecho} style={{ background: 'transparent', border: 'none', padding: '2px 0 0', cursor: 'pointer' }}>
                  {check(dia.discomfort_hecho)}
                </button>
                <div style={{ flex: 1 }}>
                  <p
                    style={{
                      fontSize: 14, fontWeight: 600, color: 'var(--os-text)', margin: 0, lineHeight: 1.35,
                      textDecoration: dia.discomfort_hecho ? 'line-through' : 'none',
                      opacity: dia.discomfort_hecho ? 0.6 : 1,
                    }}
                  >
                    {dia.discomfort_titulo}
                  </p>
                  <button
                    onClick={() => { setFormDiscomfort(dia.discomfort_titulo ?? ''); setEditDiscomfort(true); }}
                    style={{ background: 'transparent', border: 'none', color: 'var(--os-muted)', fontSize: 11, cursor: 'pointer', padding: '4px 0 0' }}
                  >
                    Editar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Principios: sin endpoint todavia, se mantiene el estatico de data/daily.ts */}
          {/* TODO: crear /api/os/principios cuando exista tabla os_principios; hasta entonces esto queda fijo */}
          <div className="os-card">
            <p className="os-section-title">Principios</p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
              {datosDaily.principios.map((p, i) => (
                <li key={i} style={{ display: 'flex', gap: 8 }}>
                  <span className="os-mono" style={{ fontSize: 11, fontWeight: 700, color: 'var(--os-accent)', minWidth: 16, paddingTop: 2 }}>{i + 1}</span>
                  <span style={{ fontSize: 12, color: 'var(--os-muted)', lineHeight: 1.35 }}>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Semana + Norte 90 dias */}
      <div className="os-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div className="os-card">
          <p className="os-section-title">Semana Maker / Manager</p>
          {semana.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--os-muted)', margin: 0 }}>Sin diseno de semana todavia.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 5 }}>
              {semana.map((d) => (
                <div
                  key={d.dia}
                  style={{
                    background: MODO_BG[d.modo], border: `1px solid ${d.modo === 'maker' ? 'var(--os-line-accent)' : 'var(--os-line-soft)'}`,
                    borderRadius: 6, padding: '0.5rem 0.25rem', textAlign: 'center',
                  }}
                >
                  <p style={{ fontFamily: 'var(--os-font-display)', fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--os-muted)', margin: '0 0 3px' }}>
                    {DIA_LABEL[d.dia - 1]?.slice(0, 3) ?? '?'}
                  </p>
                  <p style={{ fontFamily: 'var(--os-font-display)', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: MODO_COLOR[d.modo], margin: 0 }}>
                    {MODO_LABEL[d.modo]}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="os-card os-card-accent">
          <p className="os-eyebrow" style={{ marginBottom: '0.75rem' }}>Norte · 90 dias</p>
          {objetivos.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--os-muted)', margin: 0 }}>Sin objetivos activos.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {objetivos.map((o, i) => (
                <div key={o.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span className="os-num" style={{ fontSize: 11, minWidth: 18, paddingTop: 1 }}>{i + 1}</span>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--os-text)' }}>{o.titulo}.</span>
                    {o.descripcion && <span style={{ fontSize: 12, color: 'var(--os-muted)', marginLeft: 5 }}>{o.descripcion}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
