// Agenda editable con dias visibles aunque no haya eventos.
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import OSLayout, { tituloOs } from '../os/components/OSLayout.tsx';
import PageHeader from '../os/components/ui/PageHeader.tsx';
import { getEventos } from '../utils/agenda.functions.ts';

const TZ = 'America/Guayaquil';
type Evento = { id: string; titulo: string; inicio: string | null; fin: string | null; ubicacion?: string; descripcion?: string; etiquetas?: string[] };
type Formulario = { titulo: string; inicio: string; fin: string; ubicacion: string; descripcion: string; etiquetas: string };
const VACIO: Formulario = { titulo: '', inicio: '', fin: '', ubicacion: '', descripcion: '', etiquetas: '' };

export const Route = createFileRoute('/agenda')({ head: () => ({ meta: [{ title: tituloOs('Agenda') }] }), loader: () => getEventos(), component: AgendaPage });

function parts(value: Date) {
  const entries = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(value);
  return Object.fromEntries(entries.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
}
function civil(value = new Date()) { const p = parts(value); return `${p.year}-${p.month}-${p.day}`; }
function addDays(fecha: string, days: number) { const d = new Date(`${fecha}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
function isoInput(value: string | null | undefined) { if (!value) return ''; const d = new Date(value); if (Number.isNaN(d.getTime())) return value.slice(0, 16); const p = parts(d); return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`; }
function eventDay(value: string | null) { if (!value) return 'Sin fecha'; const d = new Date(value); return Number.isNaN(d.getTime()) ? value.slice(0, 10) : civil(d); }
function timeLabel(value: string | null) { if (!value) return ''; const d = new Date(value); return Number.isNaN(d.getTime()) ? value.slice(11, 16) : d.toLocaleTimeString('es-EC', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }); }
function dateLabel(fecha: string) { const today = civil(); const label = new Date(`${fecha}T12:00:00Z`).toLocaleDateString('es-EC', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'short' }); return fecha === today ? `Hoy, ${label}` : fecha === addDays(today, 1) ? `Mañana, ${label}` : label; }
function duration(start: string | null, end: string | null) { if (!start || !end) return ''; const minutes = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000)); return minutes ? (minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ''}`) : ''; }

function AgendaPage() {
  const { eventos: initial, serverMs } = Route.useLoaderData();
  const [eventos, setEventos] = useState<Evento[]>(initial);
  const [desde, setDesde] = useState(() => civil());
  const [form, setForm] = useState<Formulario>(VACIO);
  const [editando, setEditando] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const hasta = addDays(desde, 13);
  const exito = /actualizado|creado|sincronizado|eliminado/.test(mensaje);

  async function recargar(nuevoDesde = desde) {
    const res = await fetch(`/api/agenda?desde=${encodeURIComponent(nuevoDesde)}&hasta=${encodeURIComponent(addDays(nuevoDesde, 13))}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || String(res.status));
    setEventos(data.eventos ?? []);
  }
  function cancelar() { setEditando(null); setForm(VACIO); }
  async function guardar(e: React.FormEvent) {
    e.preventDefault(); setMensaje(''); setCargando(true);
    try {
      const res = await fetch(editando ? `/api/agenda?id=${encodeURIComponent(editando)}` : '/api/agenda', { method: editando ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ titulo: form.titulo, inicio: form.inicio, fin: form.fin || null, ubicacion: form.ubicacion || null, descripcion: form.descripcion || null, etiquetas: form.etiquetas }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error || String(res.status));
      const eraEdicion = Boolean(editando); cancelar(); await recargar(); setMensaje(eraEdicion ? 'Evento actualizado.' : 'Evento creado.');
    } catch (err) { setMensaje(err instanceof Error ? err.message : 'No se pudo guardar el evento.'); } finally { setCargando(false); }
  }
  function editar(e: Evento) { setEditando(e.id); setForm({ titulo: e.titulo, inicio: isoInput(e.inicio), fin: isoInput(e.fin), ubicacion: e.ubicacion || '', descripcion: e.descripcion || '', etiquetas: (e.etiquetas || []).join(', ') }); setMensaje(''); }
  async function eliminar(e: Evento) {
    if (!window.confirm(`¿Eliminar "${e.titulo}"? Si está vinculado a Google, se cancelará en la próxima sincronización.`)) return;
    setCargando(true); setMensaje('');
    try { const res = await fetch(`/api/agenda?id=${encodeURIComponent(e.id)}`, { method: 'DELETE' }); const data = await res.json(); if (!res.ok) throw new Error(data.error || String(res.status)); if (editando === e.id) cancelar(); await recargar(); setMensaje('Evento eliminado.'); } catch (err) { setMensaje(err instanceof Error ? err.message : 'No se pudo eliminar el evento.'); } finally { setCargando(false); }
  }
  async function sync() {
    setSincronizando(true); setMensaje('');
    try { const res = await fetch(`/api/agenda/sync?desde=${desde}&hasta=${hasta}`, { method: 'POST' }); const data = await res.json(); if (!res.ok) throw new Error(data.error || String(res.status)); await recargar(); setMensaje(`Google sincronizado: ${data.importados ?? 0} importados, ${data.exportados ?? 0} exportados.`); } catch (err) { setMensaje(err instanceof Error ? err.message : 'No se pudo sincronizar Google.'); } finally { setSincronizando(false); }
  }
  const porDia = new Map<string, Evento[]>(); for (const e of eventos) { const dia = eventDay(e.inicio); porDia.set(dia, [...(porDia.get(dia) || []), e]); }
  const dias = Array.from({ length: 14 }, (_, index) => addDays(desde, index));

  return <OSLayout title="Agenda"><div className="os-fade-up">
    <PageHeader eyebrow="Calendario" title="Agenda" subtitle="Eventos, bloques y etiquetas en hora de Ecuador." actions={<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><button type="button" className="os-btn os-btn-secondary" onClick={() => void sync()} disabled={sincronizando} style={{ padding: '5px 10px', fontSize: 11 }}><span className="material-symbols-outlined" style={{ fontSize: 15 }}>sync</span>{sincronizando ? 'Sincronizando…' : 'Google Calendar'}</button><span className="os-mono" style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)' }}>{eventos.length} eventos · {serverMs} ms</span></div>} />
    <form onSubmit={guardar} className="os-card-2" style={{ marginBottom: '1.25rem', padding: '0.875rem 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}><p className="os-section-title" style={{ margin: 0 }}>{editando ? 'Editar evento' : 'Nuevo evento'}</p>{editando && <button type="button" className="os-btn os-btn-secondary" onClick={cancelar} style={{ padding: '4px 9px', fontSize: 11 }}>Cancelar</button>}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, alignItems: 'end' }}>
        <input required className="os-input" placeholder="Título del evento *" value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} /><input required type="datetime-local" className="os-input" style={{ colorScheme: 'light dark' }} value={form.inicio} onChange={(e) => setForm((f) => ({ ...f, inicio: e.target.value }))} /><input type="datetime-local" className="os-input" style={{ colorScheme: 'light dark' }} value={form.fin} onChange={(e) => setForm((f) => ({ ...f, fin: e.target.value }))} /><input className="os-input" placeholder="Ubicación" value={form.ubicacion} onChange={(e) => setForm((f) => ({ ...f, ubicacion: e.target.value }))} /><input className="os-input" placeholder="Descripción" value={form.descripcion} onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))} /><input className="os-input" placeholder="Etiquetas: ventas, foco" value={form.etiquetas} onChange={(e) => setForm((f) => ({ ...f, etiquetas: e.target.value }))} /><button type="submit" className="os-btn" disabled={cargando} style={{ justifyContent: 'center' }}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>{editando ? 'save' : 'add'}</span>{editando ? 'Guardar' : 'Crear evento'}</button>
      </div>{mensaje && <p style={{ fontSize: 'var(--os-text-xs)', color: exito ? 'var(--os-success)' : 'var(--os-error)', margin: '8px 0 0' }}>{mensaje}</p>}
    </form>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: '1rem' }}><button className="os-btn os-btn-secondary" type="button" onClick={() => { const next = addDays(desde, -14); setDesde(next); void recargar(next); }}>← 14 días</button><p className="os-mono" style={{ margin: 'auto 0', fontSize: 11, color: 'var(--os-muted)' }}>{desde} a {hasta}</p><button className="os-btn os-btn-secondary" type="button" onClick={() => { const next = addDays(desde, 14); setDesde(next); void recargar(next); }}>14 días →</button></div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>{dias.map((fecha) => { const items = (porDia.get(fecha) || []).sort((a, b) => String(a.inicio).localeCompare(String(b.inicio))); return <section key={fecha}><p className="os-section-title" style={{ margin: '0 0 0.625rem', textTransform: 'capitalize' }}>{dateLabel(fecha)}</p>{items.length === 0 ? <div className="os-card-2" style={{ padding: '0.65rem 1rem', color: 'var(--os-muted)', fontSize: 12 }}>Sin eventos.</div> : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{items.map((e) => <div key={e.id} className="os-card-2" style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '0.75rem 1rem' }}><div style={{ minWidth: 48, textAlign: 'right', flexShrink: 0 }}><p className="os-mono" style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>{timeLabel(e.inicio)}</p><p style={{ fontSize: 11, color: 'var(--os-muted)', margin: '1px 0 0' }}>{duration(e.inicio, e.fin)}</p></div><div style={{ width: 2, minWidth: 2, borderRadius: 2, background: 'var(--os-accent)', alignSelf: 'stretch' }} /><div style={{ flex: 1, minWidth: 0 }}><p style={{ fontSize: 14, fontWeight: 500, margin: '0 0 2px', lineHeight: 1.3 }}>{e.titulo}</p>{[e.ubicacion, e.descripcion].filter(Boolean).join(' · ') && <p style={{ fontSize: 12, color: 'var(--os-muted)', margin: 0 }}>{[e.ubicacion, e.descripcion].filter(Boolean).join(' · ')}</p>}{(e.etiquetas || []).length > 0 && <p style={{ display: 'flex', flexWrap: 'wrap', gap: 4, margin: '6px 0 0' }}>{e.etiquetas!.map((tag) => <span key={tag} className="os-mono" style={{ fontSize: 10, color: 'var(--os-accent)' }}>#{tag}</span>)}</p>}</div><div style={{ display: 'flex', gap: 5 }}><button className="os-btn os-btn-secondary" type="button" onClick={() => editar(e)} style={{ padding: '4px 7px', fontSize: 11 }}>Editar</button><button className="os-btn os-btn-secondary" type="button" onClick={() => void eliminar(e)} disabled={cargando} style={{ padding: '4px 7px', fontSize: 11 }}>Eliminar</button></div></div>)}</div>}</section>; })}</div>
  </div></OSLayout>;
}
