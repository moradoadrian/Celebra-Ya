import { defineMiddleware } from 'astro:middleware';
import { createSupabaseServerClient } from './lib/supabase-server';

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  // Solo interceptamos y protegemos rutas que inicien con /admin
  if (pathname.startsWith('/admin')) {
    const supabase = createSupabaseServerClient({
      headers: context.request.headers,
      cookies: context.cookies,
    });

    const { data: { user } } = await supabase.auth.getUser();

    const isLoginPage = pathname === '/admin/login';

    // Si no está autenticado y no está en /admin/login, redirigir a /admin/login
    if (!user && !isLoginPage) {
      return context.redirect('/admin/login');
    }

    // Si ya está autenticado e intenta ir a /admin/login, redirigir al panel /admin
    if (user && isLoginPage) {
      return context.redirect('/admin');
    }

    // Compartir el usuario autenticado en context.locals para las vistas
    context.locals.user = user;
  }

  return next();
});
