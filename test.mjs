import dotenv from 'dotenv';
dotenv.config();

async function inspectData() {
  const { supabase } = await import('./src/lib/supabase.ts');
  
  const tables = ['ubicaciones', 'programa_evento', 'galeria', 'historias', 'mesa_regalos', 'invitados'];

  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('evento_id', 1);
    
    console.log(`\n========================================`);
    console.log(`TABLA: ${table}`);
    console.log(`Registros obtenidos: ${data ? data.length : 0}`);
    console.log(`Error:`, error?.message || 'Ninguno');
    if (data && data.length > 0) {
      console.log(`Datos:`, JSON.stringify(data, null, 2));
    }
  }
}

inspectData();
