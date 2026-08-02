import type { EventCategoryInfo, NavItem, WorkStep } from '../types';

export const SITE_CONFIG = {
  name: 'Celebra-Ya Studio',
  tagline: 'Estudio de Diseño & Desarrollo de Invitaciones Digitales Premium',
  description: 'Diseñamos y desarrollamos invitaciones web únicas a la medida para bodas, XV años, bautizos y eventos especiales. Servicio 100% personalizado con enlace exclusivo listo para compartir.',
  url: 'https://celebra-ya.vercel.app',
  ogImage: '/images/og-default.jpg',
  whatsappNumber: '+525512345678',
  email: 'celebrayacotizacion@gmail.com',
} as const;

export const NAV_ITEMS: NavItem[] = [
  { label: 'Inicio', href: '/' },
  { label: '¿Cómo trabajamos?', href: '/#proceso' },
  { label: 'Portafolio', href: '/plantillas' },
  { label: 'Paquetes', href: '/precios' },
  { label: 'Cotizar', href: '/contacto' },
];

export const WORK_STEPS: WorkStep[] = [
  {
    stepNumber: 1,
    title: 'Solicita una cotización',
    description: 'Elige tu paquete o envíanos un mensaje describiendo la visión de tu celebración.',
    icon: '📝'
  },
  {
    stepNumber: 2,
    title: 'Cuéntanos tu evento',
    description: 'Nos compartes la fecha, lugar, itinerario y los colores o estilo que te inspiran.',
    icon: '✨'
  },
  {
    stepNumber: 3,
    title: 'Nos envías fotos e información',
    description: 'Nos haces llegar tus fotografías favoritas, música de preferencia e itinerario detallado.',
    icon: '📸'
  },
  {
    stepNumber: 4,
    title: 'Diseñamos tu invitación',
    description: 'Desarrollamos tu web personalizada cuidando cada detalle visual, animación y funcionalidad.',
    icon: '💻'
  },
  {
    stepNumber: 5,
    title: 'La recibes lista para compartir',
    description: 'Te entregamos tu enlace personalizado listo para enviar por WhatsApp a todos tus invitados.',
    icon: '🚀'
  }
];

export const EVENT_CATEGORIES: EventCategoryInfo[] = [
  {
    id: 'bodas',
    name: 'Bodas',
    icon: 'ring',
    description: 'Elegancia atemporal y diseño romántico a la medida para su gran día.'
  },
  {
    id: 'xv-anos',
    name: 'XV Años',
    icon: 'sparkles',
    description: 'Estilos mágicos, modernos y llenos de personalidad para quinceañeras.'
  },
  {
    id: 'bautizos',
    name: 'Bautizos',
    icon: 'heart',
    description: 'Diseños delicados y acogedores para la presentación de tu bebé.'
  },
  {
    id: 'cumpleanos',
    name: 'Cumpleaños',
    icon: 'cake',
    description: 'Experiencias web dinámicas para fiestas de aniversario y cualquier edad.'
  },
  {
    id: 'graduaciones',
    name: 'Graduaciones',
    icon: 'academic-cap',
    description: 'Celebra tus logros académicos con una presentación distinguida.'
  },
  {
    id: 'baby-showers',
    name: 'Baby Showers',
    icon: 'gift',
    description: 'Anuncia la bienvenida de tu bebé con invitaciones llenas de ternura.'
  },
  {
    id: 'empresariales',
    name: 'Empresariales',
    icon: 'briefcase',
    description: 'Sitios web de eventos corporativos, galas y conferencias de alto perfil.'
  }
];
