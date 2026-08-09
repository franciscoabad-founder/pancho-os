// Sheet de captura estilo Yazio: tiles de icono (Buscar/Recetas/Meals/Foto/Mas,
// Barcode deshabilitado con chip "pronto") + el contenido del tab activo.
// Overlay/bottom-sheet delegado al componente Sheet de ui/.
import { useState } from 'react';
import type { Comida, Momento, TabAgregar } from './tipos';
import { MOMENTOS, MOMENTO_LABEL } from './tipos';
import { sel, tile, tileActivo, chipMuted } from './estilos';
import { Sheet } from '../../ui';
import TabBuscar from './TabBuscar';
import TabRecetas from './TabRecetas';
import TabMeals from './TabMeals';
import TabFoto from './TabFoto';
import TabMas from './TabMas';

interface Props {
  momentoInicial: Momento;
  dia: string;
  tipoDia: string;
  comidasHoy: Comida[];
  onCerrar: () => void;
  onAgregado: () => void;
}

const TILES: { key: TabAgregar; icon: string; label: string }[] = [
  { key: 'buscar', icon: 'search', label: 'Buscar' },
  { key: 'recetas', icon: 'menu_book', label: 'Recetas' },
  { key: 'meals', icon: 'dining', label: 'Meals' },
  { key: 'foto', icon: 'photo_camera', label: 'Foto' },
  { key: 'mas', icon: 'more_horiz', label: 'Mas' },
];

export default function AddSheet({ momentoInicial, dia, tipoDia, comidasHoy, onCerrar, onAgregado }: Props) {
  const [tab, setTab] = useState<TabAgregar>('buscar');
  const [momento, setMomento] = useState<Momento>(momentoInicial);

  function agregado() {
    onAgregado();
    onCerrar();
  }

  return (
    <Sheet open onClose={onCerrar} title="Agregar comida">
      <div style={{ marginBottom: 10 }}>
        <select style={{ ...sel, width: 'auto' }} value={momento} onChange={(e) => setMomento(e.target.value as Momento)}>
          {MOMENTOS.map((m) => <option key={m} value={m}>{MOMENTO_LABEL[m]}</option>)}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6, marginBottom: 12 }}>
        {TILES.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ ...tile(false), ...(tab === t.key ? tileActivo : {}) }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: tab === t.key ? 'var(--os-accent-light)' : 'var(--os-text-2)' }}>{t.icon}</span>
            <span style={{ fontSize: 11, color: tab === t.key ? 'var(--os-accent-light)' : 'var(--os-muted)', fontWeight: 700 }}>{t.label}</span>
          </button>
        ))}
        <div style={tile(true)}>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--os-muted)' }}>qr_code_scanner</span>
          <span style={{ fontSize: 11, color: 'var(--os-muted)', fontWeight: 700 }}>Codigo</span>
          <span style={{ ...chipMuted, position: 'absolute', top: -6, right: -6, fontSize: 11, padding: '1px 5px' }}>pronto</span>
        </div>
      </div>

      {tab === 'buscar' && <TabBuscar momento={momento} dia={dia} tipoDia={tipoDia} onAgregado={agregado} />}
      {tab === 'recetas' && <TabRecetas momento={momento} dia={dia} tipoDia={tipoDia} onAgregado={agregado} />}
      {tab === 'meals' && <TabMeals momento={momento} dia={dia} onAgregado={agregado} />}
      {tab === 'foto' && <TabFoto momento={momento} dia={dia} tipoDia={tipoDia} onAgregado={agregado} />}
      {tab === 'mas' && <TabMas momento={momento} dia={dia} tipoDia={tipoDia} comidasHoy={comidasHoy} onAgregado={agregado} />}
    </Sheet>
  );
}
