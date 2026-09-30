import { defineMiddleware } from 'astro:middleware';
import { createSupabaseServerClient } from './lib/supabase-server';
import { isAdmin } from './lib/admin-auth';

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
    const isLogoutPage = pathname === '/admin/logout';
    const esAdmin = isAdmin(user);

    // Si no es administrador y no está en /admin/login (o cerrando sesión), redirigir a /admin/login.
    // Una sesión válida sin rol admin (p. ej. una cuenta registrada por terceros) no da acceso.
    if (!esAdmin && !isLoginPage && !isLogoutPage) {
      return context.redirect('/admin/login');
    }

    // Si ya es administrador e intenta ir a /admin/login, redirigir al panel /admin
    if (esAdmin && isLoginPage) {
      return context.redirect('/admin');
    }

    // Compartir el usuario administrador en context.locals para las vistas
    context.locals.user = esAdmin ? user : null;
  }

  return next();
});
