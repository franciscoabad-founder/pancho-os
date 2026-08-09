// Header del dia: navegacion de fecha, pill de tipo_dia, numeros grandes
// Comido/Restante y los 3 anillos de macro (Carbos/Proteina/Grasa). Si no hay
// ninguna meta configurada, ofrece el editor inline en vez de "Restante".
import { useState } from 'react';
import type { Totales, Targets } from './tipos';
import { hoyISO, addDias, fechaLarga, TIPOS_DIA } from './tipos';
import { card, sel, btnGhost, numGrande } from './estilos';
import MacroRing from './MacroRing';
import TargetsEditor from './TargetsEditor';

interface Props {
  dia: string;
  setDia: (d: string) => void;
  tipoDia: string;
  onCambiarTipoDia: (t: string) => void;
  totales: Totales;
  targets: Targets;
  restante: Targets;
  onMetasGuardadas: () => void;
}

export default function HeaderDia({ dia, setDia, tipoDia, onCambiarTipoDia, totales, targets, restante, onMetasGuardadas }: Props) {
  const [editandoMetas, setEditandoMetas] = useState(false);
  const sinMetas = targets.kcal == null && targets.proteina_g == null && targets.carbos_g == null && targets.grasa_g == null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button style={btnGhost} onClick={() => setDia(addDias(dia, -1))}>‹</button>
          <span style={{ fontFamily: 'var(--os-font-display)', fontWeight: 700, fontSize: 13, minWidth: 120, textAlign: 'center', textTransform: 'capitalize', color: 'var(--os-text)' }}>
            {dia === hoyISO() ? 'Hoy' : fechaLarga(dia)}
          </span>
          <button style={btnGhost} onClick={() => setDia(addDias(dia, 1))} disabled={dia >= hoyISO()}>›</button>
          {dia !== hoyISO() && <button style={btnGhost} onClick={() => setDia(hoyISO())}>Hoy</button>}
        </div>
        <select style={{ ...sel, width: 'auto' }} value={tipoDia} onChange={(e) => onCambiarTipoDia(e.target.value)}>
          {TIPOS_DIA.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
      </div>

      {editandoMetas ? (
        <TargetsEditor
          valores={targets}
          onCerrar={() => setEditandoMetas(false)}
          onGuardado={() => { setEditandoMetas(false); onMetasGuardadas(); }}
        />
      ) : (
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ ...numGrande, fontSize: 26 }}>{Math.round(totales.kcal)}</p>
              <p style={{ fontSize: 11, color: 'var(--os-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '2px 0 0' }}>Comido</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              {sinMetas ? (
                <button
                  onClick={() => setEditandoMetas(true)}
                  style={{ background: 'none', border: 'none', color: 'var(--os-accent-light)', fontFamily: 'var(--os-font-display)', fontWeight: 700, fontSize: 14, cursor: 'pointer', padding: 0 }}
                >
                  Configura tus metas
                </button>
              ) : (
                <>
                  <p style={{ ...numGrande, fontSize: 34, color: restante.kcal != null && restante.kcal < 0 ? '#E8709A' : 'var(--os-text)' }}>
                    {restante.kcal != null ? Math.round(restante.kcal) : '—'}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--os-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '2px 0 0' }}>Restante (kcal)</p>
                </>
              )}
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ ...numGrande, fontSize: 26 }}>{targets.kcal ?? '—'}</p>
              <p style={{ fontSize: 11, color: 'var(--os-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '2px 0 0' }}>Meta</p>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: 12 }}>
            <MacroRing label="Carbos" consumido={totales.carbos_g} target={targets.carbos_g} onConfigurar={() => setEditandoMetas(true)} />
            <MacroRing label="Proteina" consumido={totales.proteina_g} target={targets.proteina_g} onConfigurar={() => setEditandoMetas(true)} />
            <MacroRing label="Grasa" consumido={totales.grasa_g} target={targets.grasa_g} onConfigurar={() => setEditandoMetas(true)} />
          </div>
        </div>
      )}
    </div>
  );
}
