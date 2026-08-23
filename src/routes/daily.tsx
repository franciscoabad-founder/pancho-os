// Pagina /daily portada de src/pages/daily.astro a TanStack Start.
//
// Es una pagina de datos estaticos: todo sale de src/os/data/daily.ts, que es
// TypeScript plano y no depende de Astro. Lo unico interactivo son los dos
// OSChecklist (ancla AM y cierre PM), que ya eran islas React.
//
// El markup se copia literal del .astro; lo unico que cambia es la forma de
// escribir los estilos (strings inline -> objetos de React) y las clases
// (class -> className). Los textos, iconos y el orden de los bloques son los
// mismos.

import { createFileRoute } from '@tanstack/react-router';
import OSLayout, { tituloOs } from '../os/components/OSLayout.tsx';
import PageHeader from '../os/components/ui/PageHeader.tsx';
import OSChecklist from '../os/components/OSChecklist.tsx';
import { datosDaily } from '../os/data/daily.ts';

const { principios, semana, rutina_am, check_10min, pm_close, reglas } = datosDaily;

const tipoColor: Record<string, string> = {
  maker: 'var(--os-accent)',
  manager: 'var(--os-muted)',
  off: 'var(--os-muted)',
};
const tipoBg: Record<string, string> = {
  maker: 'rgba(59,78,217,0.15)',
  manager: 'var(--os-fill-subtle)',
  off: 'var(--os-fill-subtle)',
};
const tipoLabel: Record<string, string> = {
  maker: 'Maker',
  manager: 'Manager',
  off: 'Off',
};

const css = `
  @media (max-width: 820px) {
    .os-2col { grid-template-columns: 1fr !important; }
  }
`;

export const Route = createFileRoute('/daily')({
  head: () => ({ meta: [{ title: tituloOs('Daily OS') }] }),
  component: DailyPage,
});

function DailyPage() {
  return (
    <OSLayout title="Daily OS">
      <div className="os-fade-up">
        <PageHeader
          eyebrow="Sistema diario"
          title="Daily OS"
          subtitle="Principios, semana Maker/Manager y rutinas del dia."
        />

        {/* Principios */}
        <div className="os-card-2" style={{ marginBottom: '1rem' }}>
          <p className="os-section-title">Mis principios</p>
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {principios.map((p, i) => (
              <li key={p} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span
                  className="os-mono"
                  style={{ fontSize: 11, fontWeight: 700, color: 'var(--os-accent)', minWidth: 16, paddingTop: 2 }}
                >
                  {i + 1}
                </span>
                <span style={{ fontSize: 14, color: 'var(--os-text)', lineHeight: 1.4 }}>{p}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Semana Maker / Manager */}
        <div className="os-card-2" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.875rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--os-accent-light)' }}>
              calendar_view_week
            </span>
            <p className="os-section-title" style={{ margin: 0 }}>Mi semana Maker / Manager</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
            {semana.map((d) => (
              <div
                key={d.dia}
                style={{
                  background: tipoBg[d.tipo],
                  border: `1px solid ${d.tipo === 'maker' ? 'var(--os-line-accent)' : 'var(--os-line-soft)'}`,
                  borderRadius: 'var(--os-r-md)',
                  padding: '0.625rem 0.5rem',
                  textAlign: 'center',
                }}
              >
                <p style={{ fontFamily: 'var(--os-font-display)', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--os-muted)', margin: '0 0 4px' }}>
                  {d.dia.slice(0, 3)}
                </p>
                <p style={{ fontFamily: 'var(--os-font-display)', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: tipoColor[d.tipo], margin: '0 0 4px' }}>
                  {tipoLabel[d.tipo]}
                </p>
                <p style={{ fontSize: 11, color: 'var(--os-muted)', margin: 0, lineHeight: 1.3 }}>{d.descripcion}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--os-accent)', display: 'block' }} />
              <span style={{ fontSize: 11, color: 'var(--os-muted)' }}>Maker: crear y entregar (Mie, Vie, Sab)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--os-line)', display: 'block' }} />
              <span style={{ fontSize: 11, color: 'var(--os-muted)' }}>Manager: reuniones y tramites (Lun, Mar, Jue)</span>
            </div>
          </div>
        </div>

        {/* Mi dia + rutinas */}
        <div className="os-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>

          {/* Rutina AM */}
          <div className="os-card-2">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.875rem' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--os-champagne)' }}>
                wb_sunny
              </span>
              <p className="os-section-title" style={{ margin: 0 }}>Ancla AM</p>
            </div>
            <OSChecklist items={rutina_am} />
          </div>

          {/* Check 10 min + PM Close + reglas */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="os-card-2">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.75rem' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--os-accent-light)' }}>
                  timer
                </span>
                <p className="os-section-title" style={{ margin: 0 }}>Check de 10 min</p>
              </div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
                {check_10min.map((q) => (
                  <li key={q} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: 16, color: 'var(--os-accent-light)', flexShrink: 0, marginTop: 1 }}
                    >
                      help
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--os-text)', lineHeight: 1.4 }}>{q}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="os-card-2">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.875rem' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--os-accent-light)' }}>
                  bedtime
                </span>
                <p className="os-section-title" style={{ margin: 0 }}>Cierre PM</p>
              </div>
              <OSChecklist items={pm_close} />
            </div>

            {/* Reglas innegociables */}
            <div className="os-card-2 os-card-accent">
              <p className="os-eyebrow" style={{ margin: '0 0 0.625rem' }}>Reglas</p>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {reglas.map((r) => (
                  <li key={r} style={{ fontSize: 13, color: 'var(--os-text)', lineHeight: 1.4, paddingLeft: 14, position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 0, top: 7, width: 5, height: 1, background: 'var(--os-accent)', display: 'block' }} />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: css }} />
    </OSLayout>
  );
}
