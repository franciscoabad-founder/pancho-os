// Pagina /hermes/sesiones: todas las conversaciones de Hermes, separadas por
// canal (Telegram, Pancho OS, Desktop, tareas programadas, puente de Ara...) y
// por perfil (Alfred, Arazza, Nerio, Rafik, Taskr). Fase 2 del plan
// docs/plan-hermes-en-os.md. Datos: /api/hermes/sesiones (solo lectura).
// Abrir una sesion lleva a Hermes completo (hermes-ui), solo con Tailscale.

import { useEffect, useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import OSLayout, { tituloOs } from '../../os/components/OSLayout.tsx';
import PageHeader from '../../os/components/ui/PageHeader.tsx';
import {
  agruparSesiones,
  catalogoCanal,
  contarPorCanal,
  filtrarSesiones,
  type CanalHermesId,
  type SesionHermes,
} from '../../os/lib/canalesHermes.ts';
import { PERFILES_HERMES } from '../../os/lib/perfilesHermes.ts';

const HERMES_UI_URL: string = import.meta.env.VITE_HERMES_UI_URL ?? 'http://100.127.42.51:9120';
/** Sesiones que se cargan de una vez: el tope de Hermes por pagina. */
const CARGA = 500;

export const Route = createFileRoute('/hermes_/sesiones')({
  head: () => ({ meta: [{ title: tituloOs('Sesiones de Hermes') }] }),
  component: SesionesPage,
});

interface Respuesta {
  sesiones: SesionHermes[];
  total: number;
  totalPorPerfil: Record<string, number>;
  errores: { profile: string; error: string }[];
}

function hace(segundos: number | null): string {
  if (!segundos) return 'sin fecha';
  const d = Math.max(0, Date.now() / 1000 - segundos);
  if (d < 90) return 'ahora';
  if (d < 3600) return `hace ${Math.round(d / 60)} min`;
  if (d < 86_400) return `hace ${Math.round(d / 3600)} h`;
  if (d < 86_400 * 60) return `hace ${Math.round(d / 86_400)} d`;
  return new Date(segundos * 1000).toLocaleDateString('es-EC');
}

const chip = (activo: boolean, color?: string): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999,
  fontSize: 'var(--os-text-sm)', cursor: 'pointer', whiteSpace: 'nowrap',
  border: `1px solid ${activo ? (color ?? 'var(--os-accent-light)') : 'var(--os-border)'}`,
  background: activo ? `${color ?? '#3B4ED9'}26` : 'transparent', color: 'inherit',
});

function SesionesPage() {
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canal, setCanal] = useState<CanalHermesId | null>(null);
  const [perfil, setPerfil] = useState<string | null>(null);
  const [texto, setTexto] = useState('');

  useEffect(() => {
    let vivo = true;
    fetch(`/api/hermes/sesiones?limite=${CARGA}`)
      .then(async (res) => {
        const cuerpo = await res.json();
        if (!res.ok) throw new Error(cuerpo?.error ?? `HTTP ${res.status}`);
        if (vivo) setDatos(cuerpo as Respuesta);
      })
      .catch((e) => vivo && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      vivo = false;
    };
  }, []);

  const todas = datos?.sesiones ?? [];
  // Los conteos de canal respetan el perfil y el texto, y los de perfil respetan el canal.
  const conteoCanales = useMemo(() => contarPorCanal(filtrarSesiones(todas, { perfil, texto })), [todas, perfil, texto]);
  const visibles = useMemo(() => filtrarSesiones(todas, { canal, perfil, texto }), [todas, canal, perfil, texto]);
  const grupos = useMemo(() => agruparSesiones(visibles), [visibles]);
  const cortado = datos ? datos.total > todas.length : false;

  return (
    <OSLayout title="Sesiones de Hermes">
      <div className="os-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <PageHeader
          eyebrow="Operacion Agente"
          title="Sesiones de Hermes"
          subtitle="Cada conversacion, separada por canal y por perfil. Abrir una sesion la lleva a Hermes completo (solo con Tailscale)."
        />

        <input
          aria-label="Buscar sesiones"
          className="os-input"
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar por titulo, mensaje, grupo o perfil"
          value={texto}
        />

        <div aria-label="Filtrar por canal" role="group" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setCanal(null)} style={chip(canal === null)} type="button">
            Todos los canales
          </button>
          {conteoCanales.map(({ canal: id, total }) => {
            const c = catalogoCanal(id);
            return (
              <button key={id} onClick={() => setCanal(canal === id ? null : id)} style={chip(canal === id, c.color)} type="button">
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: c.color }}>{c.icono}</span>
                {c.etiqueta} <strong>{total}</strong>
              </button>
            );
          })}
        </div>

        <div aria-label="Filtrar por perfil" role="group" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setPerfil(null)} style={chip(perfil === null)} type="button">
            Todos los perfiles
          </button>
          {PERFILES_HERMES.map((p) => (
            <button key={p.id} onClick={() => setPerfil(perfil === p.id ? null : p.id)} style={chip(perfil === p.id)} type="button">
              {p.etiqueta} <strong>{datos?.totalPorPerfil[p.id] ?? 0}</strong>
            </button>
          ))}
        </div>

        {error && (
          <div className="os-card" role="alert" style={{ padding: 16 }}>
            No pude leer las sesiones de Hermes: {error}
          </div>
        )}
        {!datos && !error && <div className="os-card" style={{ padding: 16 }}>Cargando sesiones…</div>}
        {datos && datos.errores.length > 0 && (
          <div className="os-card" style={{ padding: 12, fontSize: 'var(--os-text-sm)' }}>
            Perfiles que no se pudieron leer: {datos.errores.map((e) => e.profile).join(', ')}
          </div>
        )}
        {datos && (
          <p style={{ margin: 0, fontSize: 'var(--os-text-sm)', color: 'var(--os-muted)' }}>
            {visibles.length} de {todas.length} sesiones
            {cortado ? ` (las ${todas.length} mas recientes de ${datos.total})` : ''}
          </p>
        )}
        {datos && visibles.length === 0 && <div className="os-card" style={{ padding: 16 }}>Ninguna sesion coincide con el filtro.</div>}

        {grupos.map((g) => (
          <section className="os-card" key={g.clave} style={{ padding: 0, overflow: 'hidden' }}>
            <h2 style={{ margin: 0, padding: '12px 16px', fontSize: 'var(--os-text-base)', borderBottom: '1px solid var(--os-border)' }}>
              {g.titulo} <span style={{ color: 'var(--os-muted)', fontWeight: 400 }}>· {g.sesiones.length}</span>
            </h2>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {g.sesiones.map((s) => {
                const c = catalogoCanal(s.canal);
                return (
                  <li key={`${s.perfil}:${s.id}`} style={{ borderBottom: '1px solid var(--os-border)' }}>
                    <a
                      href={`${HERMES_UI_URL}/#/${encodeURIComponent(s.id)}`}
                      rel="noreferrer"
                      style={{ display: 'flex', gap: 12, padding: '10px 16px', color: 'inherit', textDecoration: 'none', alignItems: 'flex-start' }}
                      target="_blank"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 20, color: c.color, marginTop: 2 }}>{c.icono}</span>
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                          <strong style={{ overflowWrap: 'anywhere' }}>{s.titulo}</strong>
                          {s.telegram?.topic && <span className="os-tag">topic {s.telegram.topic}</span>}
                          {s.sinLeer && <span className="os-pill os-pill-accent">sin leer</span>}
                          {s.fijada && <span className="os-pill os-pill-gold">fijada</span>}
                        </span>
                        {s.vistaPrevia && s.vistaPrevia !== s.titulo && (
                          <span style={{ display: 'block', fontSize: 'var(--os-text-sm)', color: 'var(--os-muted)', overflowWrap: 'anywhere' }}>
                            {s.vistaPrevia}
                          </span>
                        )}
                      </span>
                      <span style={{ textAlign: 'right', fontSize: 'var(--os-text-sm)', color: 'var(--os-muted)', whiteSpace: 'nowrap' }}>
                        <span className="os-pill">{s.perfilEtiqueta}</span>
                        <span style={{ display: 'block', marginTop: 4 }}>{s.mensajes} msj · {hace(s.ultimaActividad)}</span>
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </OSLayout>
  );
}
