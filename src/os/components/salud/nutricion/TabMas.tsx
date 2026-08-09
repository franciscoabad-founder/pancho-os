// Tab "Mas" del sheet de captura: quick add de kcal/macros directos (entrada libre,
// misma logica que el modo "libre" original) + crear un meal reusable a partir de
// las comidas ya registradas hoy.
import { useState } from 'react';
import type { Comida, Momento } from './tipos';
import { input, btn, card2, eyebrow } from './estilos';

interface Props {
  momento: Momento;
  dia: string;
  tipoDia: string;
  comidasHoy: Comida[];
  onAgregado: () => void;
}

export default function TabMas({ momento, dia, tipoDia, comidasHoy, onAgregado }: Props) {
  const [libre, setLibre] = useState({ descripcion: '', kcal: '', proteina: '', carbos: '', grasa: '' });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [creandoMeal, setCreandoMeal] = useState(false);
  const [mensajeMeal, setMensajeMeal] = useState('');

  async function agregarLibre() {
    if (!libre.descripcion.trim()) { setError('Describe que comiste'); return; }
    setGuardando(true); setError('');
    try {
      const res = await fetch('/api/os/salud/comidas-log', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descripcion_libre: libre.descripcion.trim(), kcal: libre.kcal || null, proteina_g: libre.proteina || null,
          carbos_g: libre.carbos || null, grasa_g: libre.grasa || null, momento, fecha: dia, tipo_dia: tipoDia,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      onAgregado();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  }

  async function crearMealDesdeHoy() {
    if (!comidasHoy.length) return;
    const nombre = window.prompt('Nombre del meal (ej. "Desayuno de rutina")');
    if (!nombre || !nombre.trim()) return;
    setCreandoMeal(true); setMensajeMeal('');
    try {
      const items = comidasHoy.map((c) => ({
        alimento_id: c.alimento_id, descripcion: c.descripcion_libre || 'Alimento', cantidad_g: c.cantidad_g,
        kcal: c.kcal, proteina_g: c.proteina_g, carbos_g: c.carbos_g, grasa_g: c.grasa_g,
      }));
      const res = await fetch('/api/os/salud/meals', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: nombre.trim(), items }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMensajeMeal('Meal guardado. Ya aparece en la pestana "Meals".');
    } catch (e) {
      setMensajeMeal(e instanceof Error ? e.message : 'Error al crear el meal');
    } finally {
      setCreandoMeal(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p style={eyebrow}>Registro rapido</p>
        {error && <div style={{ color: 'var(--os-error)', fontSize: 'var(--os-text-sm)' }}>{error}</div>}
        <input style={input} placeholder="Que comiste *" value={libre.descripcion} onChange={(e) => setLibre({ ...libre, descripcion: e.target.value })} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          <input style={input} type="number" placeholder="kcal" value={libre.kcal} onChange={(e) => setLibre({ ...libre, kcal: e.target.value })} />
          <input style={input} type="number" placeholder="P (g)" value={libre.proteina} onChange={(e) => setLibre({ ...libre, proteina: e.target.value })} />
          <input style={input} type="number" placeholder="C (g)" value={libre.carbos} onChange={(e) => setLibre({ ...libre, carbos: e.target.value })} />
          <input style={input} type="number" placeholder="G (g)" value={libre.grasa} onChange={(e) => setLibre({ ...libre, grasa: e.target.value })} />
        </div>
        <button style={btn} disabled={guardando} onClick={agregarLibre}>{guardando ? 'Guardando...' : 'Agregar entrada libre'}</button>
      </div>

      <div style={{ ...card2, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p style={eyebrow}>Crear meal desde hoy</p>
        <p style={{ fontSize: 'var(--os-text-sm)', color: 'var(--os-text-2)', margin: 0 }}>
          Junta todo lo que ya registraste hoy ({comidasHoy.length} entrada{comidasHoy.length === 1 ? '' : 's'}) en un meal reusable.
        </p>
        {mensajeMeal && <p style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-accent-light)', margin: 0 }}>{mensajeMeal}</p>}
        <button style={btn} disabled={creandoMeal || !comidasHoy.length} onClick={crearMealDesdeHoy}>
          {creandoMeal ? 'Guardando...' : 'Guardar comidas de hoy como meal'}
        </button>
      </div>
    </div>
  );
}
