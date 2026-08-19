import dotenv from 'dotenv';
dotenv.config();

async function testConnection() {
  const { supabase } = await import('./src/lib/supabase.ts');
  
  console.log('\n--- INICIANDO PRUEBA DE CONEXIÓN A SUPABASE ---');
  try {
    const { data, error } = await supabase
      .from('eventos')
      .select('id, nombre, slug')
      .limit(1);

    if (error) {
      console.error('❌ Error devuelto por Supabase:', error);
      process.exit(1);
    }

    console.log('✅ Conexión a Supabase exitosa.');
    console.log(`📊 Total de registros obtenidos: ${data?.length || 0}`);
    if (data && data.length > 0) {
      console.log(`📝 Primer registro encontrado: ID=${data[0].id}, Nombre="${data[0].nombre}"`);
    } else {
      console.log('ℹ️ La tabla "eventos" está vacía, pero la conexión funciona.');
    }
    console.log('--- FIN DE LA PRUEBA ---\n');
  } catch (err) {
    console.error('❌ Error inesperado:', err);
    process.exit(1);
  }
}

testConnection();
