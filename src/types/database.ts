export interface Evento {
  id: number;
  nombre: string;
  slug: string;
  tipo_evento: string;
  fecha_evento: string;
  estado: boolean | string;
  cliente_id?: number | null;
  cliente?: ClienteItem | null;
  created_at?: string;
  updated_at?: string;
  hora_evento?: string | null;
  subtitulo_hero?: string | null;
  iniciales_monograma?: string | null;
  frase_bienvenida?: string | null;
  portada_url?: string | null;
  musica_url?: string | null;
  ubicacion_resumen?: string | null;
  codigo_vestimenta_titulo?: string | null;
  codigo_vestimenta_caballeros?: string | null;
  codigo_vestimenta_damas?: string | null;
  codigo_vestimenta_notas?: string | null;
  whatsapp_confirmacion?: string | null;
  fecha_limite_confirmacion?: string | null;
  frase_despedida?: string | null;
  etapa_produccion?: EtapaProduccion;
  produccion?: ProduccionEventoDetalle;
}

export interface UbicacionItem {
  id: number;
  evento_id: number;
  nombre: string;
  tipo: string;
  direccion: string;
  google_maps?: string | null;
  waze?: string | null;
  hora?: string | null;
}

export interface ProgramaItem {
  id: number;
  evento_id: number;
  hora: string;
  titulo: string;
  descripcion: string;
  orden: number;
}

export interface GaleriaItem {
  id: number;
  evento_id: number;
  imagen_url: string;
  descripcion: string;
  orden: number;
}

export interface HistoriaItem {
  id: number;
  evento_id: number;
  titulo: string;
  descripcion: string;
  fecha: string;
  orden: number;
}

export interface MesaRegalosItem {
  id: number;
  evento_id: number;
  tipo: string;
  nombre: string;
  descripcion: string;
  url?: string | null;
  datos?: Record<string, any> | string | null;
  orden: number;
}

export interface InvitadoItem {
  id: number;
  evento_id: number;
  nombre: string;
  telefono?: string | null;
  numero_pases: number;
  confirmado: boolean | string | null;
  codigo?: string | null;
  pases_confirmados?: number | null;
  created_at?: string;
}

export interface MesaItem {
  id: number;
  evento_id: number;
  numero: number;
  capacidad: number;
  created_at?: string;
  updated_at?: string;
}

export interface MesaInvitadoItem {
  id: number;
  mesa_id: number;
  invitado_id: number;
  created_at?: string;
  updated_at?: string;
}

export interface MesaConDetalles extends MesaItem {
  invitadosAsignados: {
    asignacionId: number;
    invitado: InvitadoItem;
  }[];
  ocupacionConfirmada: number;
  lugaresDisponibles: number;
  totalPendientes: number;
  totalDeclinados: number;
  estado: 'disponible' | 'completa' | 'sobrecupo';
}

export interface CheckinItem {
  id: number;
  evento_id: number;
  invitado_id: number;
  cantidad: number;
  created_at: string;
}

export interface CheckinDetalleInvitado {
  id: number;
  evento_id: number;
  evento_nombre?: string;
  nombre: string;
  telefono?: string | null;
  codigo: string;
  confirmado: boolean | string | null;
  numero_pases: number;
  pases_confirmados: number;
  pases_utilizados: number;
  pases_disponibles: number;
  estado_checkin?: 'rsvp_pendiente' | 'rechazado' | 'sin_entradas' | 'entrada_parcial' | 'entrada_completa';
  ultimo_ingreso?: string | null;
  mesa?: string | null;
  historial?: CheckinItem[];
}

export interface RecepcionMetricas {
  confirmados: number;
  ingresados: number;
  por_ingresar: number;
  asistencia_porcentaje: number;
  pases_maximos: number;
  invitados_confirmados: number;
  invitados_pendientes_rsvp: number;
  invitados_rechazados: number;
  invitados_ingresaron: number;
  invitados_pendientes_ingreso: number;
  pases_utilizados: number;
  pases_disponibles: number;
}

export interface CheckinFeedItem {
  id: number;
  evento_id: number;
  invitado_id: number;
  invitado_nombre: string;
  cantidad: number;
  created_at: string;
  hora: string;
  evento_nombre?: string;
  mesa?: string | null;
}

export interface InvitadoBusquedaItem {
  id: number;
  evento_id: number;
  nombre: string;
  telefono?: string | null;
  codigo: string;
  confirmado: boolean | string | null;
  numero_pases: number;
  pases_confirmados: number;
  pases_utilizados: number;
  pases_disponibles: number;
  estado_checkin: 'rsvp_pendiente' | 'rechazado' | 'sin_entradas' | 'entrada_parcial' | 'entrada_completa';
  ultimo_ingreso?: string | null;
  mesa?: string | null;
}

export interface ClienteEventoItem {
  id: number;
  nombre: string;
  slug: string;
  tipo_evento: string;
  fecha_evento?: string;
  estado?: boolean | string;
}

export interface ClienteItem {
  id: number;
  nombre: string;
  email: string;
  whatsapp?: string | null;
  telefono?: string | null;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
  total_eventos?: number;
  eventos?: ClienteEventoItem[];
}

export interface ClienteMetricas {
  total: number;
  activos: number;
  inactivos: number;
  eventos_asociados: number;
}

export type EtapaProduccion =
  | 'INFORMACION_PENDIENTE'
  | 'EN_PREPARACION'
  | 'EN_REVISION'
  | 'PUBLICADO'
  | 'FINALIZADO';

export interface ChecklistItem {
  id: string;
  label: string;
  completado: boolean;
  detalle: string;
  accionUrl?: string;
  accionTexto?: string;
  esBloqueante?: boolean;
}

export interface ValidacionPublicacion {
  aptoParaPublicar: boolean;
  bloqueantes: string[];
  recomendaciones: string[];
  checklist: ChecklistItem[];
  progresoPorcentaje: number;
}

export interface ProduccionEventoDetalle {
  etapa: EtapaProduccion;
  etapaLabel: string;
  progresoPorcentaje: number;
  itemsCompletados: number;
  totalItems: number;
  checklist: ChecklistItem[];
  pendientes: string[];
  aptoParaPublicar?: boolean;
  bloqueantes?: string[];
  recomendaciones?: string[];
}

export interface ProduccionMetricas {
  total: number;
  informacionPendiente: number;
  enPreparacion: number;
  enRevision: number;
  publicados: number;
  finalizados: number;
}

