import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const data = await request.formData();
  const password = data.get('password');
  const expectedPassword = process.env.OS_PASSWORD || import.meta.env.OS_PASSWORD;
  const token = process.env.OS_AUTH_TOKEN || import.meta.env.OS_AUTH_TOKEN;

  // Sin defaults hardcodeados: un OS_PASSWORD/OS_AUTH_TOKEN sin configurar
  // debe fallar fuerte, no caer a una contrasena conocida en el codigo
  // fuente (era 'pancho2026' / 'pancho_os_auth_token_2026' hasta hoy).
  if (!expectedPassword || !token) {
    return new Response('OS_PASSWORD / OS_AUTH_TOKEN no configurados en el servidor.', { status: 500 });
  }

  if (password === expectedPassword) {
    cookies.set('os_auth', token, {
      path: '/',
      httpOnly: true,
      secure: true,
      maxAge: 60 * 60 * 24 * 30, // 30 days
      sameSite: 'lax'
    });
    return redirect('/');
  }
  
  return redirect('/login?error=1');
};

export const GET: APIRoute = async ({ request, cookies, redirect }) => {
  const url = new URL(request.url);
  if (url.searchParams.get('action') === 'logout') {
    cookies.delete('os_auth', { path: '/' });
  }
  return redirect('/login');
};
