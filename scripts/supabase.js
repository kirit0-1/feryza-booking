/**
 * supabase.js — Cliente y helpers CRUD para reservas Feryza
 */

import { APP_CONFIG, isSupabaseConfigured } from './config.js';

let client = null;

export function getClient() {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase no configurado. Pega URL y anon key en config.js');
  }
  if (client) return client;

  if (typeof supabase === 'undefined' || !supabase.createClient) {
    throw new Error('CDN de @supabase/supabase-js no cargado');
  }

  client = supabase.createClient(APP_CONFIG.supabase.url, APP_CONFIG.supabase.anonKey);
  return client;
}

/** Normaliza fila Supabase → forma usada por availability.js */
export function mapBookingRow(row) {
  return {
    id: row.id,
    barberId: row.barber_id,
    serviceId: row.service_id,
    serviceName: row.service_name,
    fecha: row.fecha,
    time: row.time,
    duration: row.duration,
    cliente: {
      nombre: row.cliente_nombre,
      telefono: row.cliente_telefono,
      correo: row.cliente_correo,
    },
    pago: row.pago,
    total: row.total,
    status: row.status,
    createdAt: row.created_at,
  };
}

/**
 * Citas confirmadas para un barbero en una fecha (disponibilidad).
 */
export async function fetchConfirmedBookings(barberId, fecha) {
  const sb = getClient();
  let query = sb
    .from('bookings')
    .select('id, barber_id, service_id, service_name, fecha, time, duration, status')
    .eq('fecha', fecha)
    .eq('status', 'confirmed');

  if (barberId && barberId !== 'any') {
    query = query.eq('barber_id', barberId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapBookingRow);
}

/**
 * Inserta una reserva confirmada.
 * Lanza error con code SLOT_TAKEN si choca el índice único.
 */
export async function insertBooking(record) {
  const sb = getClient();
  const row = {
    barber_id: record.barberId,
    service_id: record.serviceId,
    service_name: record.serviceName ?? record.serviceId,
    fecha: record.fecha,
    time: record.time,
    duration: record.duration,
    cliente_nombre: record.cliente?.nombre ?? '',
    cliente_telefono: record.cliente?.telefono ?? '',
    cliente_correo: record.cliente?.correo ?? '',
    pago: record.pago ?? '',
    total: record.total ?? 0,
    status: 'confirmed',
  };

  const { data, error } = await sb.from('bookings').insert(row).select().single();

  if (error) {
    if (error.code === '23505') {
      const slotErr = new Error('Esa hora ya está tomada. Elige otro horario.');
      slotErr.code = 'SLOT_TAKEN';
      throw slotErr;
    }
    throw error;
  }

  return mapBookingRow(data);
}

/**
 * Próximas citas (hoy + futuras) para el panel admin.
 * Incluye confirmed; completed/cancelled se filtran en UI si se desea.
 */
export async function fetchUpcomingBookings({ includePastToday = true } = {}) {
  const sb = getClient();
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const todayISO = `${y}-${m}-${d}`;

  const { data, error } = await sb
    .from('bookings')
    .select('*')
    .gte('fecha', todayISO)
    .order('fecha', { ascending: true })
    .order('time', { ascending: true });

  if (error) throw error;

  const nowMin = today.getHours() * 60 + today.getMinutes();
  const rows = (data ?? []).map(mapBookingRow);

  if (!includePastToday) {
    return rows.filter((b) => {
      if (b.fecha > todayISO) return true;
      const [hh, mm] = b.time.split(':').map(Number);
      return hh * 60 + mm >= nowMin;
    });
  }

  return rows;
}

export async function updateBookingStatus(id, status) {
  const sb = getClient();
  const { data, error } = await sb
    .from('bookings')
    .update({ status })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return mapBookingRow(data);
}
