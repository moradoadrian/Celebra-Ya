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
    if (!urlStr || typeof urlStr !== 'string' || !urlStr.trim()) return 'INVALID';
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
      const rawUrl = body.imagen_url?.toString().trim();
      const imagen_url = validateUrl(rawUrl);
      const descripcion = body.descripcion?.toString().trim() || '';
      const orden = Number(body.orden) || 1;

      if (!rawUrl || imagen_url === 'INVALID') {
        return new Response(
          JSON.stringify({ success: false, error: 'Se requiere una URL válida para la imagen.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await supabase
        .from('galeria')
        .insert({
          evento_id: eventId,
          imagen_url,
          descripcion,
          orden,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('[API Galeria Error - Create]', error.message, error.code);
        return new Response(
          JSON.stringify({ success: false, error: error.message || 'No pudimos agregar la imagen a la galería.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Imagen agregada a la galería correctamente.', data }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // --- ACCIÓN: UPDATE ---
    if (action === 'update') {
      const recordId = Number(id);
      if (!id || isNaN(recordId) || recordId <= 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'ID de imagen inválido.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const rawUrl = body.imagen_url?.toString().trim();
      const imagen_url = validateUrl(rawUrl);
      const descripcion = body.descripcion?.toString().trim() || '';
      const orden = Number(body.orden) || 1;

      if (!rawUrl || imagen_url === 'INVALID') {
        return new Response(
          JSON.stringify({ success: false, error: 'Se requiere una URL válida para la imagen.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // CRÍTICO: Validar aislamiento de evento_id
      const { data, error } = await supabase
        .from('galeria')
        .update({
          imagen_url,
          descripcion,
          orden,
          updated_at: new Date().toISOString(),
        })
        .eq('id', recordId)
        .eq('evento_id', eventId)
        .select()
        .single();

      if (error) {
        console.error('[API Galeria Error - Update]', error.message, error.code);
        return new Response(
          JSON.stringify({ success: false, error: error.message || 'No pudimos actualizar la imagen.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (!data) {
        return new Response(
          JSON.stringify({ success: false, error: 'La imagen no existe o no pertenece a este evento.' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Imagen actualizada correctamente.', data }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // --- ACCIÓN: DELETE ---
    if (action === 'delete') {
      const recordId = Number(id);
      if (!id || isNaN(recordId) || recordId <= 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'ID de imagen inválido.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // CRÍTICO: Validar aislamiento de evento_id
      const { error, count } = await supabase
        .from('galeria')
        .delete({ count: 'exact' })
        .eq('id', recordId)
        .eq('evento_id', eventId);

      if (error) {
        console.error('[API Galeria Error - Delete]', error.message, error.code);
        return new Response(
          JSON.stringify({ success: false, error: error.message || 'No pudimos eliminar la imagen.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (count === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'La imagen no existe o no pertenece a este evento.' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Imagen eliminada de la galería correctamente.' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Acción no reconocida (create, update, delete permitidas).' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[API Galeria Exception]', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Error interno del servidor.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
