import type { User } from '@supabase/supabase-js';

/**
 * Determina si el usuario autenticado es administrador de Celebra-Ya.
 *
 * El rol vive en `app_metadata.role`, que solo puede escribirse con la
 * service role key (SQL Editor / dashboard), nunca desde el cliente.
 * Tener sesión en Supabase NO es suficiente: cualquiera podría registrarse.
 * Debe coincidir con la función SQL `public.is_admin()` usada en las políticas RLS.
 */
export function isAdmin(user: User | null | undefined): user is User {
  return user?.app_metadata?.role === 'admin';
}
