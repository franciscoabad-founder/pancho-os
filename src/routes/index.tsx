import { createFileRoute } from '@tanstack/react-router';

// Placeholder del scaffold (1.2.0): solo prueba que el toolchain de Vite +
// TanStack Start + Nitro construye y sirve. La home real se porta despues.
export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Pancho OS — scaffold TanStack Start</h1>
      <p>Toolchain en pie. Paginas reales se portan en las siguientes sub-fases.</p>
    </main>
  );
}
