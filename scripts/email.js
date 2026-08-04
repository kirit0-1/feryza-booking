/**
 * email.js — Correos de confirmación Feryza Barber
 */

import { APP_CONFIG, isEmailConfigured } from './config.js';
import { getBarberEmail } from './data.js';
import { formatPrice, toISODate } from './utils.js';

let emailjsReady = false;

export function initEmailJS() {
  if (!APP_CONFIG.features.useEmailJS) return;
  if (typeof emailjs === 'undefined') return;
  if (!isEmailConfigured()) return;

  emailjs.init(APP_CONFIG.emailjs.publicKey);
  emailjsReady = true;
}

function buildTemplateParams(state) {
  return {
    to_name: state.nombre,
    servicio: state.service.name,
    barbero: state.barber.name,
    fecha: `${state.date.d}/${state.date.m + 1}/${state.date.y}`,
    hora: state.time,
    pago: state.pago.name,
    total: formatPrice(state.service.price),
    telefono: state.telefono,
  };
}

async function sendViaEmailJS(state) {
  if (!emailjsReady) return { sent: false, reason: 'demo' };

  const baseParams = buildTemplateParams(state);
  const { serviceId, templateClienteId, templateBarberoId } = APP_CONFIG.emailjs;

  await emailjs.send(serviceId, templateClienteId, {
    ...baseParams,
    to_email: state.correo,
  });

  await emailjs.send(serviceId, templateBarberoId, {
    ...baseParams,
    to_email: getBarberEmail(state.barber.id),
    to_name: state.barber.name,
  });

  return { sent: true };
}

async function sendViaResend(state) {
  const res = await fetch(APP_CONFIG.api.sendEmail, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cliente: { email: state.correo, nombre: state.nombre, telefono: state.telefono },
      barbero: { id: state.barber.id, nombre: state.barber.name, email: getBarberEmail(state.barber.id) },
      reserva: {
        servicio: state.service.name,
        fecha: toISODate(state.date),
        hora: state.time,
        pago: state.pago.name,
        total: state.service.price,
        duracion: state.service.dur,
      },
    }),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { sent: true };
}

export async function sendEmails(bookingState) {
  try {
    if (APP_CONFIG.features.useResendBackend) {
      return await sendViaResend(bookingState);
    }
    return await sendViaEmailJS(bookingState);
  } catch (err) {
    console.error('[email] Error:', err);
    return { sent: false, reason: 'error', error: err };
  }
}
