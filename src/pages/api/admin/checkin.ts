import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '@/lib/supabase-server';

// Helper para formatear horas en formato militar/estándar HH:mm
const formatTimeHHMM = (isoString?: string | null) => {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return '';
  }
};

/**
 * GET /api/admin/checkin
 * Modos de consulta:
 * 1. ?codigo=...&evento_id=... -> Consulta individual de un invitado por código de acceso.
 * 2. ?live=true&evento_id=...   -> Métricas en tiempo real, últimos ingresos y pendientes del evento.
 * 3. ?q=...&evento_id=...      -> Búsqueda rápida de invitados por nombre, teléfono o código en el evento.
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
  const isLive = url.searchParams.get('live') === 'true';
  const querySearch = url.searchParams.get('q')?.trim();

  // Si no se proporcionó ninguna acción de consulta válida
  if (!codigo && !isLive && !querySearch) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Debes proporcionar un código de invitación o un término de búsqueda.',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // =========================================================================
    // MODO 1: MÉTRICAS EN TIEMPO REAL Y FEED DE ÚLTIMOS INGRESOS (?live=true)
    // =========================================================================
    if (isLive) {
      const eventId = Number(eventoIdParam);
      if (!eventoIdParam || isNaN(eventId) || eventId <= 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'Identificador de evento inválido o faltante.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Consultar invitados del evento
      const { data: invsData, error: invsErr } = await supabase
        .from('invitados')
        .select('id, evento_id, nombre, telefono, numero_pases, confirmado, codigo, pases_confirmados')
        .eq('evento_id', eventId);

      if (invsErr) {
        console.error('[Live Checkin API Error Invs]:', invsErr);
        return new Response(
          JSON.stringify({ success: false, error: 'Error al consultar invitados del evento.' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const invitados = invsData || [];
      const guestMap = new Map<number, typeof invitados[0]>();
      invitados.forEach((inv) => guestMap.set(inv.id, inv));

      // Consultar checkins del evento
      let checkins: any[] = [];
      try {
        const { data: chkData, error: chkErr } = await supabase
          .from('checkins')
          .select('id, evento_id, invitado_id, cantidad, created_at')
          .eq('evento_id', eventId)
          .order('created_at', { ascending: false });

        if (!chkErr && chkData) {
          checkins = chkData;
        }
      } catch (e) {
        console.error('[Live Checkin API Checkins Error]:', e);
      }

      // Consultar asignación de mesas defensivamente
      const mesaMap = new Map<number, string>();
      try {
        const { data: asignaciones } = await supabase
          .from('mesa_invitados')
          .select('invitado_id, mesas:mesa_id (id, numero)')
          .in('invitado_id', invitados.map((i) => i.id));

        if (asignaciones) {
          asignaciones.forEach((asig: any) => {
            if (asig.mesas && asig.mesas.numero) {
              mesaMap.set(asig.invitado_id, `Mesa ${asig.mesas.numero}`);
            }
          });
        }
      } catch {
        // Ignorar si mesas no están disponibles
      }

      // Mapear checkins acumulados por invitado
      const checkinCountByGuest = new Map<number, number>();
      const lastCheckinTimeByGuest = new Map<number, string>();
      checkins.forEach((c) => {
        const prev = checkinCountByGuest.get(c.invitado_id) || 0;
        checkinCountByGuest.set(c.invitado_id, prev + (Number(c.cantidad) || 0));

        if (!lastCheckinTimeByGuest.has(c.invitado_id)) {
          lastCheckinTimeByGuest.set(c.invitado_id, c.created_at);
        }
      });

      // Cálculo de Métricas (Secciones 5 y 6)
      let confirmados = 0; // SUM(pases_confirmados) para confirmado = true
      let pasesMaximos = 0; // SUM(numero_pases)
      let invitadosConfirmados = 0;
      let invitadosPendientesRsvp = 0;
      let invitadosRechazados = 0;

      invitados.forEach((inv) => {
        pasesMaximos += Number(inv.numero_pases) || 1;
        const isConf = inv.confirmado === true || inv.confirmado === 'true';
        const isRech = inv.confirmado === false || inv.confirmado === 'false';

        if (isConf) {
          invitadosConfirmados++;
          confirmados +=
            inv.pases_confirmados != null
              ? Number(inv.pases_confirmados)
              : Number(inv.numero_pases) || 1;
        } else if (isRech) {
          invitadosRechazados++;
        } else {
          invitadosPendientesRsvp++;
        }
      });

      const ingresados = checkins.reduce((sum, c) => sum + (Number(c.cantidad) || 0), 0);
      const porIngresar = Math.max(0, confirmados - ingresados);
      const asistenciaPorcentaje =
        confirmados > 0
          ? Math.round((ingresados / confirmados) * 1000) / 10
          : 0;

      const distinctGuestsInCheckins = new Set(checkins.map((c) => c.invitado_id));
      const invitadosIngresaron = distinctGuestsInCheckins.size;

      let invitadosPendientesIngreso = 0;
      const pendientesLlegada: any[] = [];

      invitados.forEach((inv) => {
        const isConf = inv.confirmado === true || inv.confirmado === 'true';
        if (isConf) {
          const confPases =
            inv.pases_confirmados != null
              ? Number(inv.pases_confirmados)
              : Number(inv.numero_pases) || 1;
          const usedPases = checkinCountByGuest.get(inv.id) || 0;
          const dispPases = Math.max(0, confPases - usedPases);

          if (dispPases > 0) {
            invitadosPendientesIngreso++;
            pendientesLlegada.push({
              id: inv.id,
              nombre: inv.nombre,
              codigo: inv.codigo,
              pases_confirmados: confPases,
              pases_utilizados: usedPases,
              pases_disponibles: dispPases,
              mesa: mesaMap.get(inv.id) || null,
              estado_checkin: usedPases === 0 ? 'sin_entradas' : 'entrada_parcial',
            });
          }
        }
      });

      // Últimos 15 ingresos detallados
      const ultimosIngresos = checkins.slice(0, 15).map((c) => {
        const g = guestMap.get(c.invitado_id);
        return {
          id: c.id,
          evento_id: c.evento_id,
          invitado_id: c.invitado_id,
          invitado_nombre: g?.nombre || 'Invitado',
          cantidad: Number(c.cantidad) || 1,
          created_at: c.created_at,
          hora: formatTimeHHMM(c.created_at),
          mesa: mesaMap.get(c.invitado_id) || null,
        };
      });

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            metricas: {
              confirmados,
              ingresados,
              por_ingresar: porIngresar,
              asistencia_porcentaje: asistenciaPorcentaje,
              pases_maximos: pasesMaximos,
              invitados_confirmados: invitadosConfirmados,
              invitados_pendientes_rsvp: invitadosPendientesRsvp,
              invitados_rechazados: invitadosRechazados,
              invitados_ingresaron: invitadosIngresaron,
              invitados_pendientes_ingreso: invitadosPendientesIngreso,
              pases_utilizados: ingresados,
              pases_disponibles: porIngresar,
            },
            ultimos_ingresos: ultimosIngresos,
            pendientes_llegada: pendientesLlegada.slice(0, 25),
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // =========================================================================
    // MODO 2: BÚSQUEDA RÁPIDA POR TEXTO (?q=...&evento_id=...)
    // =========================================================================
    if (querySearch) {
      const eventId = Number(eventoIdParam);
      if (!eventoIdParam || isNaN(eventId) || eventId <= 0) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Identificador de evento requerido para realizar la búsqueda.',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Buscar por nombre, teléfono o código en el evento específico
      const { data: matchInvs, error: searchErr } = await supabase
        .from('invitados')
        .select('id, evento_id, nombre, telefono, numero_pases, confirmado, codigo, pases_confirmados')
        .eq('evento_id', eventId)
        .or(`nombre.ilike.%${querySearch}%,telefono.ilike.%${querySearch}%,codigo.ilike.%${querySearch}%`)
        .limit(10);

      if (searchErr) {
        console.error('[Search Checkin API Error]:', searchErr);
        return new Response(
          JSON.stringify({ success: false, error: 'Error al buscar invitados.' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const matches = matchInvs || [];
      const matchIds = matches.map((m) => m.id);

      // Consultar checkins de los invitados encontrados
      let checkinsMatches: any[] = [];
      if (matchIds.length > 0) {
        try {
          const { data: chks } = await supabase
            .from('checkins')
            .select('invitado_id, cantidad, created_at')
            .in('invitado_id', matchIds)
            .order('created_at', { ascending: false });
          checkinsMatches = chks || [];
        } catch {}
      }

      // Consultar mesas de los invitados encontrados
      const mesaMap = new Map<number, string>();
      if (matchIds.length > 0) {
        try {
          const { data: asigs } = await supabase
            .from('mesa_invitados')
            .select('invitado_id, mesas:mesa_id (id, numero)')
            .in('invitado_id', matchIds);
          (asigs || []).forEach((asig: any) => {
            if (asig.mesas && asig.mesas.numero) {
              mesaMap.set(asig.invitado_id, `Mesa ${asig.mesas.numero}`);
            }
          });
        } catch {}
      }

      const results = matches.map((inv) => {
        const invCheckins = checkinsMatches.filter((c) => c.invitado_id === inv.id);
        const usedPases = invCheckins.reduce((s, c) => s + (Number(c.cantidad) || 0), 0);
        const isConf = inv.confirmado === true || inv.confirmado === 'true';
        const isRech = inv.confirmado === false || inv.confirmado === 'false';

        let pasesConf = 0;
        let pasesDisp = 0;
        let estadoCheckin: 'rsvp_pendiente' | 'rechazado' | 'sin_entradas' | 'entrada_parcial' | 'entrada_completa' = 'rsvp_pendiente';

        if (isConf) {
          pasesConf =
            inv.pases_confirmados != null
              ? Number(inv.pases_confirmados)
              : Number(inv.numero_pases) || 1;
          pasesDisp = Math.max(0, pasesConf - usedPases);

          if (usedPases === 0) {
            estadoCheckin = 'sin_entradas';
          } else if (pasesDisp <= 0) {
            estadoCheckin = 'entrada_completa';
          } else {
            estadoCheckin = 'entrada_parcial';
          }
        } else if (isRech) {
          pasesConf = 0;
          pasesDisp = 0;
          estadoCheckin = 'rechazado';
        } else {
          pasesConf = 0;
          pasesDisp = 0;
          estadoCheckin = 'rsvp_pendiente';
        }

        const latestCheckin = invCheckins[0];

        return {
          id: inv.id,
          evento_id: inv.evento_id,
          nombre: inv.nombre,
          telefono: inv.telefono,
          codigo: inv.codigo,
          confirmado: inv.confirmado,
          numero_pases: Number(inv.numero_pases) || 1,
          pases_confirmados: pasesConf,
          pases_utilizados: usedPases,
          pases_disponibles: pasesDisp,
          estado_checkin: estadoCheckin,
          ultimo_ingreso: latestCheckin ? formatTimeHHMM(latestCheckin.created_at) : null,
          mesa: mesaMap.get(inv.id) || null,
        };
      });

      return new Response(
        JSON.stringify({ success: true, data: results }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // =========================================================================
    // MODO 3: CONSULTA INDIVIDUAL POR CÓDIGO (?codigo=...&evento_id=...)
    // =========================================================================
    const { data: invData, error: invError } = await supabase
      .from('invitados')
      .select('id, evento_id, nombre, telefono, numero_pases, confirmado, codigo, pases_confirmados, created_at')
      .ilike('codigo', codigo!)
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

    // Validar aislamiento multi-tenant por evento si se pasó evento_id
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

    // Obtener información del evento
    const { data: eventoData } = await supabase
      .from('eventos')
      .select('id, nombre, slug, tipo_evento, fecha_evento')
      .eq('id', invData.evento_id)
      .maybeSingle();

    // Consultar mesa asignada
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
      mesaInfo = null;
    }

    // Consultar historial de checkins previos del invitado
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
      pasesUtilizados = 0;
    }

    // Calcular métricas de capacidad y estado
    const isConfirmado = invData.confirmado === true || invData.confirmado === 'true';
    const isRechazado = invData.confirmado === false || invData.confirmado === 'false';

    let pasesConfirmados = 0;
    let pasesDisponibles = 0;
    let estadoCheckin: 'rsvp_pendiente' | 'rechazado' | 'sin_entradas' | 'entrada_parcial' | 'entrada_completa' = 'rsvp_pendiente';

    if (isConfirmado) {
      pasesConfirmados =
        invData.pases_confirmados != null
          ? Number(invData.pases_confirmados)
          : Number(invData.numero_pases) || 1;
      pasesDisponibles = Math.max(0, pasesConfirmados - pasesUtilizados);

      if (pasesUtilizados === 0) {
        estadoCheckin = 'sin_entradas';
      } else if (pasesDisponibles <= 0) {
        estadoCheckin = 'entrada_completa';
      } else {
        estadoCheckin = 'entrada_parcial';
      }
    } else if (isRechazado) {
      pasesConfirmados = 0;
      pasesDisponibles = 0;
      estadoCheckin = 'rechazado';
    } else {
      pasesConfirmados = 0;
      pasesDisponibles = 0;
      estadoCheckin = 'rsvp_pendiente';
    }

    const ultimoIngreso = checkinsHistorial[0] ? formatTimeHHMM(checkinsHistorial[0].created_at) : null;

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
          estado_checkin: estadoCheckin,
          ultimo_ingreso: ultimoIngreso,
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
        error: 'Error interno al consultar la información. Por favor intenta nuevamente.',
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
  if (
    rawCantidad === undefined ||
    rawCantidad === null ||
    isNaN(cantidad) ||
    !Number.isInteger(cantidad) ||
    cantidad <= 0
  ) {
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
        const resObj = typeof rpcResult === 'string' ? JSON.parse(rpcResult) : rpcResult;
        if (!resObj.success) {
          return new Response(
            JSON.stringify({ success: false, error: resObj.error }),
            { status: resObj.status || 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        const outData = resObj.data || {};
        const isComplete = (outData.pases_disponibles || 0) <= 0;

        return new Response(
          JSON.stringify({
            success: true,
            message: resObj.message || 'Entrada registrada correctamente.',
            data: {
              ...outData,
              hora: formatTimeHHMM(new Date().toISOString()),
              estado_checkin: isComplete ? 'entrada_completa' : 'entrada_parcial',
            },
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

    // 6.2 Aislamiento por evento: el servidor valida contra el evento_id real de la BD
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
            error:
              'La tabla public.checkins no ha sido creada aún en Supabase. Ejecuta el script de la Fase 18 en el SQL Editor.',
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
    const isComplete = nuevoTotalDisponibles <= 0;

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
          hora: formatTimeHHMM(nuevoCheckin.created_at),
          estado_checkin: isComplete ? 'entrada_completa' : 'entrada_parcial',
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
