// Pagina /agenda portada de src/pages/agenda.astro a TanStack Start.
// Mantiene el contrato con /api/agenda para crear eventos; el listado inicial
// viene del loader (SSR) y se refresca tras cada alta.

import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import OSLayout, { tituloOs } from '../os/components/OSLayout.tsx';
import PageHeader from '../os/components/ui/PageHeader.tsx';
import { getEventos } from '../utils/agenda.functions.ts';

export const Route = createFileRoute('/agenda')({
  head: () => ({ meta: [{ title: tituloOs('Agenda') }] }),
  loader: () => getEventos(),
  component: AgendaPage,
});

function isoInput(value: string | null | undefined) {
  if (!value) return '';
  // datetime-local espera YYYY-MM-DDTHH:mm
  return value.slice(0, 16);
}

function timeLabel(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(11, 16);
  return d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function dateLabel(fecha: string) {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);
  const d = new Date(`${fecha}T12:00:00`);
  const label = d.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' });
  if (fecha === today) return `Hoy, ${label}`;
  if (fecha === tomorrowStr) return `Manana, ${label}`;
  return label;
}

function durationLabel(inicio: string | null | undefined, fin: string | null | undefined) {
  const start = inicio ? new Date(inicio) : null;
  const end = fin ? new Date(fin) : null;
  if (!start || Number.isNaN(start.getTime()) || !end || Number.isNaN(end.getTime())) return '';
  const mins = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
  if (!mins) return '';
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  return `${hours} h${rest ? ` ${rest} min` : ''}`;
}

function groupByDate(eventos: Array<{
  id: string;
  titulo: string;
  inicio: string | null;
  fin: string | null;
  ubicacion?: string;
  descripcion?: string;
}>) {
  const sorted = [...eventos].sort((a, b) => String(a.inicio).localeCompare(String(b.inicio)));
  const groups: Record<string, typeof sorted> = {};
  sorted.forEach((e) => {
    const fecha = String(e.inicio || '').slice(0, 10) || 'Sin fecha';
    if (!groups[fecha]) groups[fecha] = [];
    groups[fecha].push(e);
  });
  return groups;
}

function AgendaPage() {
  const { eventos: eventosIniciales, serverMs } = Route.useLoaderData();
  const [eventos, setEventos] = useState(eventosIniciales);
  const [form, setForm] = useState({
    titulo: '',
    inicio: '',
    fin: '',
    ubicacion: '',
    descripcion: '',
  });
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(false);

  async function recargar() {
    const res = await fetch('/api/agenda');
    const data = await res.json();
    setEventos(data.eventos ?? []);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMensaje('');
    setCargando(true);
    try {
      const res = await fetch('/api/agenda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: form.titulo,
          inicio: form.inicio,
          fin: form.fin || null,
          ubicacion: form.ubicacion || null,
          descripcion: form.descripcion || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || String(res.status));
      setForm({ titulo: '', inicio: '', fin: '', ubicacion: '', descripcion: '' });
      await recargar();
    } catch (err) {
      setMensaje(err instanceof Error ? err.message : 'Error al crear evento');
    } finally {
      setCargando(false);
    }
  }

  const groups = groupByDate(eventos);

  return (
    <OSLayout title="Agenda">
      <div className="os-fade-up">
        <PageHeader
          eyebrow="Calendario"
          title="Agenda"
          subtitle="Eventos y recordatorios por dia."
          actions={
            <span className="os-mono" style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)' }}>
              {eventos.length} evento{eventos.length === 1 ? '' : 's'} · {serverMs} ms en el servidor
            </span>
          }
        />

        <form onSubmit={onSubmit} className="os-card-2" style={{ marginBottom: '1.25rem', padding: '0.875rem 1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1.4fr) minmax(150px, 1fr) minmax(150px, 1fr)', gap: '8px', alignItems: 'end' }}>
            <input
              name="titulo"
              type="text"
              placeholder="Titulo del evento *"
              required
              className="os-input"
              style={{ fontSize: 'var(--os-text-sm)', padding: '6px 11px' }}
              value={form.titulo}
              onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
            />
            <input
              name="inicio"
              type="datetime-local"
              required
              className="os-input"
              style={{ fontSize: 'var(--os-text-sm)', padding: '6px 11px', colorScheme: 'light dark' }}
              value={form.inicio}
              onChange={(e) => setForm((f) => ({ ...f, inicio: e.target.value }))}
            />
            <input
              name="fin"
              type="datetime-local"
              className="os-input"
              style={{ fontSize: 'var(--os-text-sm)', padding: '6px 11px', colorScheme: 'light dark' }}
              value={form.fin}
              onChange={(e) => setForm((f) => ({ ...f, fin: e.target.value }))}
            />
            <input
              name="ubicacion"
              type="text"
              placeholder="Ubicacion"
              className="os-input"
              style={{ fontSize: 'var(--os-text-sm)', padding: '6px 11px' }}
              value={form.ubicacion}
              onChange={(e) => setForm((f) => ({ ...f, ubicacion: e.target.value }))}
            />
            <input
              name="descripcion"
              type="text"
              placeholder="Descripcion"
              className="os-input"
              style={{ fontSize: 'var(--os-text-sm)', padding: '6px 11px' }}
              value={form.descripcion}
              onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
            />
            <button type="submit" className="os-btn" disabled={cargando} style={{ padding: '6px 16px', fontSize: 'var(--os-text-sm)', justifyContent: 'center' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
              Crear evento
            </button>
          </div>
          {mensaje && (
            <p style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-error)', margin: '8px 0 0' }}>{mensaje}</p>
          )}
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {Object.keys(groups).length === 0 && (
            <div className="os-card-2" style={{ padding: '1.75rem', textAlign: 'center', color: 'var(--os-muted)', fontSize: 'var(--os-text-sm)' }}>
              Sin eventos para el rango consultado.
            </div>
          )}
          {Object.entries(groups).sort().map(([fecha, items]) => (
            <div key={fecha}>
              <p className="os-section-title" style={{ margin: '0 0 0.625rem' }}>{dateLabel(fecha)}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {items.map((e) => {
                  const details = [e.ubicacion, e.descripcion].filter(Boolean).join(' · ');
                  return (
                    <div key={e.id} className="os-card-2 os-card-interactive" style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '0.75rem 1rem' }}>
                      <div style={{ minWidth: 48, textAlign: 'right', flexShrink: 0 }}>
                        <p className="os-mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--os-text)', margin: 0 }}>{timeLabel(e.inicio)}</p>
                        <p style={{ fontSize: 11, color: 'var(--os-muted)', margin: '1px 0 0' }}>{durationLabel(e.inicio, e.fin)}</p>
                      </div>
                      <div style={{ width: 2, minWidth: 2, borderRadius: 2, background: 'var(--os-accent)', alignSelf: 'stretch', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--os-text)', margin: '0 0 2px', lineHeight: 1.3 }}>{e.titulo}</p>
                        {details && <p style={{ fontSize: 12, color: 'var(--os-muted)', margin: 0 }}>{details}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </OSLayout>
  );
}
