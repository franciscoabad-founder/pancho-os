// Card por momento del dia (Desayuno/Almuerzo/Cena/Snacks): subtotal, filas de
// comidas (edit/delete via FilaComida), desglose expandible y boton "+ Agregar"
// que abre el sheet de captura ya con el momento preseleccionado.
import type { Comida, Momento } from './tipos';
import { MOMENTO_LABEL, MOMENTO_ICON, sumarColumna } from './tipos';
import { card2, eyebrow, btnGhost } from './estilos';
import FilaComida from './FilaComida';
import Desglose from './Desglose';

interface Props {
  momento: Momento;
  comidas: Comida[];
  onCambio: () => void;
  onAgregar: (momento: Momento) => void;
}

export default function SeccionMomento({ momento, comidas, onCambio, onAgregar }: Props) {
  const subtotal = sumarColumna(comidas, 'kcal') ?? 0;

  return (
    <div style={card2}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--os-accent-light)' }}>{MOMENTO_ICON[momento]}</span>
          <p style={{ ...eyebrow, textTransform: 'none', fontSize: 13, letterSpacing: 0, color: 'var(--os-text)' }}>{MOMENTO_LABEL[momento]}</p>
        </div>
        {comidas.length > 0 && (
          <span style={{ fontFamily: 'var(--os-font-rounded)', fontWeight: 700, fontSize: 14, color: 'var(--os-text-2)' }}>
            {Math.round(subtotal)} <span style={{ fontSize: 11, color: 'var(--os-muted)', fontFamily: 'var(--os-font-body)' }}>kcal</span>
          </span>
        )}
      </div>

      {comidas.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {comidas.map((c) => <FilaComida key={c.id} comida={c} onCambio={onCambio} />)}
        </div>
      ) : (
        <p style={{ fontSize: 'var(--os-text-sm)', color: 'var(--os-muted)', margin: '0 0 8px' }}>Todavia no registras nada aqui.</p>
      )}

      {comidas.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <Desglose comidas={comidas} />
        </div>
      )}

      <button
        style={{ ...btnGhost, width: '100%', justifyContent: 'center', marginTop: 10 }}
        onClick={() => onAgregar(momento)}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
        Agregar
      </button>
    </div>
  );
}
