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

  // 2. Extraer y validar cuerpo JSON
  let body: Record<string, any> = {};
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: 'Cuerpo de petición inválido (JSON esperado).' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { action, evento_id, mesa_id, invitado_id } = body;
  const eventId = Number(evento_id);
  const invitadoId = Number(invitado_id);
  const mesaId = Number(mesa_id);

  if (!evento_id || isNaN(eventId) || eventId <= 0) {
    return new Response(
      JSON.stringify({ success: false, error: 'Identificador de evento inválido o faltante.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // =========================================================================
    // ACCIÓN: ASSIGN (Asignar o Cambiar Invitado de Mesa)
    // =========================================================================
    if (action === 'assign') {
      if (!invitado_id || isNaN(invitadoId) || invitadoId <= 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'Identificador de invitado inválido.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (!mesa_id || isNaN(mesaId) || mesaId <= 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'Identificador de mesa destino inválido.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // 1. Obtener invitado y validar que pertenezca al evento
      const { data: invitado, error: invError } = await supabase
        .from('invitados')
        .select('*')
        .eq('id', invitadoId)
        .maybeSingle();

      if (invError || !invitado) {
        return new Response(
          JSON.stringify({ success: false, error: 'El invitado no existe en la base de datos.' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // AISLAMIENTO CRÍTICO POR EVENTO
      if (invitado.evento_id !== eventId) {
        return new Response(
          JSON.stringify({ success: false, error: 'El invitado no pertenece al evento especificado.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // 2. Obtener mesa destino y validar que pertenezca al mismo evento
      const { data: mesa, error: mesaError } = await supabase
        .from('mesas')
        .select('*')
        .eq('id', mesaId)
        .maybeSingle();

      if (mesaError || !mesa) {
        if (mesaError?.code === 'PGRST205') {
          return new Response(
            JSON.stringify({ success: false, error: 'La tabla public.mesas no existe aún en Supabase.' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response(
          JSON.stringify({ success: false, error: 'La mesa destino no existe.' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // AISLAMIENTO CRÍTICO POR EVENTO (mesa vs evento y mesa vs invitado)
      if (mesa.evento_id !== eventId || mesa.evento_id !== invitado.evento_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'El invitado y la mesa deben pertenecer al mismo evento.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // 3. Obtener asignaciones actuales de la mesa para calcular ocupación confirmada
      const { data: asignacionesExistentes, error: asigError } = await supabase
        .from('mesa_invitados')
        .select('id, invitado_id, mesa_id, invitados(*)')
        .eq('mesa_id', mesaId);

      if (asigError && asigError.code === 'PGRST205') {
        return new Response(
          JSON.stringify({ success: false, error: 'La tabla public.mesa_invitados no existe aún en Supabase.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Si el invitado ya está asignado exactamente a esta mesa, es idempotente
      const yaEnEstaMesa = asignacionesExistentes?.some((a) => a.invitado_id === invitadoId);
      if (yaEnEstaMesa) {
        return new Response(
          JSON.stringify({
            success: true,
            message: `El invitado "${invitado.nombre}" ya está asignado a la Mesa ${mesa.numero}.`,
            data: { mesa_id: mesaId, invitado_id: invitadoId },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // 4. Calcular ocupación actual de otros invitados en la mesa destino (excluyendo al que se va a asignar si ya estuviese)
      let ocupacionActualMesa = 0;
      if (asignacionesExistentes) {
        for (const asig of asignacionesExistentes) {
          if (asig.invitado_id !== invitadoId) {
            const inv = asig.invitados as any;
            if (inv && (inv.confirmado === true || inv.confirmado === 'true')) {
              ocupacionActualMesa += Number(inv.pases_confirmados) || 1;
            }
          }
        }
      }

      // 5. Determinar la carga de pases confirmados que aportará el nuevo invitado
      // REGLA: Solo los pases confirmados consumen capacidad física.
      let cargaNuevoInvitado = 0;
      if (invitado.confirmado === true || invitado.confirmado === 'true') {
        cargaNuevoInvitado = Number(invitado.pases_confirmados) || 1;
      }

      // 6. VALIDACIÓN OBLIGATORIA CONTRA SOBRECUPO
      if (ocupacionActualMesa + cargaNuevoInvitado > mesa.capacidad) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `La asignación excede la capacidad de la mesa. La Mesa ${mesa.numero} tiene capacidad de ${mesa.capacidad} personas y actualmente tiene ${ocupacionActualMesa} confirmadas. Asignar a "${invitado.nombre}" (${cargaNuevoInvitado} personas) requeriría ${ocupacionActualMesa + cargaNuevoInvitado} lugares.`,
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // 7. Retirar cualquier asignación previa del invitado (un invitado solo pertenece a una mesa al mismo tiempo)
      await supabase
        .from('mesa_invitados')
        .delete()
        .eq('invitado_id', invitadoId);

      // 8. Crear la nueva asignación
      const { data: nuevaAsignacion, error: insertError } = await supabase
        .from('mesa_invitados')
        .insert({
          mesa_id: mesaId,
          invitado_id: invitadoId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        console.error('[API Mesa-Invitados Insert Error]', insertError.message);
        return new Response(
          JSON.stringify({ success: false, error: 'No se pudo registrar la asignación en la base de datos.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Invitado "${invitado.nombre}" asignado correctamente a la Mesa ${mesa.numero}.`,
          data: nuevaAsignacion,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // =========================================================================
    // ACCIÓN: UNASSIGN (Quitar Invitado de su Mesa)
    // =========================================================================
    if (action === 'unassign') {
      if (!invitado_id || isNaN(invitadoId) || invitadoId <= 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'Identificador de invitado inválido.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Validar que el invitado pertenece al evento
      const { data: invitado, error: invError } = await supabase
        .from('invitados')
        .select('id, evento_id, nombre')
        .eq('id', invitadoId)
        .maybeSingle();

      if (invError || !invitado) {
        return new Response(
          JSON.stringify({ success: false, error: 'El invitado no existe.' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (invitado.evento_id !== eventId) {
        return new Response(
          JSON.stringify({ success: false, error: 'El invitado no pertenece a este evento.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Eliminar asignación únicamente
      const { error: deleteError } = await supabase
        .from('mesa_invitados')
        .delete()
        .eq('invitado_id', invitadoId);

      if (deleteError) {
        console.error('[API Mesa-Invitados Unassign Error]', deleteError.message);
        return new Response(
          JSON.stringify({ success: false, error: 'No se pudo retirar al invitado de la mesa.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `El invitado "${invitado.nombre}" fue retirado de su mesa. Sus datos y pases permanecen intactos.`,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Acción no reconocida. Opciones válidas: assign, unassign.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('[API Mesa-Invitados Exception]', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Error inesperado en el servidor.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
