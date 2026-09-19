import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import type { ClienteItem, ClienteMetricas } from '@/types';

// Validador de formato de correo electrónico
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * GET /api/admin/clientes
 * Lista todos los clientes, métricas globales y eventos asociados a cada cliente.
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
        error: 'Sesión no autorizada. Inicia sesión como administrador.',
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // 2. Consultar clientes registrados
    const { data: clientesRaw, error: clientesErr } = await supabase
      .from('clientes')
      .select('*')
      .order('id', { ascending: true });

    let clientes: any[] = clientesRaw ?? [];

    // Manejo defensivo si la tabla aún no se ha sincronizado o no tiene registros
    if (clientesErr) {
      console.warn('[Clientes API GET Warning]:', clientesErr.message);
      if (clientesErr.code === '42501' || clientesErr.code === 'PGRST205') {
        clientes = [];
      } else {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Error al consultar clientes en la base de datos.',
            details: clientesErr.message,
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // 3. Consultar eventos para calcular asignaciones y métricas
    const { data: eventosRaw } = await supabase
      .from('eventos')
      .select('id, cliente_id, nombre, slug, tipo_evento, fecha_evento, estado')
      .order('id', { ascending: true });

    const eventos = eventosRaw ?? [];

    // Mapear eventos por cliente_id
    const eventosPorCliente = new Map<number, typeof eventos>();
    let totalEventosAsociados = 0;

    eventos.forEach((ev) => {
      if (ev.cliente_id) {
        totalEventosAsociados++;
        const currentList = eventosPorCliente.get(ev.cliente_id) || [];
        currentList.push(ev);
        eventosPorCliente.set(ev.cliente_id, currentList);
      }
    });

    // 4. Enriquecer clientes con métricas de eventos
    const clientesEnriquecidos: ClienteItem[] = clientes.map((c) => {
      const evs = eventosPorCliente.get(c.id) || [];
      const isActivo = c.activo !== false && c.activo !== 'false';
      return {
        id: c.id,
        nombre: c.nombre,
        email: c.email,
        whatsapp: c.whatsapp || null,
        telefono: c.telefono || c.whatsapp || null,
        activo: isActivo,
        created_at: c.created_at,
        updated_at: c.updated_at,
        total_eventos: evs.length,
        eventos: evs.map((e) => ({
          id: e.id,
          nombre: e.nombre,
          slug: e.slug,
          tipo_evento: e.tipo_evento,
          fecha_evento: e.fecha_evento,
          estado: e.estado,
        })),
      };
    });

    // 5. Métricas globales de clientes
    const totalClientes = clientesEnriquecidos.length;
    const clientesActivos = clientesEnriquecidos.filter((c) => c.activo).length;
    const clientesInactivos = totalClientes - clientesActivos;

    const metricas: ClienteMetricas = {
      total: totalClientes,
      activos: clientesActivos,
      inactivos: clientesInactivos,
      eventos_asociados: totalEventosAsociados,
    };

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          clientes: clientesEnriquecidos,
          metricas,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[Clientes API GET Error]:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Error interno en el servidor al consultar clientes.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

/**
 * POST /api/admin/clientes
 * Crea un nuevo cliente en el sistema.
 * REGLA ESTRICTA: Exclusivo para administradores de Celebra-Ya (sin registro público).
 * Payload: { nombre, email, whatsapp?, telefono?, activo? }
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
        error: 'Acceso denegado: Solo el Administrador de Celebra-Ya puede dar de alta clientes.',
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

  const { nombre, email, whatsapp, telefono, activo } = body;

  // 3. Validar nombre
  if (!nombre || typeof nombre !== 'string' || nombre.trim().length < 2) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'El nombre del cliente es obligatorio y debe tener al menos 2 caracteres.',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 4. Validar email
  if (!email || typeof email !== 'string' || !isValidEmail(email.trim())) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Debes proporcionar un correo electrónico válido (ejemplo@dominio.com).',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const cleanNombre = nombre.trim();
  const cleanEmail = email.trim().toLowerCase();
  const cleanWhatsapp = whatsapp ? String(whatsapp).trim() : null;
  const cleanTelefono = telefono ? String(telefono).trim() : cleanWhatsapp;
  const isActivo = activo === undefined || activo === null ? true : Boolean(activo);

  try {
    // 5. Verificar unicidad de correo electrónico
    const { data: existingClient, error: checkError } = await supabase
      .from('clientes')
      .select('id, email')
      .ilike('email', cleanEmail)
      .maybeSingle();

    if (!checkError && existingClient) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Ya existe un cliente registrado con ese correo electrónico.',
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 6. Insertar cliente en public.clientes
    const insertPayload: Record<string, any> = {
      nombre: cleanNombre,
      email: cleanEmail,
      whatsapp: cleanWhatsapp,
      telefono: cleanTelefono,
      activo: isActivo,
    };

    const { data: nuevoCliente, error: insertError } = await supabase
      .from('clientes')
      .insert(insertPayload)
      .select('*')
      .single();

    if (insertError) {
      console.error('[Clientes API POST Insert Error]:', insertError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No se pudo registrar el cliente en la base de datos.',
          details: insertError.message,
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Cliente registrado exitosamente.',
        data: nuevoCliente,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[Clientes API POST Error]:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Error interno en el servidor al registrar el cliente.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

/**
 * PUT /api/admin/clientes
 * Edita un cliente existente o modifica su estado lógico (activo/inactivo).
 * REGLA ESTRICTA: El estado del cliente es un toggle lógico (activo/inactivo). No se permite borrado físico.
 * Payload: { id, action?: 'update' | 'toggle_status', nombre?, email?, whatsapp?, telefono?, activo? }
 */
export const PUT: APIRoute = async (context) => {
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
        error: 'Sesión no autorizada. Inicia sesión como administrador.',
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

  const id = Number(body.id);
  if (!body.id || isNaN(id) || id <= 0) {
    return new Response(
      JSON.stringify({ success: false, error: 'Identificador de cliente inválido o faltante.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const action = body.action || 'update';

  try {
    // 3. Consultar cliente actual
    const { data: clienteActual, error: getError } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (getError || !clienteActual) {
      return new Response(
        JSON.stringify({ success: false, error: 'Cliente no encontrado.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // =========================================================================
    // ACCIÓN 1: TOGGLE LÓGICO DE ESTADO (ACTIVO / INACTIVO)
    // =========================================================================
    if (action === 'toggle_status') {
      const currentStatus = clienteActual.activo !== false && clienteActual.activo !== 'false';
      const newStatus = !currentStatus;

      const { data: clienteActualizado, error: updateError } = await supabase
        .from('clientes')
        .update({
          activo: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('*')
        .single();

      if (updateError) {
        console.error('[Clientes API Toggle Error]:', updateError);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Error al cambiar el estado del cliente.',
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Cliente ${newStatus ? 'activado' : 'desactivado'} correctamente.`,
          data: clienteActualizado,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // =========================================================================
    // ACCIÓN 2: ACTUALIZACIÓN DE DATOS DEL CLIENTE
    // =========================================================================
    const { nombre, email, whatsapp, telefono, activo } = body;

    const updateFields: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (nombre !== undefined) {
      if (typeof nombre !== 'string' || nombre.trim().length < 2) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'El nombre debe tener al menos 2 caracteres.',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      updateFields.nombre = nombre.trim();
    }

    if (email !== undefined) {
      if (typeof email !== 'string' || !isValidEmail(email.trim())) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'El correo electrónico proporcionado no es válido.',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      const cleanEmail = email.trim().toLowerCase();

      // Verificar si otro cliente ya tiene este correo
      const { data: emailConflict } = await supabase
        .from('clientes')
        .select('id')
        .ilike('email', cleanEmail)
        .neq('id', id)
        .maybeSingle();

      if (emailConflict) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'El correo electrónico ingresado ya está asignado a otro cliente.',
          }),
          { status: 409, headers: { 'Content-Type': 'application/json' } }
        );
      }

      updateFields.email = cleanEmail;
    }

    if (whatsapp !== undefined) {
      updateFields.whatsapp = whatsapp ? String(whatsapp).trim() : null;
    }

    if (telefono !== undefined) {
      updateFields.telefono = telefono ? String(telefono).trim() : null;
    }

    if (activo !== undefined) {
      updateFields.activo = Boolean(activo);
    }

    const { data: clienteEditado, error: editError } = await supabase
      .from('clientes')
      .update(updateFields)
      .eq('id', id)
      .select('*')
      .single();

    if (editError) {
      console.error('[Clientes API Update Error]:', editError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Error al actualizar los datos del cliente.',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Cliente actualizado correctamente.',
        data: clienteEditado,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[Clientes API PUT Error]:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Error interno en el servidor al modificar el cliente.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

/**
 * DELETE /api/admin/clientes
 * REGLA ESTRICTA DE CELEBRA-YA:
 * El estado del cliente es un toggle lógico (activo/inactivo), NO se permite borrado físico
 * para garantizar la integridad histórica de eventos, invitados y check-ins.
 */
export const DELETE: APIRoute = async () => {
  return new Response(
    JSON.stringify({
      success: false,
      error:
        'Operación no permitida: Celebra-Ya utiliza desactivación lógica (activo/inactivo) para preservar la integridad de los eventos y transacciones. No se permite la eliminación física.',
    }),
    { status: 400, headers: { 'Content-Type': 'application/json' } }
  );
};
