import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const ALL: APIRoute = async (context) => {
  const supabase = createSupabaseServerClient({
    headers: context.request.headers,
    cookies: context.cookies,
  });

  await supabase.auth.signOut();

  return context.redirect('/admin/login');
};
