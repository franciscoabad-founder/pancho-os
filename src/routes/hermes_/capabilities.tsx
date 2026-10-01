// Pagina /hermes/capabilities: skills de Hermes para ver y activar o desactivar
// desde el celular (Fase 4 de docs/plan-hermes-en-os.md). La app completa de
// Hermes tiene Capabilities, pero no esta pensada para pantallas chicas.
// Datos: /api/hermes/skills. OJO: el interruptor cambia la configuracion REAL
// de Hermes en el VPS (PUT /api/skills/toggle), por perfil.

import { useEffect, useMemo, useRef, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import OSLayout, { tituloOs } from '../../os/components/OSLayout.tsx';
import PageHeader from '../../os/components/ui/PageHeader.tsx';
import { PERFILES_HERMES } from '../../os/lib/perfilesHermes.ts';
import { filtrarSkills, resumirSkills, type SkillHermes } from '../../os/lib/skillsHermes.ts';

export const Route = createFileRoute('/hermes_/capabilities')({
  head: () => ({ meta: [{ title: tituloOs('Capabilities de Hermes') }] }),
  component: CapabilitiesPage,
});

const chip = (activo: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999,
  fontSize: 'var(--os-text-sm)', cursor: 'pointer', whiteSpace: 'nowrap', color: 'inherit',
  border: `1px solid ${activo ? 'var(--os-accent-light)' : 'var(--os-border)'}`,
  background: activo ? 'rgba(59,78,217,0.16)' : 'transparent',
});

function CapabilitiesPage() {
  const [perfil, setPerfil] = useState('default');
  // Perfil vigente, para descartar respuestas de un toggle hecho en otro perfil.
  const perfilActual = useRef(perfil);
  perfilActual.current = perfil;
  const [skills, setSkills] = useState<SkillHermes[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enCurso, setEnCurso] = useState<Set<string>>(new Set());
  const [texto, setTexto] = useState('');
  const [categoria, setCategoria] = useState('');
  const [estado, setEstado] = useState<'todas' | 'activas' | 'inactivas'>('todas');

  useEffect(() => {
    let vivo = true;
    setSkills(null);
    setError(null);
    fetch(`/api/hermes/skills?perfil=${encodeURIComponent(perfil)}`)
      .then(async (res) => {
        const c = await res.json();
        if (!res.ok) throw new Error(c?.error ?? `HTTP ${res.status}`);
        if (vivo) setSkills(c.skills as SkillHermes[]);
      })
      .catch((e) => vivo && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      vivo = false;
    };
  }, [perfil]);

  const resumen = useMemo(() => resumirSkills(skills ?? []), [skills]);
  const visibles = useMemo(
    () => filtrarSkills(skills ?? [], { texto, categoria: categoria || null, estado }),
    [skills, texto, categoria, estado],
  );

  async function alternar(s: SkillHermes) {
    const nueva = !s.activa;
    const pedido = perfil;
    const sigue = () => perfilActual.current === pedido;
    setAviso(null);
    setEnCurso((p) => new Set(p).add(s.nombre));
    // Se muestra el cambio de inmediato y se revierte si Hermes no lo confirma.
    setSkills((prev) => prev?.map((x) => (x.nombre === s.nombre ? { ...x, activa: nueva } : x)) ?? prev);
    try {
      const res = await fetch('/api/hermes/skills', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nombre: s.nombre, activa: nueva, perfil: pedido }),
      });
      const c = await res.json();
      if (!res.ok) throw new Error(c?.error ?? `HTTP ${res.status}`);
      if (!sigue()) return;
      setSkills((prev) => prev?.map((x) => (x.nombre === s.nombre ? { ...x, activa: c.activa === true } : x)) ?? prev);
      setAviso(`${s.nombre}: ${c.activa ? 'activada' : 'desactivada'} en ${PERFILES_HERMES.find((p) => p.id === pedido)?.etiqueta ?? pedido}.`);
    } catch (e) {
      if (!sigue()) return;
      setSkills((prev) => prev?.map((x) => (x.nombre === s.nombre ? { ...x, activa: s.activa } : x)) ?? prev);
      setAviso(`No pude cambiar ${s.nombre}: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setEnCurso((p) => {
        const n = new Set(p);
        n.delete(s.nombre);
        return n;
      });
    }
  }

  return (
    <OSLayout title="Capabilities de Hermes">
      <div className="os-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <PageHeader
          eyebrow="Operacion Agente"
          title="Capabilities de Hermes"
          subtitle="Skills de cada perfil. El interruptor cambia la configuracion real de Hermes en el VPS."
        />

        <div aria-label="Perfil" role="group" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {PERFILES_HERMES.map((p) => (
            <button key={p.id} onClick={() => setPerfil(p.id)} style={chip(perfil === p.id)} type="button">{p.etiqueta}</button>
          ))}
        </div>

        <input aria-label="Buscar skills" className="os-input" onChange={(e) => setTexto(e.target.value)} placeholder="Buscar skill" value={texto} />

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {(['todas', 'activas', 'inactivas'] as const).map((e) => (
            <button key={e} onClick={() => setEstado(e)} style={chip(estado === e)} type="button">
              {e === 'todas' ? 'Todas' : e === 'activas' ? 'Activas' : 'Inactivas'}
            </button>
          ))}
          <select aria-label="Categoria" onChange={(e) => setCategoria(e.target.value)} style={{ minWidth: 0, maxWidth: '100%' }} value={categoria}>
            <option value="">Todas las categorías</option>
            {resumen.categorias.map((c) => (
              <option key={c.categoria} value={c.categoria}>{c.categoria} ({c.total})</option>
            ))}
          </select>
        </div>

        {error && <div className="os-card" role="alert" style={{ padding: 14 }}>No pude leer las skills: {error}</div>}
        {!skills && !error && <div className="os-card" style={{ padding: 14 }}>Cargando skills…</div>}
        {aviso && <div className="os-card" role="status" style={{ padding: 12, fontSize: 'var(--os-text-sm)' }}>{aviso}</div>}
        {skills && (
          <p style={{ margin: 0, fontSize: 'var(--os-text-sm)', color: 'var(--os-muted)' }}>
            {visibles.length} de {resumen.total} skills · {resumen.activas} activas
          </p>
        )}

        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))' }}>
          {visibles.map((s) => (
            <li className="os-card" key={s.nombre} style={{ padding: 12, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ minWidth: 0, flex: 1 }}>
                <strong style={{ overflowWrap: 'anywhere' }}>{s.nombre}</strong>
                <span className="os-tag" style={{ marginLeft: 8 }}>{s.categoria}</span>
                {s.descripcion && (
                  <span style={{ display: 'block', fontSize: 'var(--os-text-sm)', color: 'var(--os-muted)', overflowWrap: 'anywhere' }}>
                    {s.descripcion.length > 160 ? `${s.descripcion.slice(0, 160)}…` : s.descripcion}
                  </span>
                )}
              </span>
              <button
                aria-checked={s.activa}
                aria-label={`${s.activa ? 'Desactivar' : 'Activar'} ${s.nombre}`}
                disabled={enCurso.has(s.nombre)}
                onClick={() => void alternar(s)}
                role="switch"
                style={{
                  flex: 'none', width: 48, height: 28, borderRadius: 999, border: 0, padding: 3, cursor: 'pointer',
                  background: s.activa ? '#16A34A' : 'rgba(148,163,184,0.5)', opacity: enCurso.has(s.nombre) ? 0.5 : 1,
                  display: 'flex', justifyContent: s.activa ? 'flex-end' : 'flex-start', alignItems: 'center',
                }}
                type="button"
              >
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#fff' }} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </OSLayout>
  );
}
