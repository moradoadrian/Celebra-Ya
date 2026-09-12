import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '@/lib/supabase-server';

/**
 * GET /api/admin/checkin?codigo=...&evento_id=...
 * Consulta segura de una invitación por código único para el control de acceso.
 */
export const GET: APIRoute = async (context) => {
  const { request, cookies, url } = context;

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

  // 2. Extraer parámetros
  const codigo = url.searchParams.get('codigo')?.trim();
  const eventoIdParam = url.searchParams.get('evento_id');

  if (!codigo) {
    return new Response(
      JSON.stringify({ success: false, error: 'Debes proporcionar un código de invitación.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // 3. Buscar al invitado por código (búsqueda insensible a mayúsculas/minúsculas)
    const { data: invData, error: invError } = await supabase
      .from('invitados')
      .select('id, evento_id, nombre, telefono, numero_pases, confirmado, codigo, pases_confirmados, created_at')
      .ilike('codigo', codigo)
      .maybeSingle();

    if (invError || !invData) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invitación no encontrada. El código proporcionado no corresponde a una invitación válida.',
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. Validar aislamiento multi-tenant por evento si se pasó evento_id
    if (eventoIdParam) {
      const parsedEventoId = Number(eventoIdParam);
      if (!isNaN(parsedEventoId) && parsedEventoId > 0 && invData.evento_id !== parsedEventoId) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'El invitado no pertenece al evento especificado.',
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // 5. Obtener información del evento al que pertenece realmente el invitado
    const { data: eventoData } = await supabase
      .from('eventos')
      .select('id, nombre, slug, tipo_evento, fecha_evento')
      .eq('id', invData.evento_id)
      .maybeSingle();

    // 6. Consultar mesa asignada (si las tablas de mesas están creadas)
    let mesaInfo: string | null = null;
    try {
      const { data: asignacion } = await supabase
        .from('mesa_invitados')
        .select('mesa_id, mesas:mesa_id (id, numero)')
        .eq('invitado_id', invData.id)
        .maybeSingle();

      if (asignacion && asignacion.mesas) {
        const mesa = asignacion.mesas as any;
        mesaInfo = `Mesa ${mesa.numero}`;
      }
    } catch {
      // Si la tabla mesas no existe aún en la base de datos, ignorar silenciosamente
      mesaInfo = null;
    }

    // 7. Consultar historial de checkins previos del invitado
    let checkinsHistorial: any[] = [];
    let pasesUtilizados = 0;

    try {
      const { data: checkinsData, error: chkError } = await supabase
        .from('checkins')
        .select('id, evento_id, invitado_id, cantidad, created_at')
        .eq('invitado_id', invData.id)
        .order('created_at', { ascending: false });

      if (!chkError && checkinsData) {
        checkinsHistorial = checkinsData;
        pasesUtilizados = checkinsData.reduce((sum, item) => sum + (Number(item.cantidad) || 0), 0);
      }
    } catch {
      // Si la tabla checkins no existe aún, pasesUtilizados se mantiene en 0
      pasesUtilizados = 0;
    }

    // 8. Calcular métricas de capacidad
    const isConfirmado = invData.confirmado === true || invData.confirmado === 'true';
    const isRechazado = invData.confirmado === false || invData.confirmado === 'false';

    let pasesConfirmados = 0;
    let pasesDisponibles = 0;

    if (isConfirmado) {
      pasesConfirmados =
        invData.pases_confirmados != null
          ? Number(invData.pases_confirmados)
          : Number(invData.numero_pases) || 1;
      pasesDisponibles = Math.max(0, pasesConfirmados - pasesUtilizados);
    } else if (isRechazado) {
      pasesConfirmados = 0;
      pasesDisponibles = 0;
    } else {
      // RSVP pendiente
      pasesConfirmados = 0;
      pasesDisponibles = 0;
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          id: invData.id,
          evento_id: invData.evento_id,
          evento_nombre: eventoData?.nombre || `Evento #${invData.evento_id}`,
          evento_slug: eventoData?.slug || '',
          nombre: invData.nombre,
          telefono: invData.telefono,
          codigo: invData.codigo,
          confirmado: invData.confirmado,
          numero_pases: Number(invData.numero_pases) || 1,
          pases_confirmados: pasesConfirmados,
          pases_utilizados: pasesUtilizados,
          pases_disponibles: pasesDisponibles,
          mesa: mesaInfo,
          historial: checkinsHistorial,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[Checkin API GET Error]:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Error interno al consultar la invitación. Por favor intenta nuevamente.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

/**
 * POST /api/admin/checkin
 * Registra el acceso (check-in) físico de personas para una invitación.
 * Payload: { codigo: string, cantidad: number, evento_id?: number }
 */
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

  const { codigo, evento_id } = body;
  const rawCantidad = body.cantidad;

  // 3. Validar cantidad de personas a registrar
  const cantidad = Number(rawCantidad);
  if (rawCantidad === undefined || rawCantidad === null || isNaN(cantidad) || !Number.isInteger(cantidad) || cantidad <= 0) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'La cantidad de personas debe ser un número entero mayor a 0.',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 4. Validar código proporcionado
  if (!codigo || typeof codigo !== 'string' || !codigo.trim()) {
    return new Response(
      JSON.stringify({ success: false, error: 'El código de invitación es requerido.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const cleanCodigo = codigo.trim();

  try {
    // 5. Intento 1: Llamada a función RPC atómica de PostgreSQL si existe (con bloqueo FOR UPDATE)
    try {
      const { data: rpcResult, error: rpcError } = await supabase.rpc('registrar_checkin', {
        p_codigo: cleanCodigo,
        p_cantidad: cantidad,
        p_evento_id: evento_id ? Number(evento_id) : null,
      });

      if (!rpcError && rpcResult) {
        // La función RPC procesó y evaluó todas las reglas atómicamente
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
            message: resObj.message || 'Entrada registrada correctamente.',
            data: resObj.data,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } catch {
      // Continuar al flujo SSR directo si el RPC no está disponible aún
    }

    // 6. Flujo directo en Servidor SSR con validaciones estrictas
    // 6.1 Buscar al invitado
    const { data: invitado, error: invErr } = await supabase
      .from('invitados')
      .select('id, evento_id, nombre, numero_pases, confirmado, codigo, pases_confirmados')
      .ilike('codigo', cleanCodigo)
      .maybeSingle();

    if (invErr || !invitado) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invitación no encontrada. El código proporcionado no corresponde a una invitación válida.',
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 6.2 Aislamiento por evento: el servidor obtiene el evento_id real de la BD
    if (evento_id) {
      const reqEventoId = Number(evento_id);
      if (!isNaN(reqEventoId) && reqEventoId > 0 && invitado.evento_id !== reqEventoId) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'El invitado no pertenece al evento especificado.',
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // 6.3 Validar estado de RSVP
    if (invitado.confirmado === null || invitado.confirmado === undefined) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'RSVP pendiente: Este invitado todavía no ha confirmado su asistencia.',
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const isConfirmado = invitado.confirmado === true || invitado.confirmado === 'true';
    if (!isConfirmado) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invitación rechazada: El invitado indicó que no asistirá.',
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 6.4 Validar pases confirmados
    const pasesConfirmados =
      invitado.pases_confirmados != null
        ? Number(invitado.pases_confirmados)
        : Number(invitado.numero_pases) || 1;

    if (pasesConfirmados <= 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'El invitado no cuenta con pases confirmados.',
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 6.5 Consultar pases utilizados en public.checkins
    const { data: checkinsExistentes, error: chkErr } = await supabase
      .from('checkins')
      .select('cantidad')
      .eq('invitado_id', invitado.id);

    if (chkErr) {
      if (chkErr.code === 'PGRST205' || chkErr.message?.includes('checkins')) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'La tabla public.checkins no ha sido creada aún en Supabase. Ejecuta el script de la Fase 18 en el SQL Editor.',
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ success: false, error: 'Error al consultar historial de checkins.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const pasesUtilizados = (checkinsExistentes || []).reduce(
      (sum, item) => sum + (Number(item.cantidad) || 0),
      0
    );
    const pasesDisponibles = pasesConfirmados - pasesUtilizados;

    // 6.6 Validar si la entrada ya está completa
    if (pasesDisponibles <= 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Entrada completa: Todos los pases confirmados ya fueron utilizados.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 6.7 Validar regla fundamental de capacidad: no superar pases confirmados
    if (cantidad > pasesDisponibles) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `No es posible registrar ${cantidad} personas. Solo quedan ${pasesDisponibles} ${
            pasesDisponibles === 1 ? 'pase disponible' : 'pases disponibles'
          }.`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 6.8 Insertar registro de acceso en public.checkins
    const { data: nuevoCheckin, error: insertErr } = await supabase
      .from('checkins')
      .insert({
        evento_id: invitado.evento_id,
        invitado_id: invitado.id,
        cantidad,
      })
      .select('id, evento_id, invitado_id, cantidad, created_at')
      .single();

    if (insertErr || !nuevoCheckin) {
      console.error('[Checkin Insert Error]:', insertErr);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No pudimos registrar la entrada. Intenta nuevamente.',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const nuevoTotalUtilizados = pasesUtilizados + cantidad;
    const nuevoTotalDisponibles = pasesConfirmados - nuevoTotalUtilizados;

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Entrada registrada correctamente.',
        data: {
          checkin_id: nuevoCheckin.id,
          invitado_id: invitado.id,
          nombre: invitado.nombre,
          evento_id: invitado.evento_id,
          cantidad,
          pases_confirmados: pasesConfirmados,
          pases_utilizados: nuevoTotalUtilizados,
          pases_disponibles: nuevoTotalDisponibles,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[Checkin API POST Error]:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Error interno en el servidor. Por favor intenta nuevamente.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
