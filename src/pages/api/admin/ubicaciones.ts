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

  // 2. Extraer y validar el cuerpo de la petición
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

  // Helper para validar URLs
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

  // 3. Procesar acciones CRUD
  try {
    // --- ACCIÓN: CREATE ---
    if (action === 'create') {
      const nombre = body.nombre?.toString().trim();
      const tipo = body.tipo?.toString().trim() || 'Lugar';
      const direccion = body.direccion?.toString().trim();

      if (!nombre) {
        return new Response(
          JSON.stringify({ success: false, error: 'El nombre del lugar es requerido.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (!direccion) {
        return new Response(
          JSON.stringify({ success: false, error: 'La dirección es requerida.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const gmaps = validateUrl(body.google_maps);
      if (gmaps === 'INVALID') {
        return new Response(
          JSON.stringify({ success: false, error: 'El enlace de Google Maps no es válido.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const waze = validateUrl(body.waze);
      if (waze === 'INVALID') {
        return new Response(
          JSON.stringify({ success: false, error: 'El enlace de Waze no es válido.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await supabase
        .from('ubicaciones')
        .insert({
          evento_id: eventId,
          nombre,
          tipo,
          direccion,
          google_maps: gmaps,
          waze,
        })
        .select()
        .single();

      if (error) {
        console.error('[API Ubicaciones Error - Create]', error.message, error.code);
        return new Response(
          JSON.stringify({ success: false, error: error.message || 'No pudimos agregar la ubicación.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Ubicación agregada correctamente.', data }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // --- ACCIÓN: UPDATE ---
    if (action === 'update') {
      const recordId = Number(id);
      if (!id || isNaN(recordId) || recordId <= 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'ID de ubicación inválido.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const nombre = body.nombre?.toString().trim();
      const tipo = body.tipo?.toString().trim() || 'Lugar';
      const direccion = body.direccion?.toString().trim();

      if (!nombre) {
        return new Response(
          JSON.stringify({ success: false, error: 'El nombre del lugar es requerido.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (!direccion) {
        return new Response(
          JSON.stringify({ success: false, error: 'La dirección es requerida.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const gmaps = validateUrl(body.google_maps);
      if (gmaps === 'INVALID') {
        return new Response(
          JSON.stringify({ success: false, error: 'El enlace de Google Maps no es válido.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const waze = validateUrl(body.waze);
      if (waze === 'INVALID') {
        return new Response(
          JSON.stringify({ success: false, error: 'El enlace de Waze no es válido.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // CRÍTICO: Validar aislamiento de evento_id
      const { data, error } = await supabase
        .from('ubicaciones')
        .update({
          nombre,
          tipo,
          direccion,
          google_maps: gmaps,
          waze,
        })
        .eq('id', recordId)
        .eq('evento_id', eventId)
        .select()
        .single();

      if (error) {
        console.error('[API Ubicaciones Error - Update]', error.message, error.code);
        return new Response(
          JSON.stringify({ success: false, error: error.message || 'No pudimos actualizar la ubicación.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (!data) {
        return new Response(
          JSON.stringify({ success: false, error: 'La ubicación no existe o no pertenece a este evento.' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Ubicación actualizada correctamente.', data }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // --- ACCIÓN: DELETE ---
    if (action === 'delete') {
      const recordId = Number(id);
      if (!id || isNaN(recordId) || recordId <= 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'ID de ubicación inválido.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // CRÍTICO: Validar aislamiento de evento_id
      const { error, count } = await supabase
        .from('ubicaciones')
        .delete({ count: 'exact' })
        .eq('id', recordId)
        .eq('evento_id', eventId);

      if (error) {
        console.error('[API Ubicaciones Error - Delete]', error.message, error.code);
        return new Response(
          JSON.stringify({ success: false, error: error.message || 'No pudimos eliminar la ubicación.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (count === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'La ubicación no existe o no pertenece a este evento.' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Ubicación eliminada correctamente.' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Acción no reconocida (create, update, delete permitidas).' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[API Ubicaciones Exception]', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Error interno del servidor.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
