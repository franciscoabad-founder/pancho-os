// Tab "Meals" del sheet de captura: lista meals reusables (nutricion_meals) y
// registra todos sus items de una vez en el momento/dia elegido.
import { useEffect, useState } from 'react';
import type { Meal, Momento } from './tipos';
import { input, rowItem } from './estilos';
import { Spinner, EmptyState } from '../../ui';

interface Props {
  momento: Momento;
  dia: string;
  onAgregado: () => void;
}

export default function TabMeals({ momento, dia, onAgregado }: Props) {
  const [q, setQ] = useState('');
  const [meals, setMeals] = useState<Meal[]>([]);
  const [cargando, setCargando] = useState(true);
  const [registrando, setRegistrando] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    const t = setTimeout(() => {
      fetch(`/api/os/salud/meals${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`)
        .then((r) => r.json())
        .then((d) => { if (vivo) setMeals(d.meals ?? []); })
        .catch(() => { if (vivo) setMeals([]); })
        .finally(() => { if (vivo) setCargando(false); });
    }, q.trim() ? 250 : 0);
    return () => { vivo = false; clearTimeout(t); };
  }, [q]);

  async function registrar(meal: Meal) {
    setRegistrando(meal.id);
    try {
      const res = await fetch('/api/os/salud/meals', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ log: meal.id, momento, fecha: dia }),
      });
      const data = await res.json();
      if (!data.error) onAgregado();
    } finally {
      setRegistrando(null);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input style={input} placeholder="Buscar meal" value={q} onChange={(e) => setQ(e.target.value)} />
      {cargando && <Spinner inline />}
      {!cargando && !meals.length && (
        <EmptyState icon="dining" title="Sin meals guardados" text='Crea uno desde la pestana "Mas" con lo que ya registraste hoy.' />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 320, overflowY: 'auto' }}>
        {meals.map((m) => (
          <button key={m.id} onClick={() => registrar(m)} disabled={registrando === m.id}
            style={{ ...rowItem, background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', width: '100%' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 'var(--os-text-sm)', color: 'var(--os-text)' }}>{m.nombre}</p>
              <p style={{ margin: '2px 0 0', fontSize: 'var(--os-text-xs)', fontFamily: 'var(--os-font-mono)', color: 'var(--os-muted)' }}>
                {m.kcal != null ? `${Math.round(m.kcal)} kcal` : 'sin macros'} · {m.items.length} item{m.items.length === 1 ? '' : 's'}
              </p>
            </div>
            <span style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-accent-light)', fontWeight: 700 }}>
              {registrando === m.id ? 'Agregando...' : 'Agregar'}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
