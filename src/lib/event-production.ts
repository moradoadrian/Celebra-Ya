import type {
  Evento,
  ChecklistItem,
  ProduccionEventoDetalle,
  EtapaProduccion,
  ProduccionMetricas,
  ValidacionPublicacion,
  EventoMetricasOperativas,
} from '@/types';

export interface EntityCounts {
  ubicacionesCount?: number;
  invitadosCount?: number;
  mesasCount?: number;
  programaCount?: number;
  galeriaCount?: number;
}

/**
 * Valida de forma estricta los requisitos críticos (bloqueantes) y opcionales
 * necesarios para publicar una invitación digital en Celebra-Ya.
 *
 * Requisitos Bloqueantes (Impiden la publicación si no se cumplen):
 * 1. Cliente asignado (cliente_id).
 * 2. Nombre del evento (mínimo 3 caracteres).
 * 3. Slug de invitación válido (formato URL-safe).
 * 4. Fecha del evento definida.
 * 5. Al menos una sede/ubicación configurada (o texto resumen de ubicación).
 * 6. Imagen de portada o diseño visual principal configurado.
 * 7. Al menos un invitado registrado con pases.
 *
 * Recomendaciones Opcionales:
 * - Horario definido.
 * - Seating plan / mesas configuradas.
 * - Música de fondo.
 */
export function validarRequisitosPublicacion(
  evento: Evento,
  counts?: EntityCounts
): ValidacionPublicacion {
  const ubicacionesCount = counts?.ubicacionesCount ?? (evento.ubicacion_resumen ? 1 : 0);
  const invitadosCount = counts?.invitadosCount ?? 0;
  const mesasCount = counts?.mesasCount ?? 0;

  const bloqueantes: string[] = [];
  const recomendaciones: string[] = [];

  // 1. Cliente asignado
  if (!evento.cliente_id) {
    bloqueantes.push('Falta asignar un cliente responsable al evento.');
  }

  // 2. Nombre del evento
  if (!evento.nombre || evento.nombre.trim().length < 3) {
    bloqueantes.push('El nombre del evento debe tener al menos 3 caracteres.');
  }

  // 3. Slug de acceso
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  if (!evento.slug || !slugRegex.test(evento.slug.trim())) {
    bloqueantes.push('El slug del evento es inválido o no está definido.');
  }

  // 4. Fecha del evento
  if (!evento.fecha_evento || evento.fecha_evento.trim().length < 8) {
    bloqueantes.push('Falta definir la fecha del evento.');
  }

  // 5. Ubicación o sede
  const hasUbicacion =
    ubicacionesCount > 0 ||
    Boolean(evento.ubicacion_resumen && evento.ubicacion_resumen.trim().length > 5);
  if (!hasUbicacion) {
    bloqueantes.push('Falta registrar la sede o ubicación del evento.');
  }

  // 6. Portada principal
  const hasPortada = Boolean(evento.portada_url && evento.portada_url.trim().length > 5);
  if (!hasPortada) {
    bloqueantes.push('Falta configurar la fotografía o imagen de portada.');
  }

  // 7. Invitados registrados
  if (invitadosCount <= 0) {
    bloqueantes.push('Falta cargar al menos un invitado con sus pases correspondientes.');
  }

  // Recomendaciones opcionales (no bloqueantes)
  if (!evento.hora_evento) {
    recomendaciones.push('Recomendado: Definir horario específico de recepción.');
  }
  if (mesasCount <= 0) {
    recomendaciones.push('Recomendado: Configurar distribución de mesas.');
  }
  if (!evento.musica_url) {
    recomendaciones.push('Recomendado: Asignar música de fondo para la invitación.');
  }

  const detalle = evaluarProgresoEvento(evento, counts);
  const aptoParaPublicar = bloqueantes.length === 0;

  return {
    aptoParaPublicar,
    bloqueantes,
    recomendaciones,
    checklist: detalle.checklist,
    progresoPorcentaje: detalle.progresoPorcentaje,
  };
}

/**
 * Evalúa el progreso de preparación y determina la etapa de producción de un evento
 * a partir de la información real registrada en la base de datos de Celebra-Ya.
 *
 * Flujo de estados soportado:
 * 1. INFORMACION_PENDIENTE - Faltan datos básicos como fecha, sede, festejados o cliente.
 * 2. EN_PREPARACION       - Datos básicos configurados pero faltan invitados, diseño o programa.
 * 3. EN_REVISION          - Todo el contenido e invitados listos, pendiente de visto bueno antes de publicar.
 * 4. PUBLICADO            - Invitación activa y visible al público (estado = true).
 * 5. FINALIZADO           - Evento que ya se llevó a cabo (fecha en el pasado).
 */
export function evaluarProgresoEvento(
  evento: Evento,
  counts?: EntityCounts
): ProduccionEventoDetalle {
  const ubicacionesCount = counts?.ubicacionesCount ?? (evento.ubicacion_resumen ? 1 : 0);
  const invitadosCount = counts?.invitadosCount ?? 0;
  const mesasCount = counts?.mesasCount ?? 0;

  const hoyStr = new Date().toISOString().split('T')[0];
  const esFechaPasada = Boolean(evento.fecha_evento && evento.fecha_evento < hoyStr);
  const isPublicado =
    evento.estado === true ||
    evento.estado === 'true' ||
    evento.estado === 'publicado';
  const isFinalizado =
    evento.estado === 'finalizado' ||
    evento.estado === 'FINALIZADO' ||
    (esFechaPasada && isPublicado);

  // 1. Información Principal y Cliente
  const hasInfoPrincipal = Boolean(
    evento.nombre &&
      evento.nombre.trim().length >= 3 &&
      evento.tipo_evento &&
      evento.cliente_id &&
      evento.slug
  );

  // 2. Fecha y Horario
  const hasFecha = Boolean(evento.fecha_evento && evento.fecha_evento.trim().length >= 8);
  const hasFechaHora = Boolean(hasFecha && evento.hora_evento);

  // 3. Ubicación del Evento
  const hasUbicacion =
    ubicacionesCount > 0 ||
    Boolean(evento.ubicacion_resumen && evento.ubicacion_resumen.trim().length > 5);

  // 4. Portada y Diseño Visual
  const hasPortada = Boolean(evento.portada_url && evento.portada_url.trim().length > 5);

  // 5. Carga de Invitados y Pases Digitales
  const hasInvitados = invitadosCount > 0;

  // 6. Asignación de Mesas (Seating Plan)
  const hasMesas = mesasCount > 0;

  // 7. Publicación
  const hasPublicado = isPublicado;

  const checklist: ChecklistItem[] = [
    {
      id: 'info_principal',
      label: 'Información del evento y cliente',
      completado: hasInfoPrincipal,
      esBloqueante: true,
      detalle: hasInfoPrincipal
        ? 'Nombre, festejados, slug y cliente asignados'
        : 'Falta asignar cliente o nombre del evento',
      accionUrl: `/admin/eventos/${evento.id}`,
      accionTexto: 'Editar datos',
    },
    {
      id: 'fecha_hora',
      label: 'Fecha y horario definido',
      completado: hasFechaHora,
      esBloqueante: true,
      detalle: hasFechaHora
        ? `${evento.fecha_evento} • ${evento.hora_evento}`
        : hasFecha
        ? `${evento.fecha_evento} (horario sugerido pendiente)`
        : 'Falta definir fecha del evento',
      accionUrl: `/admin/eventos/${evento.id}`,
      accionTexto: 'Definir horario',
    },
    {
      id: 'ubicacion',
      label: 'Sede y ubicaciones del evento',
      completado: hasUbicacion,
      esBloqueante: true,
      detalle: hasUbicacion
        ? `${ubicacionesCount > 0 ? ubicacionesCount + ' ubicación(es)' : 'Ubicación'} configurada`
        : 'Falta agregar la sede o mapa de ubicación',
      accionUrl: `/admin/eventos/${evento.id}#ubicaciones`,
      accionTexto: 'Configurar sede',
    },
    {
      id: 'portada',
      label: 'Diseño visual y fotografía de portada',
      completado: hasPortada,
      esBloqueante: true,
      detalle: hasPortada
        ? 'Fotografía de portada configurada'
        : 'Falta imagen de portada o fotografía principal',
      accionUrl: `/admin/eventos/${evento.id}`,
      accionTexto: 'Subir portada',
    },
    {
      id: 'invitados',
      label: 'Carga de invitados y pases digitales',
      completado: hasInvitados,
      esBloqueante: true,
      detalle: hasInvitados
        ? `${invitadosCount} invitado(s) registrados con QR`
        : 'No hay invitados cargados aún',
      accionUrl: `/admin/invitados?evento_id=${evento.id}`,
      accionTexto: 'Cargar invitados',
    },
    {
      id: 'mesas',
      label: 'Distribución de mesas y capacidad',
      completado: hasMesas,
      esBloqueante: false,
      detalle: hasMesas
        ? `${mesasCount} mesa(s) configuradas en el mapa`
        : 'Sin mesas configuradas (opcional)',
      accionUrl: `/admin/mesas?evento_id=${evento.id}`,
      accionTexto: 'Configurar mesas',
    },
    {
      id: 'publicacion',
      label: 'Revisión final y publicación en línea',
      completado: hasPublicado || isFinalizado,
      esBloqueante: false,
      detalle: isFinalizado
        ? 'Evento concluido (registros históricos resguardados)'
        : hasPublicado
        ? 'Invitación digital publicada y operativa'
        : 'Borrador en producción (no visible al público)',
      accionUrl: `/admin/eventos/${evento.id}`,
      accionTexto: hasPublicado || isFinalizado ? 'Ver demo ↗' : 'Publicar evento',
    },
  ];

  const itemsCompletados = checklist.filter((c) => c.completado).length;
  const totalItems = checklist.length;
  const progresoPorcentaje = Math.round((itemsCompletados / totalItems) * 100);

  const pendientes = checklist.filter((c) => !c.completado).map((c) => c.detalle);

  // Determinación de Bloqueantes y Recomendaciones
  const bloqueantes: string[] = [];
  const recomendaciones: string[] = [];

  if (!hasInfoPrincipal) {
    bloqueantes.push('Falta asignar un cliente responsable o nombre válido al evento.');
  }
  if (!hasFecha) {
    bloqueantes.push('Falta definir la fecha del evento.');
  }
  if (!hasUbicacion) {
    bloqueantes.push('Falta registrar la sede o ubicación del evento.');
  }
  if (!hasPortada) {
    bloqueantes.push('Falta configurar la fotografía o imagen de portada.');
  }
  if (!hasInvitados) {
    bloqueantes.push('Falta cargar al menos un invitado con sus pases correspondientes.');
  }

  if (!evento.hora_evento) {
    recomendaciones.push('Recomendado: Definir horario del evento.');
  }
  if (!hasMesas) {
    recomendaciones.push('Recomendado: Configurar distribución de mesas.');
  }
  if (!evento.musica_url) {
    recomendaciones.push('Recomendado: Asignar música de fondo para la invitación.');
  }

  const aptoParaPublicar = bloqueantes.length === 0;

  // Determinación de la Etapa de Producción
  let etapa: EtapaProduccion = 'INFORMACION_PENDIENTE';
  let etapaLabel = 'Información Pendiente';

  if (isFinalizado) {
    etapa = 'FINALIZADO';
    etapaLabel = 'Finalizado';
  } else if (isPublicado) {
    etapa = 'PUBLICADO';
    etapaLabel = 'Publicado';
  } else if (hasInfoPrincipal && hasFecha && hasUbicacion && hasPortada && hasInvitados) {
    etapa = 'EN_REVISION';
    etapaLabel = 'En Revisión';
  } else if (hasInfoPrincipal && (hasFecha || hasUbicacion || hasPortada)) {
    etapa = 'EN_PREPARACION';
    etapaLabel = 'En Preparación';
  } else {
    etapa = 'INFORMACION_PENDIENTE';
    etapaLabel = 'Información Pendiente';
  }

  return {
    etapa,
    etapaLabel,
    progresoPorcentaje,
    itemsCompletados,
    totalItems,
    checklist,
    pendientes,
    aptoParaPublicar,
    bloqueantes,
    recomendaciones,
  };
}

/**
 * Calcula las métricas globales del Centro de Producción para un listado de eventos
 */
export function calcularMetricasProduccion(
  detalles: ProduccionEventoDetalle[]
): ProduccionMetricas {
  let informacionPendiente = 0;
  let enPreparacion = 0;
  let enRevision = 0;
  let publicados = 0;
  let finalizados = 0;

  detalles.forEach((d) => {
    switch (d.etapa) {
      case 'INFORMACION_PENDIENTE':
        informacionPendiente++;
        break;
      case 'EN_PREPARACION':
        enPreparacion++;
        break;
      case 'EN_REVISION':
        enRevision++;
        break;
      case 'PUBLICADO':
        publicados++;
        break;
      case 'FINALIZADO':
        finalizados++;
        break;
    }
  });

  return {
    total: detalles.length,
    informacionPendiente,
    enPreparacion,
    enRevision,
    publicados,
    finalizados,
  };
}

/**
 * Calcula indicadores operativos integrales en tiempo real para un evento de Celebra-Ya.
 * Consolida el estado de invitados, confirmaciones RSVP, pases ingresados en check-in,
 * mesas asignadas y finalización del evento.
 */
export function calcularMetricasOperativasEvento(
  evento: Evento,
  data: {
    invitados?: Array<{ id: number; numero_pases?: number; confirmado?: boolean | null; pases_confirmados?: number | null }>;
    mesas?: Array<{ id: number; capacidad?: number | null }>;
    checkins?: Array<{ id: number; cantidad?: number | null }>;
  }
): EventoMetricasOperativas {
  const invitados = data.invitados || [];
  const mesas = data.mesas || [];
  const checkins = data.checkins || [];

  const totalInvitados = invitados.length;
  const totalPases = invitados.reduce((sum, i) => sum + (Number(i.numero_pases) || 1), 0);
  const invitadosConfirmados = invitados.filter((i) => i.confirmado === true).length;
  const invitadosPendientes = invitados.filter((i) => i.confirmado === null || i.confirmado === undefined).length;
  const invitadosRechazados = invitados.filter((i) => i.confirmado === false).length;
  const pasesConfirmados = invitados.reduce((sum, i) => sum + (Number(i.pases_confirmados) || 0), 0);

  const pasesIngresados = checkins.reduce((sum, c) => sum + (Number(c.cantidad) || 0), 0);
  const totalMesas = mesas.length;
  const capacidadMesas = mesas.reduce((sum, m) => sum + (Number(m.capacidad) || 0), 0);

  const basePases = pasesConfirmados > 0 ? pasesConfirmados : totalPases;
  const asistenciaPorcentaje = basePases > 0 ? Math.min(100, Math.round((pasesIngresados / basePases) * 100)) : 0;

  const hoyStr = new Date().toISOString().split('T')[0];
  const esFechaPasada = Boolean(evento.fecha_evento && evento.fecha_evento < hoyStr);
  const isPublicado = evento.estado === true || evento.estado === 'true' || evento.estado === 'publicado';
  const esFinalizado =
    evento.estado === 'finalizado' ||
    evento.estado === 'FINALIZADO' ||
    (esFechaPasada && isPublicado);

  return {
    totalInvitados,
    totalPases,
    invitadosConfirmados,
    invitadosPendientes,
    invitadosRechazados,
    pasesConfirmados,
    pasesIngresados,
    totalMesas,
    capacidadMesas,
    asistenciaPorcentaje,
    esFinalizado,
  };
}
