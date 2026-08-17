/**
 * supabase.js — Cliente y helpers. Tras hardening.sql: RPC (sin PII pública).
 */

import { APP_CONFIG, isSupabaseConfigured } from './config.js';

let client = null;
let rpcReady = null;

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
      nombre: row.cliente_nombre ?? '',
      telefono: row.cliente_telefono ?? '',
      correo: row.cliente_correo ?? '',
    },
    pago: row.pago,
    total: row.total,
    status: row.status,
    createdAt: row.created_at,
  };
}

function isMissingRpc(error) {
  const msg = `${error?.message ?? ''} ${error?.code ?? ''}`.toLowerCase();
  return msg.includes('could not find the function')
    || msg.includes('does not exist')
    || error?.code === 'PGRST202'
    || error?.code === '42883';
}

export async function isHardeningReady() {
  if (rpcReady !== null) return rpcReady;
  try {
    const sb = getClient();
    const { error } = await sb.rpc('admin_verify_pin', { p_pin: '__probe__' });
    if (!error || !isMissingRpc(error)) {
      rpcReady = true;
      return true;
    }
  } catch {
    /* ignore */
  }
  rpcReady = false;
  return false;
}

export async function fetchConfirmedBookings(barberId, fecha) {
  const sb = getClient();
  const barberArg = barberId && barberId !== 'any' ? barberId : null;

  const { data, error } = await sb.rpc('get_confirmed_slots', {
    p_fecha: fecha,
    p_barber_id: barberArg,
  });

  if (!error) {
    return (data ?? []).map((row) => mapBookingRow({
      ...row,
      cliente_nombre: '',
      cliente_telefono: '',
      cliente_correo: '',
    }));
  }

  if (!isMissingRpc(error)) throw error;

  let query = sb
    .from('bookings')
    .select('id, barber_id, service_id, service_name, fecha, time, duration, status')
    .eq('fecha', fecha)
    .eq('status', 'confirmed');

  if (barberArg) query = query.eq('barber_id', barberArg);

  const fallback = await query;
  if (fallback.error) throw fallback.error;
  return (fallback.data ?? []).map(mapBookingRow);
}

export async function insertBooking(record) {
  const sb = getClient();
  const payload = {
    p_barber_id: record.barberId,
    p_service_id: record.serviceId,
    p_service_name: record.serviceName ?? record.serviceId,
    p_fecha: record.fecha,
    p_time: record.time,
    p_duration: record.duration,
    p_cliente_nombre: record.cliente?.nombre ?? '',
    p_cliente_telefono: record.cliente?.telefono ?? '',
    p_cliente_correo: record.cliente?.correo ?? '',
    p_pago: record.pago ?? '',
    p_total: record.total ?? 0,
  };

  const { data, error } = await sb.rpc('create_booking', payload);

  if (!error) {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    return {
      ...record,
      id: parsed.id,
      barberId: parsed.barber_id ?? record.barberId,
      status: 'confirmed',
    };
  }

  if (error.code === '23505' || `${error.message}`.includes('SLOT_TAKEN')) {
    const slotErr = new Error('Esa hora ya está tomada. Elige otro horario.');
    slotErr.code = 'SLOT_TAKEN';
    throw slotErr;
  }

  if (!isMissingRpc(error)) throw error;

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

  const inserted = await sb.from('bookings').insert(row).select().single();
  if (inserted.error) {
    if (inserted.error.code === '23505') {
      const slotErr = new Error('Esa hora ya está tomada. Elige otro horario.');
      slotErr.code = 'SLOT_TAKEN';
      throw slotErr;
    }
    throw inserted.error;
  }
  return mapBookingRow(inserted.data);
}

export async function verifyAdminPin(pin) {
  const sb = getClient();
  const { data, error } = await sb.rpc('admin_verify_pin', { p_pin: pin });
  if (!error) return data === true;
  if (!isMissingRpc(error)) throw error;
  return pin === APP_CONFIG.admin.pin;
}

export async function fetchAdminBookings(pin, { fromISO, toISO }) {
  const sb = getClient();
  const { data, error } = await sb.rpc('admin_list_bookings', {
    p_pin: pin,
    p_from: fromISO,
    p_to: toISO,
  });

  if (!error) return (data ?? []).map(mapBookingRow);
  if (!isMissingRpc(error)) throw error;

  const fallback = await sb
    .from('bookings')
    .select('*')
    .gte('fecha', fromISO)
    .lte('fecha', toISO)
    .order('fecha', { ascending: true })
    .order('time', { ascending: true });

  if (fallback.error) throw fallback.error;
  return (fallback.data ?? []).map(mapBookingRow);
}

export async function updateBookingStatus(pin, id, status) {
  const sb = getClient();
  const { data, error } = await sb.rpc('admin_update_status', {
    p_pin: pin,
    p_id: id,
    p_status: status,
  });

  if (!error) {
    const row = Array.isArray(data) ? data[0] : data;
    return mapBookingRow(row);
  }
  if (!isMissingRpc(error)) throw error;

  const fallback = await sb
    .from('bookings')
    .update({ status })
    .eq('id', id)
    .select()
    .single();

  if (fallback.error) throw fallback.error;
  return mapBookingRow(fallback.data);
}

/** @deprecated usar fetchAdminBookings */
export async function fetchUpcomingBookings({ includePastToday = true } = {}) {
  const today = new Date();
  const todayISO = toLocalISO(today);
  const to = new Date(today);
  to.setDate(to.getDate() + 60);
  const rows = await fetchAdminBookings(APP_CONFIG.admin.pin, {
    fromISO: todayISO,
    toISO: toLocalISO(to),
  });
  if (includePastToday) return rows;
  const nowMin = today.getHours() * 60 + today.getMinutes();
  return rows.filter((b) => {
    if (b.fecha > todayISO) return true;
    const [hh, mm] = b.time.split(':').map(Number);
    return hh * 60 + mm >= nowMin;
  });
}

function toLocalISO(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}
