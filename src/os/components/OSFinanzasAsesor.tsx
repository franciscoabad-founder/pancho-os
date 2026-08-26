import { useEffect, useState } from 'react';

interface Propuesta { id: string; severidad: 'alta' | 'media'; titulo: string; contexto: string; recomendacion: string }
interface Diagnostico { disponible_usd: number; cobros_pendientes_usd: number; pagos_pendientes_usd: number; propuestas: Propuesta[] }

export default function OSFinanzasAsesor() {
  const [data, setData] = useState<Diagnostico | null>(null);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState('');

  async function cargar() {
    try {
      const res = await fetch('/api/finanzas/asesor');
      const body = await res.json() as Diagnostico & { error?: string };
      if (!res.ok) throw new Error(body.error ?? 'No se pudo analizar');
      setData(body); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo analizar'); }
  }
  useEffect(() => { void cargar(); }, []);

  async function enviar(propuestaId: string) {
    setEnviando(propuestaId); setMensaje('');
    try {
      const res = await fetch('/api/finanzas/asesor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ propuesta_id: propuestaId }) });
      const body = await res.json() as { error?: string };
      if (!res.ok) throw new Error(body.error ?? 'No se pudo crear la aprobación');
      setMensaje('Enviado a Aprobaciones. No se movió dinero ni se cambió ningún registro.');
    } catch (e) { setMensaje(e instanceof Error ? e.message : 'Error al enviar'); }
    finally { setEnviando(null); }
  }

  if (error) return <p style={{ color: 'var(--os-muted)', fontSize: 'var(--os-text-xs)', margin: 0 }}>Asesor financiero no disponible: {error}</p>;
  if (!data || data.propuestas.length === 0) return null;
  return (
    <section className="os-card" aria-labelledby="asesor-financiero" style={{ marginBottom: '1.25rem', borderColor: 'var(--os-line-accent)' }}>
      <p className="os-eyebrow" style={{ marginBottom: 6 }}>Asesor financiero · solo propuestas</p>
      <h2 id="asesor-financiero" style={{ margin: 0, fontSize: 'var(--os-text-lg)' }}>Decisiones para revisar</h2>
      <p style={{ margin: '5px 0 12px', color: 'var(--os-muted)', fontSize: 'var(--os-text-sm)' }}>Disponible {data.disponible_usd.toFixed(2)} USD · cobros pendientes {data.cobros_pendientes_usd.toFixed(2)} USD.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.propuestas.map((p) => <article key={p.id} style={{ padding: '0.75rem', border: '1px solid var(--os-line-soft)', borderRadius: 'var(--os-r-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
            <div><strong style={{ fontSize: 'var(--os-text-sm)' }}>{p.titulo}</strong><p style={{ margin: '3px 0', color: 'var(--os-muted)', fontSize: 'var(--os-text-xs)' }}>{p.contexto}</p></div>
            <span className="os-tag" style={{ color: p.severidad === 'alta' ? 'var(--os-error)' : 'var(--os-warn)' }}>{p.severidad}</span>
          </div>
          <p style={{ margin: '6px 0 10px', fontSize: 'var(--os-text-sm)' }}>{p.recomendacion}</p>
          <button className="os-btn os-btn-ghost" onClick={() => void enviar(p.id)} disabled={enviando === p.id}>{enviando === p.id ? 'Enviando…' : 'Enviar a aprobación'}</button>
        </article>)}
      </div>
      {mensaje && <p role="status" style={{ color: 'var(--os-muted)', fontSize: 'var(--os-text-xs)', margin: '10px 0 0' }}>{mensaje}</p>}
    </section>
  );
}
