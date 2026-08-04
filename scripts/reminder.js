/**
 * reminder.js — Recordatorio 2 horas antes (Eryza Barber)
 */

import { APP_CONFIG } from './config.js';
import { formatPrice, toISODate } from './utils.js';

export function calcNotifyAt(date, time) {
  const [h, m] = time.split(':').map(Number);
  const appointment = new Date(date.y, date.m, date.d, h, m);
  return new Date(appointment.getTime() - 2 * 60 * 60 * 1000).toISOString();
}

async function scheduleViaQStash(state) {
  const notifyAt = calcNotifyAt(state.date, state.time);

  const res = await fetch(APP_CONFIG.api.scheduleReminder, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      notifyAt,
      cliente: { email: state.correo, nombre: state.nombre, telefono: state.telefono },
      reserva: {
        servicio: state.service.name,
        barbero: state.barber.name,
        fecha: toISODate(state.date),
        hora: state.time,
        pago: state.pago.name,
        total: formatPrice(state.service.price),
      },
    }),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return { scheduled: true, messageId: data.messageId };
}

export async function scheduleReminder(bookingState) {
  const notifyAt = calcNotifyAt(bookingState.date, bookingState.time);

  if (new Date(notifyAt) <= new Date()) {
    return { scheduled: false, reason: 'too_soon' };
  }

  if (!APP_CONFIG.features.useQStashBackend) {
    console.log('[reminder] Modo demo — recordatorio para:', notifyAt);
    return { scheduled: false, reason: 'demo', notifyAt };
  }

  try {
    return await scheduleViaQStash(bookingState);
  } catch (err) {
    console.error('[reminder] Error:', err);
    return { scheduled: false, reason: 'error', notifyAt };
  }
}
