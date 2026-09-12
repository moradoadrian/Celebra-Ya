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

  const validateUrl = (urlStr?: any) => {
    if (!urlStr || typeof urlStr !== 'string' || !urlStr.trim()) return null;
    const trimmed = urlStr.trim();
    try {
      new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
      return trimmed;
    } catch {
      return 'INVALID';
    }
  };

  try {
    // --- ACCIÓN: CREATE ---
    if (action === 'create') {
      const tipo = body.tipo?.toString().trim() || 'Mesa de Regalos';
      const nombre = body.nombre?.toString().trim();
      const descripcion = body.descripcion?.toString().trim() || '';
      const rawUrl = body.url?.toString().trim();
      const url = validateUrl(rawUrl);
      const datos = body.datos?.toString().trim() || null;
      const orden = Number(body.orden) || 1;

      if (!nombre) {
        return new Response(
          JSON.stringify({ success: false, error: 'El nombre o tienda de la mesa de regalos es requerido.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url === 'INVALID') {
        return new Response(
          JSON.stringify({ success: false, error: 'El enlace de la mesa de regalos no es una URL válida.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await supabase
        .from('mesa_regalos')
        .insert({
          evento_id: eventId,
          tipo,
          nombre,
          descripcion,
          url,
          datos,
          orden,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('[API Mesa Regalos Error - Create]', error.message, error.code);
        return new Response(
          JSON.stringify({ success: false, error: error.message || 'No pudimos agregar la mesa de regalos.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Mesa de regalos agregada correctamente.', data }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // --- ACCIÓN: UPDATE ---
    if (action === 'update') {
      const recordId = Number(id);
      if (!id || isNaN(recordId) || recordId <= 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'ID de mesa de regalos inválido.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const tipo = body.tipo?.toString().trim() || 'Mesa de Regalos';
      const nombre = body.nombre?.toString().trim();
      const descripcion = body.descripcion?.toString().trim() || '';
      const rawUrl = body.url?.toString().trim();
      const url = validateUrl(rawUrl);
      const datos = body.datos?.toString().trim() || null;
      const orden = Number(body.orden) || 1;

      if (!nombre) {
        return new Response(
          JSON.stringify({ success: false, error: 'El nombre o tienda de la mesa de regalos es requerido.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url === 'INVALID') {
        return new Response(
          JSON.stringify({ success: false, error: 'El enlace de la mesa de regalos no es una URL válida.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // CRÍTICO: Validar aislamiento de evento_id
      const { data, error } = await supabase
        .from('mesa_regalos')
        .update({
          tipo,
          nombre,
          descripcion,
          url,
          datos,
          orden,
          updated_at: new Date().toISOString(),
        })
        .eq('id', recordId)
        .eq('evento_id', eventId)
        .select()
        .single();

      if (error) {
        console.error('[API Mesa Regalos Error - Update]', error.message, error.code);
        return new Response(
          JSON.stringify({ success: false, error: error.message || 'No pudimos actualizar la mesa de regalos.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (!data) {
        return new Response(
          JSON.stringify({ success: false, error: 'La opción de regalo no existe o no pertenece a este evento.' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Mesa de regalos actualizada correctamente.', data }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // --- ACCIÓN: DELETE ---
    if (action === 'delete') {
      const recordId = Number(id);
      if (!id || isNaN(recordId) || recordId <= 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'ID de mesa de regalos inválido.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // CRÍTICO: Validar aislamiento de evento_id
      const { error, count } = await supabase
        .from('mesa_regalos')
        .delete({ count: 'exact' })
        .eq('id', recordId)
        .eq('evento_id', eventId);

      if (error) {
        console.error('[API Mesa Regalos Error - Delete]', error.message, error.code);
        return new Response(
          JSON.stringify({ success: false, error: error.message || 'No pudimos eliminar la mesa de regalos.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (count === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'La opción de regalo no existe o no pertenece a este evento.' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Mesa de regalos eliminada correctamente.' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Acción no reconocida (create, update, delete permitidas).' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[API Mesa Regalos Exception]', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Error interno del servidor.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
