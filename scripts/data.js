/**
 * data.js — Catálogo Feryza Barber
 */

export const BARBA_ADDON_PRICE = 3000;

export const SERVICES = [
  {
    id: 'corte',
    name: 'Corte clásico',
    desc: 'Fade, cejas y masaje con máquina. Sin lavado.',
    includes: [
      'Fade',
      'Perfilado de cejas',
      'Opciones según el cliente',
      'Masaje corto con máquina',
    ],
    price: 7000,
    dur: 45,
    icon: 'corte',
    featured: true,
    allowBarbaAddon: true,
  },
  {
    id: 'barba',
    name: 'Perfilado de barba',
    desc: 'Contornos limpios y barba ordenada.',
    includes: [
      'Diseño de contornos',
      'Recorte y simetría',
      'Navaja en cuello y mejillas',
      'Bálsamo al terminar',
    ],
    price: 3000,
    dur: 45,
    icon: 'barba',
    allowBarbaAddon: false,
  },
  {
    id: 'membresia-4',
    name: 'Membresía 4 cortes',
    desc: '4 cortes en 30 días. Ahorras $6.000.',
    includes: [
      '4 visitas de corte clásico',
      'Fade, cejas y masaje con máquina',
      'Válida 30 días desde la compra',
      'La barba se puede sumar en cada visita',
    ],
    price: 22000,
    dur: 45,
    icon: 'membresia',
    featured: false,
    allowBarbaAddon: true,
  },
];

export const BARBERS = [
  {
    id: 'fernando',
    name: 'Fernando',
    tag: 'Barbero principal',
    color: '#370D5E',
    letter: 'F',
    email: 'Fernandoisaias2606@gmail.com',
    isAssignable: true,
  },
];

export const PAYMENT_METHODS = [
  { id: 'efectivo', name: 'Efectivo', desc: 'Pagas al llegar al local', icon: 'cash' },
  { id: 'transferencia', name: 'Transferencia', desc: 'Te mostramos los datos bancarios', icon: 'transfer' },
];

export const BANK_DETAILS = {
  nombre: 'Fernando MORALES',
  rut: '22.034.081-3',
  email: 'fernandoisaias2606@gmail.com',
  tipoCuenta: 'Cuenta Corriente',
  numero: '19830921118',
  banco: 'Banco Falabella',
};

export function getRealBarberIds() {
  return BARBERS.filter((b) => b.isAssignable).map((b) => b.id);
}

export function getBarberEmail(barberId) {
  return BARBERS.find((b) => b.id === barberId)?.email ?? 'Fernandoisaias2606@gmail.com';
}

export function findServiceById(id) {
  return SERVICES.find((s) => s.id === id) ?? null;
}

export function findBarberById(id) {
  return BARBERS.find((b) => b.id === id) ?? null;
}

export function findPaymentById(id) {
  return PAYMENT_METHODS.find((p) => p.id === id) ?? null;
}

/** Servicio efectivo (corte/membresía + barba si aplica) */
export function getActiveService(service, addBarba) {
  if (!service) return null;
  if (!addBarba || !service.allowBarbaAddon) return service;
  return {
    ...service,
    id: `${service.id}-barba`,
    name: `${service.name} + barba`,
    desc: `${service.desc} Incluye perfilado de barba.`,
    price: service.price + BARBA_ADDON_PRICE,
    includes: [...(service.includes ?? []), 'Perfilado de barba en el mismo turno'],
  };
}
