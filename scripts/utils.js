/**
 * utils.js — Utilidades compartidas
 */

export function formatPrice(amount) {
  return `$${amount.toLocaleString('es-CL')}`;
}

export function formatDateShort(dateObj) {
  if (!dateObj) return null;
  const { d, m, y } = dateObj;
  return new Date(y, m, d).toLocaleDateString('es-CL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function formatDateLong(dateObj) {
  const { d, m, y } = dateObj;
  return new Date(y, m, d).toLocaleDateString('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function toISODate(dateObj) {
  const { d, m, y } = dateObj;
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function parseTime(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

export function formatTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidChilePhone(phone) {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 9 && digits.length <= 11;
}

/** Número internacional para wa.me (Chile: 569XXXXXXXX) */
export function normalizeChileWhatsApp(phone) {
  let digits = String(phone ?? '').replace(/\D/g, '');
  if (digits.startsWith('56')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 9 && digits.startsWith('9')) return `56${digits}`;
  if (digits.length === 8) return `569${digits}`;
  return digits.length ? `56${digits}` : '';
}

export function buildWhatsAppUrl(phone, text = '') {
  const num = normalizeChileWhatsApp(phone);
  if (!num) return 'https://wa.me/';
  const base = `https://wa.me/${num}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

/** Abre WhatsApp en el mismo gesto del usuario (funciona en iPhone) */
export function openWhatsApp(phone, text = '') {
  const url = buildWhatsAppUrl(phone, text);
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function formatFechaISO(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function debounce(fn, ms = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

let toastTimer;
export function showToast(message, type = 'info', durationMs = 4000) {
  const el = document.getElementById('toast');
  if (!el) return;
  clearTimeout(toastTimer);
  el.textContent = message;
  el.className = `toast toast--${type} toast--visible`;
  toastTimer = setTimeout(() => el.classList.remove('toast--visible'), durationMs);
}
