import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const POST: APIRoute = async (context) => {
  const { request, cookies } = context;

  // 1. Validar autenticación SSR
  const supabase = createSupabaseServerClient({
    headers: request.headers,
    cookies,
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return new Response(
      JSON.stringify({ success: false, error: 'Sesión no autorizada. Inicia sesión nuevamente.' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 2. Extraer y validar cuerpo de petición
  let body: Record<string, any> = {};
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: 'Cuerpo de petición inválido (JSON esperado).' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { action, evento_id, id } = body;
  const eventId = Number(evento_id);

  if (!evento_id || isNaN(eventId) || eventId <= 0) {
    return new Response(
      JSON.stringify({ success: false, error: 'ID de evento inválido o faltante.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // --- ACCIÓN: CREATE ---
    if (action === 'create') {
      const hora = body.hora?.toString().trim();
      const titulo = body.titulo?.toString().trim();
      const descripcion = body.descripcion?.toString().trim() || '';
      const orden = Number(body.orden) || 1;

      if (!hora) {
        return new Response(
          JSON.stringify({ success: false, error: 'La hora es requerida (ej. 17:00).' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (!titulo) {
        return new Response(
          JSON.stringify({ success: false, error: 'El título del momento es requerido.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await supabase
        .from('programa_evento')
        .insert({
          evento_id: eventId,
          hora,
          titulo,
          descripcion,
          orden,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('[API Programa Error - Create]', error.message, error.code);
        return new Response(
          JSON.stringify({ success: false, error: error.message || 'No pudimos agregar el momento al programa.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Momento agregado al programa correctamente.', data }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // --- ACCIÓN: UPDATE ---
    if (action === 'update') {
      const recordId = Number(id);
      if (!id || isNaN(recordId) || recordId <= 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'ID de programa inválido.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const hora = body.hora?.toString().trim();
      const titulo = body.titulo?.toString().trim();
      const descripcion = body.descripcion?.toString().trim() || '';
      const orden = Number(body.orden) || 1;

      if (!hora) {
        return new Response(
          JSON.stringify({ success: false, error: 'La hora es requerida (ej. 17:00).' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (!titulo) {
        return new Response(
          JSON.stringify({ success: false, error: 'El título del momento es requerido.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // CRÍTICO: Validar aislamiento de evento_id
      const { data, error } = await supabase
        .from('programa_evento')
        .update({
          hora,
          titulo,
          descripcion,
          orden,
          updated_at: new Date().toISOString(),
        })
        .eq('id', recordId)
        .eq('evento_id', eventId)
        .select()
        .single();

      if (error) {
        console.error('[API Programa Error - Update]', error.message, error.code);
        return new Response(
          JSON.stringify({ success: false, error: error.message || 'No pudimos actualizar el momento.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (!data) {
        return new Response(
          JSON.stringify({ success: false, error: 'El momento no existe o no pertenece a este evento.' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Momento actualizado correctamente.', data }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // --- ACCIÓN: DELETE ---
    if (action === 'delete') {
      const recordId = Number(id);
      if (!id || isNaN(recordId) || recordId <= 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'ID de programa inválido.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // CRÍTICO: Validar aislamiento de evento_id
      const { error, count } = await supabase
        .from('programa_evento')
        .delete({ count: 'exact' })
        .eq('id', recordId)
        .eq('evento_id', eventId);

      if (error) {
        console.error('[API Programa Error - Delete]', error.message, error.code);
        return new Response(
          JSON.stringify({ success: false, error: error.message || 'No pudimos eliminar el momento del programa.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (count === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'El momento no existe o no pertenece a este evento.' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Momento eliminado correctamente.' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Acción no reconocida (create, update, delete permitidas).' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[API Programa Exception]', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Error interno del servidor.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
