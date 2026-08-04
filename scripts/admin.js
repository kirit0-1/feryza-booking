/**
 * admin.js — Panel del barbero (PIN demo + gestión de citas)
 */

import { APP_CONFIG, isSupabaseConfigured } from './config.js';
import {
  fetchUpcomingBookings,
  updateBookingStatus,
} from './supabase.js';
import { formatPrice, escapeHtml, showToast } from './utils.js';

const SESSION_KEY = 'feryza_admin_ok';

const loginEl = document.getElementById('adminLogin');
const panelEl = document.getElementById('adminPanel');
const listEl = document.getElementById('bookingsList');
const countEl = document.getElementById('adminCount');
const configWarn = document.getElementById('configWarn');
const pinForm = document.getElementById('pinForm');
const pinInput = document.getElementById('adminPin');
const pinError = document.getElementById('pinError');

function isLoggedIn() {
  return sessionStorage.getItem(SESSION_KEY) === '1';
}

function setLoggedIn(ok) {
  if (ok) sessionStorage.setItem(SESSION_KEY, '1');
  else sessionStorage.removeItem(SESSION_KEY);
}

function showPanel() {
  loginEl.classList.add('hidden');
  panelEl.classList.remove('hidden');
  loadBookings();
}

function showLogin() {
  panelEl.classList.add('hidden');
  loginEl.classList.remove('hidden');
  pinInput.value = '';
  pinError.textContent = '';
}

function formatFechaLabel(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  const todayISO = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');

  const weekday = date.toLocaleDateString('es-CL', { weekday: 'long' });
  const label = date.toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'long',
  });

  if (iso === todayISO) return `Hoy · ${label}`;
  return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)} · ${label}`;
}

function whatsappUrl(phone) {
  const digits = String(phone).replace(/\D/g, '');
  const normalized = digits.startsWith('56') ? digits : `56${digits.replace(/^0/, '')}`;
  return `https://wa.me/${normalized}`;
}

function statusBadge(status) {
  const map = {
    confirmed: { label: 'Confirmada', cls: 'admin-badge--ok' },
    completed: { label: 'Completada', cls: 'admin-badge--done' },
    cancelled: { label: 'Cancelada', cls: 'admin-badge--cancel' },
  };
  const s = map[status] ?? map.confirmed;
  return `<span class="admin-badge ${s.cls}">${s.label}</span>`;
}

function groupByFecha(bookings) {
  const groups = new Map();
  for (const b of bookings) {
    if (!groups.has(b.fecha)) groups.set(b.fecha, []);
    groups.get(b.fecha).push(b);
  }
  return groups;
}

function renderBookings(bookings) {
  const active = bookings.filter((b) => b.status === 'confirmed');
  const others = bookings.filter((b) => b.status !== 'confirmed');
  const ordered = [...active, ...others];

  countEl.textContent = active.length === 0
    ? 'Sin citas confirmadas próximas'
    : `${active.length} confirmada${active.length === 1 ? '' : 's'} próxima${active.length === 1 ? '' : 's'}`;

  if (ordered.length === 0) {
    listEl.innerHTML = `
      <div class="admin-empty">
        <p>No hay citas para mostrar.</p>
        <p class="admin-empty-hint">Cuando un cliente reserve, aparecerá aquí.</p>
      </div>
    `;
    return;
  }

  const groups = groupByFecha(ordered);
  let html = '';

  for (const [fecha, items] of groups) {
    html += `<div class="admin-day">
      <h2 class="admin-day-title">${escapeHtml(formatFechaLabel(fecha))}</h2>
      <div class="admin-day-list">`;

    for (const b of items) {
      const canAct = b.status === 'confirmed';
      html += `
        <article class="admin-card" data-id="${escapeHtml(b.id)}">
          <div class="admin-card-top">
            <span class="admin-time">${escapeHtml(b.time)}</span>
            ${statusBadge(b.status)}
          </div>
          <div class="admin-card-service">${escapeHtml(b.serviceName)}</div>
          <div class="admin-card-meta">
            <div><span class="admin-meta-label">Cliente</span> ${escapeHtml(b.cliente.nombre)}</div>
            <div><span class="admin-meta-label">Teléfono</span>
              <a href="${whatsappUrl(b.cliente.telefono)}" target="_blank" rel="noopener noreferrer">${escapeHtml(b.cliente.telefono)}</a>
            </div>
            <div><span class="admin-meta-label">Correo</span> ${escapeHtml(b.cliente.correo)}</div>
            <div><span class="admin-meta-label">Pago</span> ${escapeHtml(b.pago)} · ${formatPrice(b.total)}</div>
          </div>
          ${canAct ? `
            <div class="admin-card-actions">
              <button type="button" class="btn-continue admin-btn-sm" data-action="complete" data-id="${escapeHtml(b.id)}">Completada</button>
              <button type="button" class="btn-sec admin-btn-sm" data-action="cancel" data-id="${escapeHtml(b.id)}">Cancelar</button>
              <a class="btn-sec admin-btn-sm admin-wa" href="${whatsappUrl(b.cliente.telefono)}" target="_blank" rel="noopener noreferrer">WhatsApp</a>
            </div>
          ` : `
            <div class="admin-card-actions">
              <a class="btn-sec admin-btn-sm admin-wa" href="${whatsappUrl(b.cliente.telefono)}" target="_blank" rel="noopener noreferrer">WhatsApp</a>
            </div>
          `}
        </article>
      `;
    }

    html += `</div></div>`;
  }

  listEl.innerHTML = html;
}

async function loadBookings() {
  if (!isSupabaseConfigured()) {
    configWarn.classList.remove('hidden');
    countEl.textContent = 'Supabase no configurado';
    listEl.innerHTML = '';
    return;
  }

  configWarn.classList.add('hidden');
  countEl.textContent = 'Cargando…';
  listEl.innerHTML = '<p class="admin-loading">Cargando citas…</p>';

  try {
    const bookings = await fetchUpcomingBookings({ includePastToday: true });
    renderBookings(bookings);
  } catch (err) {
    console.error('[admin] Error al cargar:', err);
    countEl.textContent = 'Error al cargar';
    listEl.innerHTML = `<div class="admin-empty"><p>No se pudieron cargar las citas.</p><p class="admin-empty-hint">${escapeHtml(err.message || 'Error')}</p></div>`;
    showToast('Error al cargar citas', 'error');
  }
}

async function handleStatusChange(id, status) {
  try {
    await updateBookingStatus(id, status);
    showToast(
      status === 'completed' ? 'Cita marcada como completada' : 'Cita cancelada',
      'success',
    );
    await loadBookings();
  } catch (err) {
    console.error('[admin] Error al actualizar:', err);
    showToast('No se pudo actualizar la cita', 'error');
  }
}

pinForm.addEventListener('submit', (e) => {
  e.preventDefault();
  pinError.textContent = '';
  const pin = pinInput.value.trim();

  if (pin !== APP_CONFIG.admin.pin) {
    pinError.textContent = 'PIN incorrecto';
    pinInput.classList.add('error');
    return;
  }

  pinInput.classList.remove('error');
  setLoggedIn(true);
  showPanel();
});

document.getElementById('btnLogout').addEventListener('click', () => {
  setLoggedIn(false);
  showLogin();
});

document.getElementById('btnRefresh').addEventListener('click', () => {
  loadBookings();
});

listEl.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const { action, id } = btn.dataset;
  if (!id) return;

  if (action === 'complete') handleStatusChange(id, 'completed');
  if (action === 'cancel') {
    if (confirm('¿Cancelar esta cita? El horario quedará libre.')) {
      handleStatusChange(id, 'cancelled');
    }
  }
});

if (isLoggedIn()) showPanel();
else showLogin();
