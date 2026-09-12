import type { APIRoute } from 'astro';
import { supabase } from '@/lib/supabase';
import type { InvitadoItem } from '@/types';

export const POST: APIRoute = async (context) => {
  const { request } = context;

  // 1. Validar que la petición sea JSON
  let body: Record<string, any> = {};
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: 'Petición inválida. Se esperaba un cuerpo en formato JSON.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const codigo = body.codigo?.toString().trim();
  const eventId = Number(body.evento_id);

  // 2. Validar parámetros requeridos de identificación
  if (!codigo) {
    return new Response(
      JSON.stringify({ success: false, error: 'El código de pase o invitación es requerido.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!body.evento_id || isNaN(eventId) || eventId <= 0) {
    return new Response(
      JSON.stringify({ success: false, error: 'Identificador de evento inválido.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 3. Buscar el invitado en la base de datos por su código
  let invitado: InvitadoItem | null = null;
  try {
    const { data, error } = await supabase
      .from('invitados')
      .select('*')
      .eq('codigo', codigo)
      .maybeSingle();

    if (error) {
      console.error('[RSVP Error Query]', error.message, error.code);
      if (error.code === '42501') {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'No se pudo verificar la invitación. Error de permisos en la base de datos (RLS).',
            pgCode: error.code,
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ success: false, error: 'Error al consultar la invitación.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!data) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invitación no encontrada con el código proporcionado.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    invitado = data as InvitadoItem;
  } catch (err) {
    console.error('[RSVP Exception Query]', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Error inesperado al verificar la invitación.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 4. Validar aislamiento estricto por evento (protección contra manipulación de evento_id)
  if (invitado.evento_id !== eventId) {
    return new Response(
      JSON.stringify({ success: false, error: 'El código de pase no corresponde al evento seleccionado.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 5. Validar estado de confirmación
  const rawConfirmado = body.confirmado;
  if (rawConfirmado === undefined || rawConfirmado === null) {
    return new Response(
      JSON.stringify({ success: false, error: 'Debes indicar si asistirás o no al evento.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const isConfirmado = rawConfirmado === true || rawConfirmado === 'true';
  const isDeclined = rawConfirmado === false || rawConfirmado === 'false';

  if (!isConfirmado && !isDeclined) {
    return new Response(
      JSON.stringify({ success: false, error: 'Valor de confirmación no válido.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 6. Validaciones inviolables de pases
  const numeroPasesMax = Math.max(1, Number(invitado.numero_pases) || 1);
  let pasesConfirmadosFinal: number;

  if (isDeclined) {
    // Si no asistirá: pases_confirmados DEBE ser estrictamente 0
    pasesConfirmadosFinal = 0;
  } else {
    // Si asistirá: validar cantidad
    const rawPases = body.pases_confirmados !== undefined ? Number(body.pases_confirmados) : NaN;

    if (isNaN(rawPases)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Debes especificar cuántas personas asistirán.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Regla: pases_confirmados no puede ser negativo
    if (rawPases < 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'La cantidad de pases no puede ser un número negativo.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Regla: confirmado = true con pases = 0 está prohibido
    if (rawPases === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Para confirmar asistencia, la cantidad de personas debe ser de al menos 1.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Regla: nunca permitir más pases que los asignados
    if (rawPases > numeroPasesMax) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `La cantidad de personas solicitada (${rawPases}) supera el máximo permitido de pases asignados (${numeroPasesMax}).`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    pasesConfirmadosFinal = Math.floor(rawPases);
  }

  // 7. Actualización idempotente en la base de datos
  try {
    // Intentar actualizar con pases_confirmados
    let updatePayload: Record<string, any> = {
      confirmado: isConfirmado,
      pases_confirmados: pasesConfirmadosFinal,
    };

    let { data: updatedData, error: updateError } = await supabase
      .from('invitados')
      .update(updatePayload)
      .eq('id', invitado.id)
      .eq('evento_id', eventId)
      .eq('codigo', codigo)
      .select()
      .single();

    // Fallback defensivo si la columna pases_confirmados aún no existe en Supabase (error 42703)
    if (updateError && updateError.code === '42703') {
      console.warn('[RSVP Warning] Columna pases_confirmados no existe aún. Guardando solo confirmado.');
      delete updatePayload.pases_confirmados;
      const retryResult = await supabase
        .from('invitados')
        .update(updatePayload)
        .eq('id', invitado.id)
        .eq('evento_id', eventId)
        .eq('codigo', codigo)
        .select()
        .single();

      updatedData = retryResult.data;
      updateError = retryResult.error;
    }

    if (updateError) {
      console.error('[RSVP Update Error]', updateError.message, updateError.code);
      if (updateError.code === '42501') {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'No se pudo guardar la confirmación. Error de permisos en la base de datos (RLS).',
            pgCode: updateError.code,
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ success: false, error: 'No pudimos guardar tu respuesta. Intenta de nuevo en un momento.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: isConfirmado
          ? `¡Asistencia confirmada! Te esperamos con gusto.`
          : `Gracias por informarnos. Lamentamos que no puedas acompañarnos.`,
        data: {
          id: invitado.id,
          nombre: invitado.nombre,
          confirmado: isConfirmado,
          pases_confirmados: pasesConfirmadosFinal,
          numero_pases: numeroPasesMax,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[RSVP Exception Update]', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Error inesperado al guardar la confirmación.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
