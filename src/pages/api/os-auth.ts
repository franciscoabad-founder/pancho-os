import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const data = await request.formData();
  const password = data.get('password');
  
  if (password === import.meta.env.OS_PASSWORD) {
    const token = import.meta.env.OS_AUTH_TOKEN;
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
