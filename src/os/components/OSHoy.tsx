import { useEffect, useState } from 'react';
import { datosDaily } from '../data/daily';
import OSChecklistHoy from './OSChecklistHoy';
import OSChecklist from './OSChecklist';
import { Celebracion, Spinner } from './ui';

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
// punto_partida es el numero honesto de donde arranca el objetivo. Lo escribe el
// onboarding (aplicarOs en onboarding.handlers.ts) y hasta ahora no se pintaba en
// ningun lado, asi que llenar el onboarding parecia no cambiar nada.
interface Objetivo { id: string; orden: number; titulo: string; descripcion: string | null; punto_partida: string | null; }
interface KPIHoy { id: string; label: string; unidad: string | null; meta: number | null; valor_actual: number | null; objetivo_id: string | null; }
interface DiaSemana { dia: number; modo: 'maker' | 'manager' | 'off'; sale: string | null; etiqueta: string | null; }
interface Linea { id: string; nombre: string; estado: string; }
interface SugerenciaDomino { texto: string; slug: string; }
interface Principio { id: string; texto: string; orden: number; }

const DIA_LABEL = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];
const MODO_COLOR: Record<string, string> = { maker: 'var(--os-accent-light)', manager: 'var(--os-muted)', off: 'var(--os-muted)' };
const MODO_BG: Record<string, string> = { maker: 'rgba(59,78,217,0.15)', manager: 'var(--os-fill-subtle)', off: 'var(--os-fill-subtle)' };
const MODO_LABEL: Record<string, string> = { maker: 'Maker', manager: 'Manager', off: 'Off' };

// Se rota el titulo del festejo para que no canse viendo siempre el mismo.
const FESTEJOS = ['Eso suma', 'Win anotado', 'Otro mas', 'Asi se hace'];

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
  const [kpis, setKpis] = useState<KPIHoy[]>([]);
  const [semana, setSemana] = useState<DiaSemana[]>([]);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [sugerencias, setSugerencias] = useState<SugerenciaDomino[]>([]);
  const [principios, setPrincipios] = useState<Principio[]>([]);
  const [loading, setLoading] = useState(true);

  const [editDomino, setEditDomino] = useState(false);
  const [editDiscomfort, setEditDiscomfort] = useState(false);
  const [formDomino, setFormDomino] = useState({ titulo: '', linea: '', razon: '' });
  const [formDiscomfort, setFormDiscomfort] = useState('');
  const [nuevoWin, setNuevoWin] = useState('');
  const [guardando, setGuardando] = useState(false);
  // El titulo se sortea al disparar, no al renderizar: si no, cada re-render
  // durante los 2.4s del festejo cambiaria el mensaje en pantalla.
  const [festejo, setFestejo] = useState<{ titulo: string; texto: string } | null>(null);

  async function cargar() {
    // Sin ?maker=1: el domino del dia puede caer en cualquier linea viva, no solo
    // en las de foco maker de esta semana.
    const [diaRes, stackRes, objRes, semRes, lineasRes, kpisRes, prinRes] = await Promise.all([
      safeJson('/api/dia'),
      safeJson('/api/priority-stack'),
      safeJson('/api/objetivos'),
      safeJson('/api/semana'),
      safeJson('/api/lineas'),
      safeJson('/api/kpis'),
      safeJson('/api/principios'),
    ]);
    if (diaRes) {
      setDia(diaRes.dia ?? null);
      setWins(diaRes.wins ?? []);
    }
    if (stackRes) setPrioridades((stackRes.prioridades ?? []).sort((a: Prioridad, b: Prioridad) => a.orden - b.orden));
    if (objRes) setObjetivos((objRes.objetivos ?? []).sort((a: Objetivo, b: Objetivo) => a.orden - b.orden));
    if (kpisRes) setKpis(kpisRes.kpis ?? []);
    if (semRes) setSemana(semRes.dias ?? []);
    if (lineasRes) setLineas((lineasRes.lineas ?? []).filter((l: Linea) => l.estado !== 'pausado'));
    if (prinRes) setPrincipios(prinRes.principios ?? []);
    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  // La sugerencia va aparte del resto de la carga: es una llamada al brain (red
  // externa y lenta) y no tiene por que retrasar el dia. Solo se pide si todavia
  // no hay domino, que es cuando sirve de algo.
  useEffect(() => {
    if (loading || dia?.domino_titulo) return;
    let cancelado = false;
    safeJson('/api/dia/sugerencia').then((res) => {
      if (!cancelado && res) setSugerencias(res.sugerencias ?? []);
    });
    return () => { cancelado = true; };
  }, [loading, dia?.domino_titulo]);

  async function guardarDia(patch: Record<string, unknown>) {
    setGuardando(true);
    try {
      const res = await fetch('/api/dia', {
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
      const res = await fetch(`/api/priority-stack?id=${p.id}`, {
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
      const res = await fetch('/api/dia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ win: { texto } }),
      });
      const data = await res.json();
      if (data.win) {
        setWins((cur) => [...cur, data.win]);
        // Solo se festeja lo que de verdad quedo guardado en os_wins.
        setFestejo({
          titulo: FESTEJOS[Math.floor(Math.random() * FESTEJOS.length)] ?? 'Win anotado',
          texto: data.win.texto ?? texto,
        });
      }
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
      {festejo && (
        <Celebracion
          mensaje={festejo.titulo}
          detalle={festejo.texto}
          onCerrar={() => setFestejo(null)}
        />
      )}

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
            {/* Temas recientes del brain. Son señales de sobre que se viene
                hablando, no dominos ya redactados: al tocarlos se prellena el
                campo y queda editable, sin guardar nada todavia. */}
            {!dia?.domino_titulo && sugerencias.length > 0 && (
              <div>
                <p style={{ fontSize: 11, color: 'var(--os-muted)', margin: '0 0 6px' }}>
                  Del brain, lo mas reciente:
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {sugerencias.map((s) => (
                    <button
                      key={s.slug}
                      type="button"
                      onClick={() => setFormDomino((f) => ({ ...f, titulo: s.texto }))}
                      style={{
                        background: 'var(--os-fill-subtle)', border: '1px solid var(--os-line-accent)',
                        borderRadius: 999, padding: '4px 10px', cursor: 'pointer',
                        fontSize: 12, color: 'var(--os-accent-light)', textAlign: 'left',
                      }}
                    >
                      {s.texto}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <input
              className="os-input"
              placeholder="Cual es tu domino de hoy"
              value={formDomino.titulo}
              onChange={(e) => setFormDomino((f) => ({ ...f, titulo: e.target.value }))}
              style={{ width: '100%' }}
            />
            {/* Antes era texto libre y nada garantizaba que lo escrito coincidiera
                con una linea real de os_lineas. */}
            <select
              className="os-input"
              value={formDomino.linea}
              onChange={(e) => setFormDomino((f) => ({ ...f, linea: e.target.value }))}
              style={{ width: '100%' }}
            >
              <option value="">Sin proyecto o linea</option>
              {/* Un domino viejo pudo guardar texto que ya no existe en os_lineas.
                  Se ofrece igual para no borrarlo sin querer al editar. */}
              {formDomino.linea && !lineas.some((l) => l.nombre === formDomino.linea) && (
                <option value={formDomino.linea}>{formDomino.linea}</option>
              )}
              {lineas.map((l) => (
                <option key={l.id} value={l.nombre}>{l.nombre}</option>
              ))}
            </select>
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
                  className="os-section-heading"
                  style={{
                    fontSize: 'var(--os-text-2xl)', margin: '0 0 0.375rem', lineHeight: 1.25,
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
          {/* Los wins van arriba del Priority Stack: lo que ya se logro pesa mas
              que la lista de pendientes al abrir el dia. */}
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

          <div className="os-card">
            <p className="os-section-title">Principios</p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
              {principios.length > 0 ? principios.map((p, i) => (
                <li key={p.id} style={{ display: 'flex', gap: 8 }}>
                  <span className="os-mono" style={{ fontSize: 11, fontWeight: 700, color: 'var(--os-accent)', minWidth: 16, paddingTop: 2 }}>{i + 1}</span>
                  <span style={{ fontSize: 12, color: 'var(--os-muted)', lineHeight: 1.35 }}>{p.texto}</span>
                </li>
              )) : (
                <li style={{ display: 'flex', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--os-muted)', lineHeight: 1.35 }}>No hay principios configurados.</span>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* Rutinas del dia, antes en /daily.
          OJO: OSChecklist guarda el marcado solo en estado local de React, asi que
          Ancla AM y Cierre PM se reinician al recargar. Persisten cuando exista una
          tabla propia (no hay os_rutina en las migraciones todavia). El checklist
          que si persiste es OSChecklistHoy, arriba, contra /api/habitos. */}
      <div className="os-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="os-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.875rem' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--os-champagne)' }}>wb_sunny</span>
              <p className="os-section-title" style={{ margin: 0 }}>Ancla AM</p>
            </div>
            <OSChecklist items={datosDaily.rutina_am} />
          </div>

          <div className="os-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.75rem' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--os-accent-light)' }}>timer</span>
              <p className="os-section-title" style={{ margin: 0 }}>Check de 10 min</p>
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
              {datosDaily.check_10min.map((q) => (
                <li key={q} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--os-accent-light)', flexShrink: 0, marginTop: 1 }}>help</span>
                  <span style={{ fontSize: 13, color: 'var(--os-text)', lineHeight: 1.4 }}>{q}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="os-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.875rem' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--os-accent-light)' }}>bedtime</span>
              <p className="os-section-title" style={{ margin: 0 }}>Cierre PM</p>
            </div>
            <OSChecklist items={datosDaily.pm_close} />
          </div>

          <div className="os-card os-card-accent">
            <p className="os-eyebrow" style={{ margin: '0 0 0.625rem' }}>Reglas</p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {datosDaily.reglas.map((r) => (
                <li key={r} style={{ fontSize: 13, color: 'var(--os-text)', lineHeight: 1.4, paddingLeft: 14, position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 0, top: 7, width: 5, height: 1, background: 'var(--os-accent)', display: 'block' }} />
                  {r}
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
                    {o.punto_partida && (
                      <p style={{ fontSize: 11, color: 'var(--os-text-2)', margin: '3px 0 0', lineHeight: 1.4 }}>
                        <span style={{ color: 'var(--os-muted)' }}>Punto de partida: </span>
                        {o.punto_partida}
                      </p>
                    )}
                    {kpis.filter((k) => k.objetivo_id === o.id).map((k) => (
                      <p key={k.id} style={{ fontSize: 11, color: 'var(--os-accent-light)', margin: '4px 0 0' }}>
                        {k.label}: {k.valor_actual === null ? '—' : `${k.valor_actual}${k.unidad ? ` ${k.unidad}` : ''}`}{k.meta === null ? '' : ` / meta ${k.meta}${k.unidad ? ` ${k.unidad}` : ''}`}
                      </p>
                    ))}
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
