import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '@/lib/supabase-server';

function respond(
  context: Parameters<APIRoute>[0],
  status: number,
  data: { success: boolean; message?: string; error?: string },
  eventId?: number
) {
  const accept = context.request.headers.get('accept') || '';
  if (accept.includes('application/json')) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Si fue un envío tradicional de formulario HTML (sin fetch)
  if (data.success && eventId) {
    return context.redirect(`/admin/eventos/${eventId}?saved=true`);
  } else if (eventId) {
    const errorMsg = data.error || 'No pudimos guardar los cambios.';
    return context.redirect(`/admin/eventos/${eventId}?error=${encodeURIComponent(errorMsg)}`);
  }

  return context.redirect('/admin');
}

export const POST: APIRoute = async (context) => {
  const { params, request, cookies } = context;
  const idParam = params.id;
  const eventId = Number(idParam);

  // 1. Validar que el parámetro ID sea numérico
  if (!idParam || isNaN(eventId) || eventId <= 0) {
    return respond(context, 400, {
      success: false,
      error: 'ID de evento inválido.',
    });
  }

  // 2. Validar autenticación SSR del usuario
  const supabase = createSupabaseServerClient({
    headers: request.headers,
    cookies,
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    const accept = request.headers.get('accept') || '';
    if (accept.includes('text/html')) {
      return context.redirect('/admin/login');
    }
    return respond(context, 401, {
      success: false,
      error: 'Sesión no autorizada. Inicia sesión nuevamente.',
    });
  }

  // 3. Extraer los datos enviados (JSON o FormData)
  let rawData: Record<string, any> = {};
  const contentType = request.headers.get('content-type') || '';

  try {
    if (contentType.includes('application/json')) {
      rawData = await request.json();
    } else {
      const formData = await request.formData();
      formData.forEach((value, key) => {
        rawData[key] = value.toString();
      });
    }
  } catch (parseError) {
    console.error('Error al procesar el cuerpo de la petición:', parseError);
    return respond(context, 400, {
      success: false,
      error: 'Datos de formulario mal formados.',
    }, eventId);
  }

  // 4. Validaciones de negocio
  const nombre = rawData.nombre?.toString().trim();
  const slug = rawData.slug?.toString().trim().toLowerCase();
  const fecha_evento = rawData.fecha_evento?.toString().trim();

  if (!nombre) {
    return respond(context, 400, {
      success: false,
      error: 'El nombre del evento es requerido.',
    }, eventId);
  }

  if (!slug) {
    return respond(context, 400, {
      success: false,
      error: 'El slug del evento es requerido.',
    }, eventId);
  }

  // Validar formato del slug (alfanumérico y guiones)
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  if (!slugRegex.test(slug)) {
    return respond(context, 400, {
      success: false,
      error: 'El slug solo puede contener letras minúsculas, números y guiones (ej. boda-maria-juan).',
    }, eventId);
  }

  if (!fecha_evento) {
    return respond(context, 400, {
      success: false,
      error: 'La fecha del evento es requerida.',
    }, eventId);
  }

  // Validar formato fecha YYYY-MM-DD
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(fecha_evento)) {
    return respond(context, 400, {
      success: false,
      error: 'El formato de fecha debe ser AAAA-MM-DD.',
    }, eventId);
  }

  // Validar formato de URLs si tienen valor
  const validateUrl = (urlStr?: any) => {
    if (!urlStr || typeof urlStr !== 'string' || !urlStr.trim()) return null;
    const trimmed = urlStr.trim();
    try {
      new URL(trimmed);
      return trimmed;
    } catch {
      return 'INVALID';
    }
  };

  const portada_url_clean = validateUrl(rawData.portada_url);
  if (portada_url_clean === 'INVALID') {
    return respond(context, 400, {
      success: false,
      error: 'La URL de la imagen de portada no es una URL válida.',
    }, eventId);
  }

  const musica_url_clean = validateUrl(rawData.musica_url);
  if (musica_url_clean === 'INVALID') {
    return respond(context, 400, {
      success: false,
      error: 'La URL del archivo de música no es una URL válida.',
    }, eventId);
  }

  // Estado: true = publicado, false = borrador
  const estadoVal =
    rawData.estado === true ||
    rawData.estado === 'true' ||
    rawData.estado === 'on' ||
    rawData.estado === 'publicado';

  // 5. Construcción del payload de actualización
  // Nota: cliente_id NO se modifica arbitrariamente
  const updatePayload: Record<string, any> = {
    nombre,
    slug,
    tipo_evento: rawData.tipo_evento?.toString().trim() || 'Boda',
    fecha_evento,
    hora_evento: rawData.hora_evento?.toString().trim() || null,
    estado: estadoVal ? 'true' : 'false',
    subtitulo_hero: rawData.subtitulo_hero?.toString().trim() || null,
    iniciales_monograma: rawData.iniciales_monograma?.toString().trim() || null,
    frase_bienvenida: rawData.frase_bienvenida?.toString().trim() || null,
    portada_url: portada_url_clean,
    musica_url: musica_url_clean,
    ubicacion_resumen: rawData.ubicacion_resumen?.toString().trim() || null,
    codigo_vestimenta_titulo: rawData.codigo_vestimenta_titulo?.toString().trim() || null,
    codigo_vestimenta_caballeros: rawData.codigo_vestimenta_caballeros?.toString().trim() || null,
    codigo_vestimenta_damas: rawData.codigo_vestimenta_damas?.toString().trim() || null,
    codigo_vestimenta_notas: rawData.codigo_vestimenta_notas?.toString().trim() || null,
    whatsapp_confirmacion: rawData.whatsapp_confirmacion?.toString().trim() || null,
    fecha_limite_confirmacion: rawData.fecha_limite_confirmacion?.toString().trim() || null,
    frase_despedida: rawData.frase_despedida?.toString().trim() || null,
    updated_at: new Date().toISOString(),
  };

  // 6. Ejecutar UPDATE en Supabase usando el cliente SSR autenticado
  try {
    const { data: updatedEvento, error: updateError } = await supabase
      .from('eventos')
      .update(updatePayload)
      .eq('id', eventId)
      .select('id, nombre, slug')
      .single();

    if (updateError) {
      console.error(`[Server Error] Error al actualizar evento #${eventId}:`, updateError.message);
      return respond(context, 400, {
        success: false,
        error: 'No pudimos guardar los cambios.',
      }, eventId);
    }

    return respond(context, 200, {
      success: true,
      message: 'Evento actualizado correctamente.',
    }, eventId);
  } catch (error) {
    console.error(`[Server Exception] Excepción al actualizar evento #${eventId}:`, error);
    return respond(context, 500, {
      success: false,
      error: 'No pudimos guardar los cambios.',
    }, eventId);
  }
};
