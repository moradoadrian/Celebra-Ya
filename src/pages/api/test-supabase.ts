import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';

export const GET: APIRoute = async () => {
  console.log('\n--- INICIANDO PRUEBA DE CONEXIÓN A SUPABASE ---');
  try {
    const { data, error } = await supabase
      .from('eventos')
      .select('id, nombre, slug')
      .limit(1);

    if (error) {
      console.error('❌ Error devuelto por Supabase:', error);
      return new Response(JSON.stringify({ 
        status: 'error', 
        message: 'Error al conectar o consultar', 
        error: error 
      }, null, 2), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('✅ Conexión a Supabase exitosa.');
    console.log(`📊 Total de registros obtenidos: ${data?.length || 0}`);
    if (data && data.length > 0) {
      console.log(`📝 Primer registro encontrado: ID=${data[0].id}, Nombre="${data[0].nombre}"`);
    } else {
      console.log('ℹ️ La tabla "eventos" está vacía, pero la conexión funciona.');
    }
    console.log('--- FIN DE LA PRUEBA ---\n');

    return new Response(JSON.stringify({
      status: 'success',
      message: 'Conexión exitosa',
      records_count: data?.length || 0,
      first_record: data && data.length > 0 ? { id: data[0].id, nombre: data[0].nombre } : null
    }, null, 2), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error('❌ Error inesperado durante la prueba:', err);
    return new Response(JSON.stringify({ 
      status: 'error', 
      message: 'Excepción inesperada',
      error: err?.message || err 
    }, null, 2), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
