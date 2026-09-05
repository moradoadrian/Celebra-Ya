export interface Evento {
  id: number;
  nombre: string;
  slug: string;
  tipo_evento: string;
  fecha_evento: string;
  estado: boolean | string;
  cliente_id?: number;
  created_at?: string;
  updated_at?: string;
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
