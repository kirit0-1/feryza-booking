/**
 * availability.js — Motor de disponibilidad Feryza Barber
 * Intervalos fijos de 45 min + horarios por día. Persistencia: Supabase (o localStorage mock).
 */

import { APP_CONFIG, getHoursForDay, useLocalAvailability } from './config.js';
import { BARBERS, getRealBarberIds } from './data.js';
import { parseTime, formatTime } from './utils.js';
import {
  fetchConfirmedBookings,
  insertBooking,
} from './supabase.js';

const { bookingsKey } = APP_CONFIG.storage;
const { slotInterval } = APP_CONFIG.businessHours;

export function generateTimeSlotsForDay(dayOfWeek) {
  const hours = getHoursForDay(dayOfWeek);
  if (!hours) return [];

  const slots = [];
  const start = hours.open * 60;
  const end = hours.close * 60;

  for (let t = start; t + slotInterval <= end; t += slotInterval) {
    slots.push(formatTime(t));
  }
  return slots;
}

function rangesOverlap(aStart, aDur, bStart, bDur) {
  return aStart < bStart + bDur && bStart < aStart + aDur;
}

function fitsBusinessHours(slotStart, durationMin, dayOfWeek) {
  const hours = getHoursForDay(dayOfWeek);
  if (!hours) return false;
  const end = slotStart + durationMin;
  return slotStart >= hours.open * 60 && end <= hours.close * 60;
}

function getLocalBookings() {
  try {
    return JSON.parse(localStorage.getItem(bookingsKey) ?? '[]');
  } catch {
    return [];
  }
}

function setLocalBookings(bookings) {
  localStorage.setItem(bookingsKey, JSON.stringify(bookings));
}

function ensureSeedData() {
  if (!localStorage.getItem(bookingsKey)) {
    setLocalBookings([]);
  }
}

export async function fetchBookings(barberoId, fecha) {
  if (!useLocalAvailability()) {
    try {
      const bookings = await fetchConfirmedBookings(barberoId, fecha);
      const realIds = barberoId === 'any' ? getRealBarberIds() : [barberoId];
      return bookings.filter((b) => realIds.includes(b.barberId));
    } catch (err) {
      console.error('[availability] Error Supabase:', err);
      return [];
    }
  }

  ensureSeedData();
  const all = getLocalBookings();
  const realIds = barberoId === 'any' ? getRealBarberIds() : [barberoId];
  return all.filter((b) => b.fecha === fecha && realIds.includes(b.barberId));
}

function dayOfWeekFromISO(fecha) {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

export async function getAvailableSlots(barberoId, fecha, durationMin) {
  if (barberoId === 'any') {
    const realIds = getRealBarberIds();
    const available = await Promise.all(
      realIds.map((id) => getAvailableSlotsForBarber(id, fecha, durationMin)),
    );
    const union = new Set(available.flat());
    return generateTimeSlotsForDay(dayOfWeekFromISO(fecha)).filter((s) => union.has(s));
  }
  return getAvailableSlotsForBarber(barberoId, fecha, durationMin);
}

async function getAvailableSlotsForBarber(barberoId, fecha, durationMin) {
  const day = dayOfWeekFromISO(fecha);
  const daySlots = generateTimeSlotsForDay(day);
  const bookings = await fetchBookings(barberoId, fecha);

  return daySlots.filter((slot) => {
    const slotStart = parseTime(slot);
    if (!fitsBusinessHours(slotStart, durationMin, day)) return false;

    return !bookings.some((b) => {
      if (b.barberId !== barberoId) return false;
      return rangesOverlap(slotStart, durationMin, parseTime(b.time), b.duration);
    });
  });
}

export async function saveBooking(booking) {
  const assignedBarberId = booking.barberId === 'any'
    ? await pickAvailableBarber(booking.fecha, booking.time, booking.duration)
    : booking.barberId;

  const record = {
    ...booking,
    barberId: assignedBarberId,
    serviceName: booking.serviceName ?? booking.serviceId,
    pago: booking.pago ?? '',
    total: booking.total ?? 0,
  };

  if (!useLocalAvailability()) {
    const saved = await insertBooking(record);
    return { ...record, id: saved.id, barberId: saved.barberId };
  }

  const all = getLocalBookings();
  const conflict = all.some(
    (b) => b.barberId === record.barberId
      && b.fecha === record.fecha
      && b.time === record.time,
  );
  if (conflict) {
    const err = new Error('Esa hora ya está tomada. Elige otro horario.');
    err.code = 'SLOT_TAKEN';
    throw err;
  }

  all.push(record);
  setLocalBookings(all);
  return record;
}

async function pickAvailableBarber(fecha, time, duration) {
  const realIds = getRealBarberIds();
  for (const id of realIds) {
    const available = await getAvailableSlotsForBarber(id, fecha, duration);
    if (available.includes(time)) return id;
  }
  throw new Error('No hay barbero disponible en ese horario');
}

export function getBarberNameById(id) {
  return BARBERS.find((b) => b.id === id)?.name ?? id;
}
