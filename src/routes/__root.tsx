import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';
import { TanStackDevtools } from '@tanstack/react-devtools';

import appCss from '../styles/os.css?url';

// Documento unico de la app. Aca vive lo que en Astro estaba en el <head> de
// src/layouts/OSLayout.astro: fuentes, PWA, meta y el script anti-FOUC del tema.
// El cuerpo del shell (command bar, sidebar, bottom nav, chat) es
// src/os/components/OSLayout.tsx, que cada pagina envuelve por su cuenta.
//
// Por que el reparto y no todo el layout aca: /login NO lleva el shell del OS
// (tiene su propio fondo y su propio reset). Si el root montara el chrome, la
// pagina de acceso tendria que pelearse con el.
//
// Cuidado con meter mas cosas en este head: TanStack deduplica los <meta> por
// `name`, y en el orden de matches gana el mas hijo. Es decir, un meta que
// declare /login pisa al de aca (asi el theme-color oscuro del login sigue
// funcionando aunque el default de abajo sea claro).

// Aplica el tema guardado antes del primer paint. Clave 'os-theme'
// (independiente del tema del sitio publico, que usa 'theme'). Por defecto
// SIEMPRE claro: oscuro solo si el usuario lo eligio con el toggle. No se
// consulta prefers-color-scheme a proposito.
const scriptTema = `(function(){
  var t = 'light';
  try { if (localStorage.getItem('os-theme') === 'dark') t = 'dark'; } catch (e) {}
  document.documentElement.setAttribute('data-theme', t);
  var m = document.getElementById('os-theme-color-meta');
  if (m) m.setAttribute('content', t === 'dark' ? '#060C1E' : '#FAFAF7');
})();`;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1.0, viewport-fit=cover' },
      { title: 'Pancho OS' },
      { name: 'robots', content: 'noindex, nofollow' },
      // El id lo busca el script de arriba y el toggle de OSLayout.tsx.
      { id: 'os-theme-color-meta', name: 'theme-color', content: '#FAFAF7' },
      { name: 'mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
      { name: 'apple-mobile-web-app-title', content: 'OS Pancho' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'manifest', href: '/manifest.webmanifest' },
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;900&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&family=Nunito:wght@400;600;700;800&display=swap',
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap',
      },
    ],
    scripts: [{ children: scriptTema }],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: el script de arriba escribe data-theme en el
    // <html> antes de que React hidrate, asi que el atributo nunca coincide con
    // el HTML que mando el servidor.
    <html lang="es" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <TanStackDevtools
          config={{ position: 'bottom-right' }}
          plugins={[{ name: 'Tanstack Router', render: <TanStackRouterDevtoolsPanel /> }]}
        />
        <Scripts />
      </body>
    </html>
  );
}
