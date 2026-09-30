import type { APIRoute } from 'astro';
import { supabase } from '@/lib/supabase';

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

  // 3. Validar estado de confirmación
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

  // 4. Validaciones de forma de los pases (el máximo asignado lo valida la BD en responder_rsvp)
  let pasesConfirmadosFinal = 0;

  if (isConfirmado) {
    const rawPases = body.pases_confirmados !== undefined ? Number(body.pases_confirmados) : NaN;

    if (isNaN(rawPases)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Debes especificar cuántas personas asistirán.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!Number.isInteger(rawPases) || rawPases < 1) {
      return new Response(
        JSON.stringify({ success: false, error: 'Para confirmar asistencia, la cantidad de personas debe ser un número entero de al menos 1.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    pasesConfirmadosFinal = rawPases;
  }

  // 5. Guardar vía RPC: el rol anon no tiene acceso directo a public.invitados.
  //    La función solo actualiza confirmado/pases_confirmados del invitado cuyo
  //    código Y evento coinciden, dentro de un evento publicado.
  try {
    const { data: rpcResult, error: rpcError } = await supabase.rpc('responder_rsvp', {
      p_codigo: codigo,
      p_evento_id: eventId,
      p_confirmado: isConfirmado,
      p_pases: pasesConfirmadosFinal,
    });

    if (rpcError || !rpcResult) {
      console.error('[RSVP RPC Error]', rpcError?.message, rpcError?.code);
      return new Response(
        JSON.stringify({ success: false, error: 'No pudimos guardar tu respuesta. Intenta de nuevo en un momento.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const resObj = typeof rpcResult === 'string' ? JSON.parse(rpcResult) : rpcResult;

    if (!resObj.success) {
      return new Response(
        JSON.stringify({ success: false, error: resObj.error }),
        { status: resObj.status || 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: isConfirmado
          ? `¡Asistencia confirmada! Te esperamos con gusto.`
          : `Gracias por informarnos. Lamentamos que no puedas acompañarnos.`,
        data: resObj.data,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[RSVP Exception]', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Error inesperado al guardar la confirmación.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
