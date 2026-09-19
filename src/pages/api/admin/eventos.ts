import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import {
  evaluarProgresoEvento,
  calcularMetricasProduccion,
  validarRequisitosPublicacion,
} from '@/lib/event-production';
import type { Evento, ClienteItem } from '@/types';

/**
 * GET /api/admin/eventos
 * Lista todos los eventos para el Centro de Producción, enriquecidos con cliente y checklist de producción.
 * Requiere sesión administrativa SSR.
 */
export const GET: APIRoute = async (context) => {
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
      JSON.stringify({
        success: false,
        error: 'Sesión no autorizada. Inicia sesión como administrador de Celebra-Ya.',
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // 2. Consultar eventos, clientes y tablas relacionadas en paralelo
    const [
      { data: eventosData, error: evError },
      { data: clientesData },
      { data: ubicacionesData },
      { data: invitadosData },
      { data: mesasData },
    ] = await Promise.all([
      supabase.from('eventos').select('*').order('fecha_evento', { ascending: true }),
      supabase.from('clientes').select('id, nombre, email, whatsapp, telefono, activo'),
      supabase.from('ubicaciones').select('id, evento_id'),
      supabase.from('invitados').select('id, evento_id, numero_pases, confirmado'),
      supabase.from('mesas').select('id, evento_id'),
    ]);

    if (evError) {
      console.error('[Eventos API GET Error]:', evError);
      return new Response(
        JSON.stringify({ success: false, error: 'Error al consultar eventos en la base de datos.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const eventosRaw: Evento[] = eventosData ?? [];
    const clientes: ClienteItem[] = (clientesData as any[]) ?? [];
    const clientMap = new Map<number, ClienteItem>();
    clientes.forEach((c) => clientMap.set(c.id, c));

    // Mapear conteos de entidades hijas por evento_id
    const ubicacionesMap = new Map<number, number>();
    (ubicacionesData || []).forEach((u: any) => {
      ubicacionesMap.set(u.evento_id, (ubicacionesMap.get(u.evento_id) || 0) + 1);
    });

    const invitadosMap = new Map<number, number>();
    (invitadosData || []).forEach((i: any) => {
      invitadosMap.set(i.evento_id, (invitadosMap.get(i.evento_id) || 0) + 1);
    });

    const mesasMap = new Map<number, number>();
    (mesasData || []).forEach((m: any) => {
      mesasMap.set(m.evento_id, (mesasMap.get(m.evento_id) || 0) + 1);
    });

    // Enriquecer eventos con cliente y evaluación de producción
    const produccionDetalles = [];
    const eventosEnriquecidos = eventosRaw.map((ev) => {
      const cliente = ev.cliente_id ? clientMap.get(ev.cliente_id) || null : null;
      const counts = {
        ubicacionesCount: ubicacionesMap.get(ev.id) || 0,
        invitadosCount: invitadosMap.get(ev.id) || 0,
        mesasCount: mesasMap.get(ev.id) || 0,
      };

      const produccion = evaluarProgresoEvento(ev, counts);
      produccionDetalles.push(produccion);

      return {
        ...ev,
        cliente,
        etapa_produccion: produccion.etapa,
        produccion,
      };
    });

    const metricas = calcularMetricasProduccion(produccionDetalles);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          eventos: eventosEnriquecidos,
          metricas,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[Eventos API GET Exception]:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Error interno del servidor al consultar el Centro de Producción.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

/**
 * POST /api/admin/eventos
 * Crea un nuevo evento en el Centro de Producción de Celebra-Ya.
 * REGLA ESTRICTA: Operado exclusivamente por Administradores de Celebra-Ya.
 * Payload: { nombre, slug, tipo_evento, fecha_evento, hora_evento?, cliente_id }
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
      JSON.stringify({
        success: false,
        error: 'Acceso denegado: Solo el Administrador de Celebra-Ya puede crear eventos.',
      }),
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

  const { nombre, slug, tipo_evento, fecha_evento, hora_evento, cliente_id } = body;

  // 3. Validaciones de negocio
  if (!nombre || typeof nombre !== 'string' || nombre.trim().length < 3) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'El nombre del evento es obligatorio y debe tener al menos 3 caracteres.',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!slug || typeof slug !== 'string' || !slug.trim()) {
    return new Response(
      JSON.stringify({ success: false, error: 'El slug único del evento es obligatorio.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const cleanSlug = slug.trim().toLowerCase();
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  if (!slugRegex.test(cleanSlug)) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'El slug solo puede contener letras minúsculas, números y guiones (ej. boda-sofia-alejandro).',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!fecha_evento || typeof fecha_evento !== 'string') {
    return new Response(
      JSON.stringify({ success: false, error: 'La fecha del evento es obligatoria.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(fecha_evento.trim())) {
    return new Response(
      JSON.stringify({ success: false, error: 'El formato de fecha debe ser AAAA-MM-DD.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const parsedClienteId = cliente_id ? Number(cliente_id) : null;
  if (!parsedClienteId || isNaN(parsedClienteId) || parsedClienteId <= 0) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Debes seleccionar un cliente válido para asignar el evento.',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // 4. Verificar existencia del cliente asignado
    const { data: cliente, error: cliErr } = await supabase
      .from('clientes')
      .select('id, nombre')
      .eq('id', parsedClienteId)
      .maybeSingle();

    if (cliErr || !cliente) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'El cliente seleccionado no existe en el sistema.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 5. Verificar que el slug no esté en uso
    const { data: slugExistente } = await supabase
      .from('eventos')
      .select('id')
      .eq('slug', cleanSlug)
      .maybeSingle();

    if (slugExistente) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Ya existe un evento con el slug "${cleanSlug}". Por favor elige otro.`,
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 6. Insertar nuevo evento en public.eventos en estado borrador ('false')
    const { data: nuevoEvento, error: insertError } = await supabase
      .from('eventos')
      .insert({
        nombre: nombre.trim(),
        slug: cleanSlug,
        tipo_evento: tipo_evento ? String(tipo_evento).trim() : 'Boda',
        fecha_evento: fecha_evento.trim(),
        hora_evento: hora_evento ? String(hora_evento).trim() : null,
        cliente_id: parsedClienteId,
        estado: 'false', // Estado inicial: en preparación / borrador
      })
      .select('*')
      .single();

    if (insertError || !nuevoEvento) {
      console.error('[Eventos API Insert Error]:', insertError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No se pudo crear el evento en la base de datos.',
          details: insertError?.message,
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Evento creado exitosamente en el Centro de Producción.',
        data: nuevoEvento,
        redirectUrl: `/admin/eventos/${nuevoEvento.id}`,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[Eventos API POST Exception]:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Error interno del servidor al crear el evento.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

/**
 * PATCH /api/admin/eventos
 * Conmuta el estado de publicación de un evento (publicar / despublicar).
 * Payload: { id: number, estado?: boolean | string }
 */
export const PATCH: APIRoute = async (context) => {
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
      JSON.stringify({ success: false, error: 'Sesión no autorizada.' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let body: Record<string, any> = {};
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: 'Cuerpo de petición inválido.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const id = Number(body.id);
  if (!body.id || isNaN(id) || id <= 0) {
    return new Response(
      JSON.stringify({ success: false, error: 'ID de evento inválido.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { data: eventoActual, error: getErr } = await supabase
      .from('eventos')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (getErr || !eventoActual) {
      return new Response(
        JSON.stringify({ success: false, error: 'Evento no encontrado.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const currentPublicado =
      eventoActual.estado === true ||
      eventoActual.estado === 'true' ||
      eventoActual.estado === 'publicado';

    const nuevoEstado = body.estado !== undefined ? Boolean(body.estado) : !currentPublicado;
    const nuevoEstadoStr = nuevoEstado ? 'true' : 'false';

    let validacionResultado = null;

    // Si se solicita PUBLICAR el evento, validar requisitos críticos bloqueantes
    if (nuevoEstado) {
      const [
        { count: ubicacionesCount },
        { count: invitadosCount },
        { count: mesasCount },
      ] = await Promise.all([
        supabase.from('ubicaciones').select('id', { count: 'exact', head: true }).eq('evento_id', id),
        supabase.from('invitados').select('id', { count: 'exact', head: true }).eq('evento_id', id),
        supabase.from('mesas').select('id', { count: 'exact', head: true }).eq('evento_id', id),
      ]);

      const validacion = validarRequisitosPublicacion(eventoActual as Evento, {
        ubicacionesCount: ubicacionesCount ?? 0,
        invitadosCount: invitadosCount ?? 0,
        mesasCount: mesasCount ?? 0,
      });

      validacionResultado = validacion;

      if (!validacion.aptoParaPublicar) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'No es posible publicar el evento. Faltan requisitos críticos obligatorios.',
            bloqueantes: validacion.bloqueantes,
            recomendaciones: validacion.recomendaciones,
            validacion,
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    const { data: eventoActualizado, error: updateErr } = await supabase
      .from('eventos')
      .update({
        estado: nuevoEstadoStr,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, estado, nombre, slug')
      .single();

    if (updateErr) {
      console.error('[Eventos API Patch Error]:', updateErr);
      return new Response(
        JSON.stringify({ success: false, error: 'Error al cambiar el estado del evento.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: nuevoEstado
          ? `El evento "${eventoActualizado.nombre}" ha sido PUBLICADO exitosamente.`
          : `El evento "${eventoActualizado.nombre}" ahora está en borrador (despublicado).`,
        data: eventoActualizado,
        validacion: validacionResultado,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[Eventos API PATCH Exception]:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Error interno al actualizar estado del evento.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
