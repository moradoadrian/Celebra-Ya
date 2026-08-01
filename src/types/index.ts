/**
 * Domain TypeScript definitions for Celebra-Ya Digital Design Studio
 */

export type EventCategory = 
  | 'bodas'
  | 'xv-anos'
  | 'bautizos'
  | 'cumpleanos'
  | 'graduaciones'
  | 'baby-showers'
  | 'empresariales';

export interface EventCategoryInfo {
  id: EventCategory;
  name: string;
  icon: string;
  description: string;
}

export interface PortfolioItem {
  id: string;
  slug: string;
  title: string;
  category: EventCategory;
  categoryName: string;
  description: string;
  thumbnailUrl: string;
  previewUrl?: string;
  isFeatured?: boolean;
  tags: string[];
  clientName?: string;
}

export interface WorkStep {
  stepNumber: number;
  title: string;
  description: string;
  icon: string;
}

export interface PricingPackage {
  id: string;
  name: string;
  price: number;
  deliveryTime: string;
  description: string;
  features: string[];
  isPopular?: boolean;
  ctaText: string;
  badge?: string;
  revisions: string;
}

export interface NavItem {
  label: string;
  href: string;
}

export interface QuoteFormData {
  name: string;
  whatsapp: string;
  email: string;
  eventType: string;
  eventDate: string;
  estimatedGuests: string;
  desiredStyle: string;
  comments: string;
}
