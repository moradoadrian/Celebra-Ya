import type { PricingPackage } from '../types';
import { demos } from '@/lib/constants';

const MOCK_PRICING_PACKAGES: PricingPackage[] = [
  {
    id: 'basico',
    name: 'Paquete Básico',
    price: 699,
    deliveryTime: 'Entrega en 48 horas',
    revisions: '1 Ronda de cambios incluida',
    description: 'Ideal para celebraciones ágiles con un diseño estilizado basado en nuestras estructuras probadas.',
    features: [
      'Desarrollo y maquetación sobre diseño de catálogo elegido',
      'Personalización completa de textos, fechas y colores',
      'Música de fondo elegida por ti',
      'Cuenta regresiva interactiva en vivo',
      'Ubicación enlazada a Google Maps y Waze',
      'Hosting y enlace exclusivo por 3 meses',
      'Entrega garantizada en 48 horas'
    ],
    ctaText: 'Solicitar Paquete Básico'
  },
  {
    id: 'premium',
    name: 'Paquete Premium',
    price: 1299,
    deliveryTime: 'Entrega en 3 a 5 días',
    revisions: 'Hasta 3 rondas de revisiones',
    description: 'Nuestra opción más recomendada para Bodas y XV Años con detalles únicos y confirmación automatizada.',
    features: [
      'Diseño semi-personalizado adaptado a tu temática',
      'Confirmación de asistencia RSVP por WhatsApp',
      'Galería fotográfica HD (hasta 20 fotos)',
      'Mesa de regalos física y sugerencia de sobres',
      'Micro-animaciones elegantes y fluidas',
      'Hasta 3 rondas de revisiones y ajustes',
      'Pase digital con código QR individual',
      'Hosting y enlace exclusivo por 12 meses'
    ],
    isPopular: true,
    badge: 'Más Solicitado',
    ctaText: 'Solicitar Paquete Premium',
    demoUrl: demos.premiumWedding
  },
  {
    id: 'exclusivo',
    name: 'Paquete Exclusivo',
    price: 2499,
    deliveryTime: 'Entrega en 7 días',
    revisions: 'Revisiones ilimitadas durante desarrollo',
    description: 'Desarrollo web a la medida desde cero para quienes buscan una experiencia digital 100% original e inigualable.',
    features: [
      'Diseño gráfico y web 100% desde cero (Bespoke)',
      'Desarrollo personalizado sin límites de maquetación',
      'Animaciones web exclusivas e interacciones avanzadas',
      'Gestión de itinerarios múltiples y pases VIP con QR',
      'Integraciones especiales (Filtros, Spotify, Contadores)',
      'Dominio web personalizado (ej. bodasofiayalejandro.com)',
      'Atención y soporte prioritario 1 a 1 vía WhatsApp',
      'Hosting y vigencia permanente'
    ],
    ctaText: 'Cotizar Proyecto Exclusivo'
  }
];

export class PricingService {
  static async getPlans(): Promise<PricingPackage[]> {
    return MOCK_PRICING_PACKAGES;
  }
}
