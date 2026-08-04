/**
 * calendar-url.js — Google Calendar URL (Eryza Barber)
 */

import { APP_CONFIG } from './config.js';
import { formatDateLong, formatPrice } from './utils.js';

function formatGCalDate(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z/, 'Z');
}

export function buildCalendarURL(bookingState) {
  const { date, time, service, barber } = bookingState;
  const [h, m] = time.split(':').map(Number);
  const start = new Date(date.y, date.m, date.d, h, m);
  const end = new Date(start.getTime() + service.dur * 60000);

  const details = [
    `Barbero: ${barber.name}`,
    `Servicio: ${service.name}`,
    `Duración: ${service.dur} min`,
    `Fecha: ${formatDateLong(date)}`,
    `Hora: ${time}`,
    `Total: ${formatPrice(service.price)}`,
  ].join('\n');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Eryza Barber — ${service.name}`,
    details,
    location: APP_CONFIG.location,
    dates: `${formatGCalDate(start)}/${formatGCalDate(end)}`,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
