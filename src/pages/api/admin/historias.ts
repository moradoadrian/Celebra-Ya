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
      const titulo = body.titulo?.toString().trim();
      const descripcion = body.descripcion?.toString().trim();
      const fecha = body.fecha?.toString().trim() || null;
      const orden = Number(body.orden) || 1;

      if (!titulo) {
        return new Response(
          JSON.stringify({ success: false, error: 'El título de la historia es requerido.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (!descripcion) {
        return new Response(
          JSON.stringify({ success: false, error: 'La descripción de la historia es requerida.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await supabase
        .from('historias')
        .insert({
          evento_id: eventId,
          titulo,
          descripcion,
          fecha,
          orden,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('[API Historias Error - Create]', error.message, error.code);
        return new Response(
          JSON.stringify({ success: false, error: error.message || 'No pudimos agregar la historia.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Historia agregada correctamente.', data }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // --- ACCIÓN: UPDATE ---
    if (action === 'update') {
      const recordId = Number(id);
      if (!id || isNaN(recordId) || recordId <= 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'ID de historia inválido.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const titulo = body.titulo?.toString().trim();
      const descripcion = body.descripcion?.toString().trim();
      const fecha = body.fecha?.toString().trim() || null;
      const orden = Number(body.orden) || 1;

      if (!titulo) {
        return new Response(
          JSON.stringify({ success: false, error: 'El título de la historia es requerido.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (!descripcion) {
        return new Response(
          JSON.stringify({ success: false, error: 'La descripción de la historia es requerida.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // CRÍTICO: Validar aislamiento de evento_id
      const { data, error } = await supabase
        .from('historias')
        .update({
          titulo,
          descripcion,
          fecha,
          orden,
          updated_at: new Date().toISOString(),
        })
        .eq('id', recordId)
        .eq('evento_id', eventId)
        .select()
        .single();

      if (error) {
        console.error('[API Historias Error - Update]', error.message, error.code);
        return new Response(
          JSON.stringify({ success: false, error: error.message || 'No pudimos actualizar la historia.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (!data) {
        return new Response(
          JSON.stringify({ success: false, error: 'La historia no existe o no pertenece a este evento.' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Historia actualizada correctamente.', data }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // --- ACCIÓN: DELETE ---
    if (action === 'delete') {
      const recordId = Number(id);
      if (!id || isNaN(recordId) || recordId <= 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'ID de historia inválido.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // CRÍTICO: Validar aislamiento de evento_id
      const { error, count } = await supabase
        .from('historias')
        .delete({ count: 'exact' })
        .eq('id', recordId)
        .eq('evento_id', eventId);

      if (error) {
        console.error('[API Historias Error - Delete]', error.message, error.code);
        return new Response(
          JSON.stringify({ success: false, error: error.message || 'No pudimos eliminar la historia.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (count === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'La historia no existe o no pertenece a este evento.' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Historia eliminada correctamente.' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Acción no reconocida (create, update, delete permitidas).' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[API Historias Exception]', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Error interno del servidor.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
