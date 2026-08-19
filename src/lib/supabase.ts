import { createClient } from '@supabase/supabase-js';

// Usamos import.meta.env para acceder a las variables de entorno de Astro en el servidor.
// Como no tienen el prefijo PUBLIC_, no estarán expuestas al navegador,
// manteniendo la seguridad de las claves.
const supabaseUrl = import.meta.env?.SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = import.meta.env?.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Las variables de entorno de Supabase (SUPABASE_URL y SUPABASE_ANON_KEY) no están definidas.');
}

// Inicializamos el cliente de Supabase
export const supabase = createClient(supabaseUrl, supabaseKey);
