// Pagina de acceso, portada de src/pages/login.astro.
//
// En Astro esta pagina era un documento HTML completo (tenia su propio <html>,
// <head> y <style>). Aca el shell lo pone __root.tsx, asi que: el <head> se
// declara con la opcion `head` de la ruta y el CSS va scopeado bajo .os-login
// para no pelearse con src/styles/os.css, que se carga global desde el root.
//
// El formulario sigue siendo un POST HTML plano contra /api/os-auth: sin JS,
// sin server function, igual que antes.

import { createFileRoute } from '@tanstack/react-router';

// El ?error=1 que manda /api/os-auth se preserva tal cual (TanStack lo parsea
// como number 1). Si lo normalizaramos a string, el router detectaria que el
// search serializado no coincide con la URL y responderia un 307 a
// /login?error="1" antes de renderizar.
type LoginSearch = { error?: string | number | boolean };

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>): LoginSearch => {
    const error = search.error;
    if (typeof error === 'string' || typeof error === 'number' || typeof error === 'boolean') {
      return { error };
    }
    return {};
  },
  head: () => ({
    meta: [
      { title: 'Acceso · OS · Francisco Abad' },
      { name: 'robots', content: 'noindex, nofollow' },
      { name: 'theme-color', content: '#060C1E' },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
      { name: 'apple-mobile-web-app-title', content: 'OS Pancho' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1.0, viewport-fit=cover' },
    ],
    links: [
      { rel: 'manifest', href: '/manifest.webmanifest' },
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;900&family=Inter:wght@400;500;600&display=swap',
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap',
      },
    ],
  }),
  component: LoginPage,
});

const css = `
  body {
    background: #071132;
    color: #E8EAF0;
    font-family: 'Inter', sans-serif;
    -webkit-font-smoothing: antialiased;
    background-image:
      radial-gradient(ellipse 70% 55% at 50% 30%, rgba(59,78,217,0.14) 0%, transparent 70%),
      linear-gradient(rgba(59,78,217,0.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(59,78,217,0.025) 1px, transparent 1px);
    background-size: auto, 36px 36px, 36px 36px;
  }
  .os-login, .os-login *, .os-login *::before, .os-login *::after {
    box-sizing: border-box; margin: 0; padding: 0;
  }
  .os-login {
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }
  .os-login .material-symbols-outlined {
    font-family: 'Material Symbols Outlined';
    font-weight: normal; font-style: normal; line-height: 1;
    letter-spacing: normal; text-transform: none; white-space: nowrap;
    word-wrap: normal; direction: ltr;
    font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
  }
  @keyframes os-login-pulse { 0%,100%{opacity:1;} 50%{opacity:0.5;} }
  .os-login .mode { display: inline-flex; align-items: center; gap: 6px; margin-bottom: 1.5rem; }
  .os-login .mode .material-symbols-outlined {
    font-size: 17px; color: #6B7AE8;
    animation: os-login-pulse 2.4s cubic-bezier(0.4,0,0.6,1) infinite;
  }
  .os-login .mode span:last-child {
    font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 700;
    letter-spacing: 0.2em; text-transform: uppercase; color: #6B7AE8;
  }
  .os-login .card {
    position: relative;
    background: rgba(26,43,107,0.55);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(59,78,217,0.30);
    border-radius: 16px;
    padding: 2.5rem 2rem;
    width: 100%;
    max-width: 372px;
    box-shadow: 0 18px 48px rgba(14,23,56,0.40);
  }
  .os-login h1 {
    font-family: 'Montserrat', sans-serif; font-size: 1.25rem; font-weight: 700;
    color: #E8EAF0; margin-bottom: 0.375rem;
  }
  .os-login .sub { font-size: 13px; color: #6B7280; margin-bottom: 2rem; line-height: 1.45; }
  .os-login .field-label {
    font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 600;
    letter-spacing: 0.12em; text-transform: uppercase; color: #6B7280;
    display: block; margin-bottom: 6px;
  }
  .os-login input[type="password"] {
    width: 100%;
    background: rgba(232,234,240,0.05);
    border: 1px solid rgba(232,234,240,0.12);
    border-radius: 8px;
    padding: 0.75rem 1rem;
    font-size: 14px; color: #E8EAF0; font-family: 'Inter', sans-serif;
    outline: none; margin-bottom: 1rem; transition: border-color 0.15s;
  }
  .os-login input[type="password"]:focus { border-color: rgba(59,78,217,0.55); }
  .os-login button[type="submit"] {
    width: 100%;
    background: #3B4ED9; border: none; border-radius: 8px;
    padding: 0.8rem 1rem;
    font-family: 'Montserrat', sans-serif; font-size: 12px; font-weight: 700;
    letter-spacing: 0.1em; text-transform: uppercase; color: #fff;
    cursor: pointer; transition: background 0.15s, transform 0.12s;
    display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  }
  .os-login button[type="submit"]:hover { background: #4a5fea; }
  .os-login button[type="submit"]:active { transform: scale(0.98); }
  .os-login .error-msg {
    font-size: 12px; color: #ffb4ab; margin-bottom: 1rem;
    padding: 0.5rem 0.75rem; background: rgba(147,0,10,0.18);
    border-radius: 6px; border: 1px solid rgba(255,180,171,0.25);
  }
  .os-login .back-link {
    display: block; margin-top: 1.5rem; font-size: 11px; color: #6B7280;
    text-decoration: none; text-align: center; letter-spacing: 0.03em;
  }
  .os-login .back-link:hover { color: #E8EAF0; }
`;

function LoginPage() {
  const { error } = Route.useSearch();

  return (
    <div className="os-login">
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="card">
        <span className="mode">
          <span className="material-symbols-outlined">bolt</span>
          <span>OS · Francisco Abad</span>
        </span>
        <h1>Acceso restringido</h1>
        <p className="sub">Sistema operativo personal. Solo para uso del titular.</p>
        {error ? <p className="error-msg">Contrasena incorrecta. Intenta de nuevo.</p> : null}
        <form method="POST" action="/api/os-auth">
          <label className="field-label" htmlFor="password">
            Contrasena
          </label>
          <input
            type="password"
            id="password"
            name="password"
            placeholder="••••••••••••"
            autoFocus
            required
          />
          <button type="submit">
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
              lock_open
            </span>
            Entrar al OS
          </button>
        </form>
        <a href="/" className="back-link">
          franciscoabad.com
        </a>
      </div>
    </div>
  );
}
