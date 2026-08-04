/**
 * data.js — Catálogo Eryza Barber
 */

export const SERVICES = [
  {
    id: 'corte',
    name: 'El corte',
    desc: 'Corte de cabello completo',
    price: 7000,
    dur: 45,
    icon: 'corte',
    featured: true,
  },
  {
    id: 'barba',
    name: 'La barba',
    desc: 'Arreglo y perfilado de barba',
    price: 2000,
    dur: 45,
    icon: 'barba',
  },
  {
    id: 'membresia-4',
    name: 'Membresía 4 cortes',
    desc: '4 cortes en 1 mes',
    price: 22000,
    dur: 45,
    icon: 'membresia',
    featured: false,
  },
];

export const BARBERS = [
  {
    id: 'fernando',
    name: 'Fernando',
    tag: 'Barbero principal',
    color: '#9B8EC4',
    letter: 'F',
    email: 'Fernandoisaias2606@gmail.com',
    isAssignable: true,
  },
];

export const PAYMENT_METHODS = [
  { id: 'efectivo', name: 'Efectivo', desc: 'Pagas al llegar al local', icon: 'cash' },
  { id: 'transferencia', name: 'Transferencia', desc: 'Te enviamos los datos por correo', icon: 'transfer' },
  { id: 'tarjeta', name: 'Tarjeta', desc: 'Débito o crédito en el local', icon: 'card' },
];

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
