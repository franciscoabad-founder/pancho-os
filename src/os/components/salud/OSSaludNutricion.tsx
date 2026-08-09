// Nutricion OS — paridad Yazio. Orquesta el dia (fetch de comidas-log/config),
// deja el detalle visual a los sub-componentes de ./nutricion. Preserva toda la
// logica de datos original: busqueda de alimentos, tipo_dia, edicion y borrado
// de entradas, e integracion con ayuno al registrar la primera comida del dia.
import { useEffect, useMemo, useState } from 'react';
import type { Comida, Momento, Totales, Targets } from './nutricion/tipos';
import { MOMENTOS, hoyISO, addDias } from './nutricion/tipos';
import { Spinner, useConfirm } from '../ui';
import HeaderDia from './nutricion/HeaderDia';
import SeccionMomento from './nutricion/SeccionMomento';
import AddSheet from './nutricion/AddSheet';

const TOTALES_VACIOS: Totales = { kcal: 0, proteina_g: 0, carbos_g: 0, grasa_g: 0, fibra_g: 0 };
const TARGETS_VACIOS: Targets = { kcal: null, proteina_g: null, carbos_g: null, grasa_g: null };

export default function OSSaludNutricion() {
  const { confirm, sheet } = useConfirm();
  const [dia, setDia] = useState(hoyISO());
  const [comidas, setComidas] = useState<Comida[]>([]);
  const [totales, setTotales] = useState<Totales>(TOTALES_VACIOS);
  const [targets, setTargets] = useState<Targets>(TARGETS_VACIOS);
  const [restante, setRestante] = useState<Targets>(TARGETS_VACIOS);
  const [tipoDia, setTipoDia] = useState('normal');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [semana, setSemana] = useState<Comida[]>([]);

  const [sheetMomento, setSheetMomento] = useState<Momento | null>(null);

  async function cargarDia(d = dia) {
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/os/salud/comidas-log?dia=${d}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setComidas(data.comidas ?? []);
      setTotales(data.totales ?? TOTALES_VACIOS);
      setTipoDia(data.tipo_dia || 'normal');
      setTargets(data.targets ?? TARGETS_VACIOS);
      setRestante(data.restante ?? TARGETS_VACIOS);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }

  async function cargarSemana() {
    try {
      const desde = addDias(hoyISO(), -6);
      const res = await fetch(`/api/os/salud/comidas-log?historial=1&desde=${desde}`);
      const data = await res.json();
      if (!data.error) setSemana(data.comidas ?? []);
    } catch { /* silencioso */ }
  }

  useEffect(() => { cargarDia(dia); /* eslint-disable-next-line */ }, [dia]);
  useEffect(() => { cargarSemana(); /* eslint-disable-next-line */ }, []);

  async function ofrecerCerrarAyuno() {
    try {
      const res = await fetch('/api/os/salud/ayunos?abierto=1');
      const data = await res.json();
      const ayuno = data.ayuno;
      if (ayuno && ayuno.id) {
        if (await confirm({
          title: 'Cerrar ayuno',
          text: 'Tienes un ayuno abierto. ¿Lo cerramos ahora con esta comida?',
          confirmLabel: 'Cerrar ayuno',
        })) {
          await fetch(`/api/os/salud/ayunos?id=${ayuno.id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fin: new Date().toISOString() }),
          });
        }
      }
    } catch { /* silencioso: el modulo de ayuno puede no tener registros */ }
  }

  async function refrescarTrasAgregar() {
    const esPrimeraDelDia = comidas.length === 0;
    await cargarDia(dia);
    cargarSemana();
    if (esPrimeraDelDia) ofrecerCerrarAyuno();
  }

  async function cambiarTipoDia(nuevo: string) {
    const prev = tipoDia;
    setTipoDia(nuevo);
    if (comidas.length === 0) return;
    try {
      const res = await Promise.all(comidas.map((c) =>
        fetch(`/api/os/salud/comidas-log?id=${encodeURIComponent(c.id)}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tipo_dia: nuevo }),
        })
      ));
      if (res.some((r) => !r.ok)) throw new Error('No se pudieron actualizar todas las entradas');
      await cargarDia(dia);
    } catch (e) {
      setTipoDia(prev);
      setError(e instanceof Error ? e.message : 'Error al cambiar tipo de dia');
    }
  }

  const porMomento = useMemo(() => {
    const g: Record<string, Comida[]> = { desayuno: [], almuerzo: [], cena: [], snack: [] };
    for (const c of comidas) (g[c.momento] ?? g.snack).push(c);
    return g;
  }, [comidas]);

  const promedioSemana = useMemo(() => {
    if (!semana.length) return null;
    const porFecha: Record<string, number> = {};
    for (const c of semana) porFecha[c.fecha] = (porFecha[c.fecha] || 0) + (Number(c.kcal) || 0);
    const dias = Object.values(porFecha);
    if (!dias.length) return null;
    return Math.round(dias.reduce((a, b) => a + b, 0) / dias.length);
  }, [semana]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {error && <div style={{ color: 'var(--os-error)', fontSize: 'var(--os-text-sm)' }}>{error}</div>}

      <HeaderDia
        dia={dia} setDia={setDia} tipoDia={tipoDia} onCambiarTipoDia={cambiarTipoDia}
        totales={totales} targets={targets} restante={restante}
        onMetasGuardadas={() => cargarDia(dia)}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading ? (
          <Spinner />
        ) : (
          MOMENTOS.map((m) => (
            <SeccionMomento
              key={m} momento={m} comidas={porMomento[m]}
              onCambio={() => cargarDia(dia)}
              onAgregar={(momento) => setSheetMomento(momento)}
            />
          ))
        )}
      </div>

      {promedioSemana != null && (
        <div style={{
          background: 'var(--os-surface)', borderRadius: 'var(--os-r-card)', boxShadow: 'var(--os-shadow-card)',
          padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 'var(--os-text-sm)', color: 'var(--os-text-2)' }}>Promedio ultimos 7 dias</span>
          <span style={{ fontFamily: 'var(--os-font-rounded)', fontSize: 18, color: 'var(--os-champagne)', fontWeight: 800 }}>{promedioSemana} kcal</span>
        </div>
      )}

      {sheetMomento && (
        <AddSheet
          momentoInicial={sheetMomento} dia={dia} tipoDia={tipoDia} comidasHoy={comidas}
          onCerrar={() => setSheetMomento(null)}
          onAgregado={refrescarTrasAgregar}
        />
      )}
      {sheet}
    </div>
  );
}
