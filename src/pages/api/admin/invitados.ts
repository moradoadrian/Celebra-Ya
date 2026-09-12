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
      const nombre = body.nombre?.toString().trim();
      const telefono = body.telefono?.toString().trim() || null;
      const numero_pases = Math.max(1, parseInt(body.numero_pases, 10) || 1);
      
      // Confirmado: true (asistirá), false (no asistirá), null (pendiente)
      let confirmado: boolean | null = null;
      if (body.confirmado === true || body.confirmado === 'true') {
        confirmado = true;
      } else if (body.confirmado === false || body.confirmado === 'false') {
        confirmado = false;
      }

      // Código de pase / invitación: si no se proporciona, generar uno legible
      let codigo = body.codigo?.toString().trim() || null;
      if (!codigo) {
        const randHex = Math.random().toString(36).substring(2, 6).toUpperCase();
        codigo = `INV-${eventId}-${randHex}`;
      }

      if (!nombre) {
        return new Response(
          JSON.stringify({ success: false, error: 'El nombre del invitado o familia es requerido.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await supabase
        .from('invitados')
        .insert({
          evento_id: eventId,
          nombre,
          telefono,
          numero_pases,
          confirmado,
          codigo,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('[API Invitados Error - Create]', error.message, error.code);
        return new Response(
          JSON.stringify({
            success: false,
            error: error.code === '42501'
              ? 'Permiso denegado por políticas RLS en public.invitados.'
              : error.message || 'No pudimos registrar al invitado.',
            pgCode: error.code,
          }),
          { status: error.code === '42501' ? 403 : 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Invitado registrado correctamente.', data }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // --- ACCIÓN: UPDATE ---
    if (action === 'update') {
      const recordId = Number(id);
      if (!id || isNaN(recordId) || recordId <= 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'ID de invitado inválido.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const nombre = body.nombre?.toString().trim();
      const telefono = body.telefono?.toString().trim() || null;
      const numero_pases = Math.max(1, parseInt(body.numero_pases, 10) || 1);

      let confirmado: boolean | null = null;
      if (body.confirmado === true || body.confirmado === 'true') {
        confirmado = true;
      } else if (body.confirmado === false || body.confirmado === 'false') {
        confirmado = false;
      }

      const codigo = body.codigo?.toString().trim() || null;

      if (!nombre) {
        return new Response(
          JSON.stringify({ success: false, error: 'El nombre del invitado o familia es requerido.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // CRÍTICO: Validar aislamiento de evento_id
      const { data, error } = await supabase
        .from('invitados')
        .update({
          nombre,
          telefono,
          numero_pases,
          confirmado,
          codigo,
        })
        .eq('id', recordId)
        .eq('evento_id', eventId)
        .select()
        .single();

      if (error) {
        console.error('[API Invitados Error - Update]', error.message, error.code);
        return new Response(
          JSON.stringify({
            success: false,
            error: error.code === '42501'
              ? 'Permiso denegado por políticas RLS en public.invitados.'
              : error.message || 'No pudimos actualizar al invitado.',
            pgCode: error.code,
          }),
          { status: error.code === '42501' ? 403 : 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (!data) {
        return new Response(
          JSON.stringify({ success: false, error: 'El invitado no existe o no pertenece a este evento.' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Invitado actualizado correctamente.', data }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // --- ACCIÓN: DELETE ---
    if (action === 'delete') {
      const recordId = Number(id);
      if (!id || isNaN(recordId) || recordId <= 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'ID de invitado inválido.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // CRÍTICO: Validar aislamiento de evento_id
      const { error, count } = await supabase
        .from('invitados')
        .delete({ count: 'exact' })
        .eq('id', recordId)
        .eq('evento_id', eventId);

      if (error) {
        console.error('[API Invitados Error - Delete]', error.message, error.code);
        return new Response(
          JSON.stringify({
            success: false,
            error: error.code === '42501'
              ? 'Permiso denegado por políticas RLS en public.invitados.'
              : error.message || 'No pudimos eliminar al invitado.',
            pgCode: error.code,
          }),
          { status: error.code === '42501' ? 403 : 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (count === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'El invitado no existe o no pertenece a este evento.' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Invitado eliminado correctamente.' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Acción no reconocida (create, update, delete permitidas).' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[API Invitados Exception]', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Error interno del servidor.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
