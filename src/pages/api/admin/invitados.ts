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

      // Validación y cálculo de pases_confirmados según reglas oficiales
      let pases_confirmados: number | null = null;
      if (confirmado === null) {
        pases_confirmados = null;
      } else if (confirmado === false) {
        pases_confirmados = 0;
      } else if (confirmado === true) {
        const rawPasesConf = body.pases_confirmados !== undefined && body.pases_confirmados !== ''
          ? Number(body.pases_confirmados)
          : numero_pases;

        if (isNaN(rawPasesConf) || rawPasesConf <= 0) {
          return new Response(
            JSON.stringify({ success: false, error: 'Un invitado confirmado debe tener al menos 1 pase confirmado.' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        if (rawPasesConf < 0) {
          return new Response(
            JSON.stringify({ success: false, error: 'Los pases confirmados no pueden ser negativos.' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        if (rawPasesConf > numero_pases) {
          return new Response(
            JSON.stringify({
              success: false,
              error: `Los pases confirmados (${rawPasesConf}) no pueden superar los pases asignados (${numero_pases}).`,
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        pases_confirmados = Math.floor(rawPasesConf);
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

      const insertPayload: Record<string, any> = {
        evento_id: eventId,
        nombre,
        telefono,
        numero_pases,
        confirmado,
        pases_confirmados,
        codigo,
        created_at: new Date().toISOString(),
      };

      let { data, error } = await supabase
        .from('invitados')
        .insert(insertPayload)
        .select()
        .single();

      // Fallback si la columna pases_confirmados aún no existe en Supabase (error 42703)
      if (error && error.code === '42703') {
        console.warn('[API Invitados Create] Columna pases_confirmados no existe aún. Insertando sin la columna.');
        delete insertPayload.pases_confirmados;
        const retryResult = await supabase
          .from('invitados')
          .insert(insertPayload)
          .select()
          .single();
        data = retryResult.data;
        error = retryResult.error;
      }

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

      // Validación y cálculo de pases_confirmados según reglas oficiales
      let pases_confirmados: number | null = null;
      if (confirmado === null) {
        pases_confirmados = null;
      } else if (confirmado === false) {
        pases_confirmados = 0;
      } else if (confirmado === true) {
        const rawPasesConf = body.pases_confirmados !== undefined && body.pases_confirmados !== ''
          ? Number(body.pases_confirmados)
          : numero_pases;

        if (isNaN(rawPasesConf) || rawPasesConf <= 0) {
          return new Response(
            JSON.stringify({ success: false, error: 'Un invitado confirmado debe tener al menos 1 pase confirmado.' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        if (rawPasesConf < 0) {
          return new Response(
            JSON.stringify({ success: false, error: 'Los pases confirmados no pueden ser negativos.' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        if (rawPasesConf > numero_pases) {
          return new Response(
            JSON.stringify({
              success: false,
              error: `Los pases confirmados (${rawPasesConf}) no pueden superar los pases asignados (${numero_pases}).`,
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        pases_confirmados = Math.floor(rawPasesConf);
      }

      const codigo = body.codigo?.toString().trim() || null;

      if (!nombre) {
        return new Response(
          JSON.stringify({ success: false, error: 'El nombre del invitado o familia es requerido.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // CRÍTICO: Validar aislamiento de evento_id
      const updatePayload: Record<string, any> = {
        nombre,
        telefono,
        numero_pases,
        confirmado,
        pases_confirmados,
        codigo,
      };

      let { data, error } = await supabase
        .from('invitados')
        .update(updatePayload)
        .eq('id', recordId)
        .eq('evento_id', eventId)
        .select()
        .single();

      // Fallback si la columna pases_confirmados aún no existe en Supabase (error 42703)
      if (error && error.code === '42703') {
        console.warn('[API Invitados Update] Columna pases_confirmados no existe aún. Actualizando sin la columna.');
        delete updatePayload.pases_confirmados;
        const retryResult = await supabase
          .from('invitados')
          .update(updatePayload)
          .eq('id', recordId)
          .eq('evento_id', eventId)
          .select()
          .single();
        data = retryResult.data;
        error = retryResult.error;
      }

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
