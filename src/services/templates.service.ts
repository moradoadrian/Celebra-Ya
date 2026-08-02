import type { PortfolioItem, EventCategory } from '../types';
import { demos } from '@/lib/constants';

const MOCK_PORTFOLIO: PortfolioItem[] = [
  {
    id: 'boda-elegancia-eterna',
    slug: 'boda-elegancia-eterna',
    demoUrl: demos.premiumWedding,
    title: 'Boda Sofía & Alejandro',
    category: 'bodas',
    categoryName: 'Boda Premium',
    description: 'Diseño romántico minimalista con tipografía de autor, mapa interactivo y confirmación por WhatsApp.',
    thumbnailUrl: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=800&q=80',
    isFeatured: true,
    tags: ['Diseño Personalizado', 'Mapa GPS', 'Pase QR'],
    clientName: 'Sofía & Alejandro'
  },
  {
    id: 'xv-anos-corona-real',
    slug: 'xv-anos-corona-real',
    demoUrl: demos.basicXv,
    title: 'XV Años Valentina',
    category: 'xv-anos',
    categoryName: 'XV Años',
    description: 'Experiencia web juvenil con animaciones discretas, galería fotográfica y mesa de regalos.',
    thumbnailUrl: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=800&q=80',
    isFeatured: true,
    tags: ['Galería HD', 'Música', 'RSVP'],
    clientName: 'Valentina Morales'
  },
  {
    id: 'bautizo-angelical',
    slug: 'bautizo-angelical',
    title: 'Bautizo Mateo',
    category: 'bautizos',
    categoryName: 'Bautizo',
    description: 'Paleta pastel botánica desarrollada a mano con cuenta regresiva e itinerario de misa y recepción.',
    thumbnailUrl: '/images/bautizo_mateo.png',
    tags: ['Pastel', 'Itinerario', 'Ubicación'],
    clientName: 'Familia Gómez'
  },
  {
    id: 'graduacion-exito',
    slug: 'graduacion-exito',
    title: 'Gala Graduación Medicina 2026',
    category: 'graduaciones',
    categoryName: 'Graduación',
    description: 'Invitación ejecutiva para 250 graduados con pases QR individuales y confirmaciones masivas.',
    thumbnailUrl: '/images/gala_medicina.png',
    tags: ['Gala', 'Pases QR', 'Masivo'],
    clientName: 'Comité de Graduación'
  },
  {
    id: 'cumpleanos-festivo',
    slug: 'cumpleanos-festivo',
    title: '50 Aniversario Roberto',
    category: 'cumpleanos',
    categoryName: 'Cumpleaños Aniversario',
    description: 'Diseño distinguido en tonos dorados con reproductor de música personalizado e historia en fotos.',
    thumbnailUrl: 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?auto=format&fit=crop&w=800&q=80',
    isFeatured: true,
    tags: ['Dorado', 'Línea del tiempo', 'Música'],
    clientName: 'Roberto Garza'
  },
  {
    id: 'empresarial-summit',
    slug: 'empresarial-summit',
    title: 'Summit Innovación 2026',
    category: 'empresariales',
    categoryName: 'Empresarial VIP',
    description: 'Landing de evento corporativo con agenda de conferencistas, mapa Waze y confirmación directiva.',
    thumbnailUrl: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=800&q=80',
    tags: ['Corporativo', 'Agenda', 'VIP'],
    clientName: 'Tech Summit LATAM'
  }
];

export class TemplatesService {
  static async getAllTemplates(): Promise<PortfolioItem[]> {
    return MOCK_PORTFOLIO;
  }

  static async getFeaturedPortfolio(): Promise<PortfolioItem[]> {
    return MOCK_PORTFOLIO.filter(item => item.isFeatured);
  }

  static async getPortfolioByCategory(category: EventCategory): Promise<PortfolioItem[]> {
    return MOCK_PORTFOLIO.filter(item => item.category === category);
  }

  static async getPortfolioBySlug(slug: string): Promise<PortfolioItem | undefined> {
    return MOCK_PORTFOLIO.find(item => item.slug === slug);
  }
}
