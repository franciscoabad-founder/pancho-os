import { useEffect, useState } from 'react';
import type { UnidadPeso } from './tipos';
import { pill } from './estilos';
import OSGfitRutinas from './OSGfitRutinas';
import OSGfitBiblioteca from './OSGfitBiblioteca';
import OSGfitProgreso from './OSGfitProgreso';

export default function OSGfit() {
  const [tab, setTab] = useState<'planes' | 'biblioteca' | 'progreso'>('planes');
  const [unidad, setUnidad] = useState<UnidadPeso>('kg');

  useEffect(() => {
    fetch('/api/os/gfit/config').then((r) => r.json()).then((d) => { if (d.unidad_peso) setUnidad(d.unidad_peso); });
  }, []);

  async function cambiarUnidad(u: UnidadPeso) {
    setUnidad(u);
    await fetch('/api/os/gfit/config', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ unidad_peso: u }) });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="os-hscroll" style={{ display: 'flex', gap: 6 }}>
        <button style={pill(tab === 'planes')} onClick={() => setTab('planes')}>Planes</button>
        <button style={pill(tab === 'biblioteca')} onClick={() => setTab('biblioteca')}>Biblioteca</button>
        <button style={pill(tab === 'progreso')} onClick={() => setTab('progreso')}>Progreso</button>
      </div>
      {tab === 'planes' && <OSGfitRutinas unidad={unidad} onUnidad={cambiarUnidad} />}
      {tab === 'biblioteca' && <OSGfitBiblioteca />}
      {tab === 'progreso' && <OSGfitProgreso unidad={unidad} />}
    </div>
  );
}
