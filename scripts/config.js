/**
 * config.js — Configuración Feryza Barber
 */

export const APP_CONFIG = {
  name: 'Feryza Barber',
  location: 'Feryza Barber, Chile',
  whatsapp: '56979608342',
  contactEmail: 'Fernandoisaias2606@gmail.com',

  businessHours: {
    slotInterval: 45,
    /** Por día de la semana: 0=domingo … 6=sábado */
    schedule: {
      0: { open: 11, close: 14 },
      1: { open: 10, close: 21 },
      2: { open: 10, close: 21 },
      3: { open: 10, close: 21 },
      4: { open: 10, close: 21 },
      5: { open: 10, close: 21 },
      6: { open: 10, close: 21 },
    },
    closedDays: [],
  },

  storage: {
    stateKey: 'feryza_booking_state',
    stateVersion: 2,
    stateTtlMs: 30 * 60 * 1000,
    bookingsKey: 'feryza_bookings',
  },

  /** Pegar URL y anon key del proyecto Supabase */
  supabase: {
    // Project URL (sin /rest/v1/)
    url: 'https://zqbfmcvnnyygkfhfyrst.supabase.co',
    anonKey: 'sb_publishable_ExTIG9WL6It90s_XJzSF8A_cnGYS3oV',
  },

  /**
   * PIN de respaldo SOLO si aún no corriste supabase/hardening.sql.
   * Después del SQL, el PIN se valida en Supabase (no en el HTML).
   */
  admin: {
    pin: 'feryza2026',
  },

  features: {
    /** false = usa Supabase cuando hay keys; true = localStorage mock */
    useMockAvailability: false,
    useEmailJS: false,
    useResendBackend: false,
    useQStashBackend: false,
  },

  emailjs: {
    serviceId: 'REEMPLAZAR_ESTO',
    templateClienteId: 'REEMPLAZAR_ESTO',
    templateBarberoId: 'REEMPLAZAR_ESTO',
    publicKey: 'REEMPLAZAR_ESTO',
  },

  api: {
    availability: '/api/availability',
    sendEmail: '/api/send-booking-email',
    scheduleReminder: '/api/schedule-reminder',
  },

  publicUrl: 'https://kirit0-1.github.io/feryza-booking',
};

/** Mensaje WhatsApp al cancelar una cita desde el panel */
export function buildCancelWhatsAppMessage(b) {
  return `Hola ${b.cliente.nombre}, te escribimos de Feryza Barber. Lamentamos informarte que tu cita del ${b.fecha} a las ${b.time} (${b.serviceName}) fue cancelada. Si quieres reagendar, responde a este mensaje o reserva en ${APP_CONFIG.publicUrl}. ¡Gracias!`;
}

export function getHoursForDay(dayOfWeek) {
  return APP_CONFIG.businessHours.schedule[dayOfWeek] ?? null;
}

export function isEmailConfigured() {
  const { emailjs, features } = APP_CONFIG;
  return features.useEmailJS
    && emailjs.publicKey !== 'REEMPLAZAR_ESTO'
    && emailjs.serviceId !== 'REEMPLAZAR_ESTO';
}

export function isSupabaseConfigured() {
  const { url, anonKey } = APP_CONFIG.supabase;
  return url
    && anonKey
    && url !== 'REEMPLAZAR_SUPABASE_URL'
    && url !== 'https://XXXX.supabase.co'
    && anonKey !== 'REEMPLAZAR_SUPABASE_ANON_KEY'
    && url.startsWith('http');
}

/** Usa mock solo si está forzado o si faltan las keys de Supabase */
export function useLocalAvailability() {
  return APP_CONFIG.features.useMockAvailability || !isSupabaseConfigured();
}
