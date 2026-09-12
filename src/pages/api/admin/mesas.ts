import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const POST: APIRoute = async (context) => {
  const { request, cookies } = context;

  // 1. Validar autenticación administrativa SSR
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

  // 2. Parsear cuerpo de la petición
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
      JSON.stringify({ success: false, error: 'Identificador de evento inválido o faltante.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // =========================================================================
    // ACCIÓN: CREATE (Crear Mesa)
    // =========================================================================
    if (action === 'create') {
      const numero = parseInt(body.numero, 10);
      const capacidad = parseInt(body.capacidad, 10);

      if (isNaN(numero) || numero <= 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'El número de mesa debe ser un entero positivo mayor a 0.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (isNaN(capacidad) || capacidad <= 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'La capacidad de la mesa debe ser mayor a 0 personas.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Validar unicidad de número de mesa dentro del mismo evento
      const { data: existingMesa, error: checkError } = await supabase
        .from('mesas')
        .select('id')
        .eq('evento_id', eventId)
        .eq('numero', numero)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        // Si la tabla no existe en Supabase todavía (PGRST205)
        if (checkError.code === 'PGRST205') {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'La tabla public.mesas no ha sido creada aún en Supabase. Aplica la migración SQL de la Fase 17.',
              pgCode: checkError.code,
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }

      if (existingMesa) {
        return new Response(
          JSON.stringify({ success: false, error: `Ya existe la Mesa ${numero} registrada en este evento.` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const { data: newMesa, error: insertError } = await supabase
        .from('mesas')
        .insert({
          evento_id: eventId,
          numero,
          capacidad,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        console.error('[API Mesas Create Error]', insertError.message, insertError.code);
        return new Response(
          JSON.stringify({
            success: false,
            error: insertError.code === '42501'
              ? 'Permiso denegado por políticas RLS en public.mesas.'
              : insertError.code === 'PGRST205'
              ? 'La tabla public.mesas no existe aún en Supabase.'
              : insertError.message || 'No se pudo crear la mesa.',
            pgCode: insertError.code,
          }),
          { status: insertError.code === '42501' ? 403 : 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: `Mesa ${numero} creada exitosamente.`, data: newMesa }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // =========================================================================
    // ACCIÓN: UPDATE (Editar Mesa)
    // =========================================================================
    if (action === 'update') {
      const mesaId = Number(id);
      if (!id || isNaN(mesaId) || mesaId <= 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'Identificador de mesa inválido.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const numero = parseInt(body.numero, 10);
      const capacidad = parseInt(body.capacidad, 10);

      if (isNaN(numero) || numero <= 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'El número de mesa debe ser un entero positivo mayor a 0.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (isNaN(capacidad) || capacidad <= 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'La capacidad de la mesa debe ser mayor a 0 personas.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Validar existencia y aislamiento por evento_id
      const { data: currentMesa, error: findError } = await supabase
        .from('mesas')
        .select('*')
        .eq('id', mesaId)
        .eq('evento_id', eventId)
        .maybeSingle();

      if (findError || !currentMesa) {
        return new Response(
          JSON.stringify({ success: false, error: 'La mesa no existe o no pertenece al evento especificado.' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Validar si el número ya lo usa otra mesa del mismo evento
      const { data: duplicateMesa } = await supabase
        .from('mesas')
        .select('id')
        .eq('evento_id', eventId)
        .eq('numero', numero)
        .neq('id', mesaId)
        .maybeSingle();

      if (duplicateMesa) {
        return new Response(
          JSON.stringify({ success: false, error: `Ya existe otra mesa con el número ${numero} en este evento.` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Validar si la nueva capacidad no queda por debajo de las personas confirmadas ya asignadas
      try {
        const { data: asignaciones } = await supabase
          .from('mesa_invitados')
          .select('invitado_id, invitados(id, confirmado, pases_confirmados, numero_pases)')
          .eq('mesa_id', mesaId);

        if (asignaciones && asignaciones.length > 0) {
          const ocupacionConfirmada = asignaciones.reduce((sum: number, asig: any) => {
            const inv = asig.invitados;
            if (inv && (inv.confirmado === true || inv.confirmado === 'true')) {
              return sum + (Number(inv.pases_confirmados) || 1);
            }
            return sum;
          }, 0);

          if (capacidad < ocupacionConfirmada) {
            return new Response(
              JSON.stringify({
                success: false,
                error: `No puedes reducir la capacidad a ${capacidad} personas porque la mesa tiene actualmente ${ocupacionConfirmada} personas confirmadas asignadas.`,
              }),
              { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
          }
        }
      } catch (e) {
        // En caso de que tabla mesa_invitados aún no exista
      }

      const { data: updatedMesa, error: updateError } = await supabase
        .from('mesas')
        .update({
          numero,
          capacidad,
          updated_at: new Date().toISOString(),
        })
        .eq('id', mesaId)
        .eq('evento_id', eventId)
        .select()
        .single();

      if (updateError) {
        console.error('[API Mesas Update Error]', updateError.message);
        return new Response(
          JSON.stringify({ success: false, error: 'No se pudo actualizar la mesa.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: `Mesa ${numero} actualizada correctamente.`, data: updatedMesa }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // =========================================================================
    // ACCIÓN: DELETE (Eliminar Mesa)
    // =========================================================================
    if (action === 'delete') {
      const mesaId = Number(id);
      if (!id || isNaN(mesaId) || mesaId <= 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'Identificador de mesa inválido.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Validar aislamiento de evento_id
      const { data: mesaToDelete, error: findError } = await supabase
        .from('mesas')
        .select('id, numero')
        .eq('id', mesaId)
        .eq('evento_id', eventId)
        .maybeSingle();

      if (findError || !mesaToDelete) {
        return new Response(
          JSON.stringify({ success: false, error: 'La mesa no existe o no pertenece a este evento.' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Desasignar invitados asociados defensivamente antes de borrar la mesa
      try {
        await supabase
          .from('mesa_invitados')
          .delete()
          .eq('mesa_id', mesaId);
      } catch (e) {
        // Silencioso si la tabla no existe o ya no tiene registros
      }

      // Eliminar la mesa
      const { error: deleteError } = await supabase
        .from('mesas')
        .delete()
        .eq('id', mesaId)
        .eq('evento_id', eventId);

      if (deleteError) {
        console.error('[API Mesas Delete Error]', deleteError.message);
        return new Response(
          JSON.stringify({ success: false, error: 'No se pudo eliminar la mesa.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: `Mesa ${mesaToDelete.numero} eliminada correctamente. Los invitados han quedado sin mesa asignada.` }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Acción no reconocida. Opciones válidas: create, update, delete.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('[API Mesas Exception]', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Error inesperado en el servidor.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
