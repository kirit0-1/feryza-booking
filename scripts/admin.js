/**
 * admin.js — Agenda del barbero (calendario día/semana + WhatsApp)
 */

import { APP_CONFIG, isSupabaseConfigured, buildCancelWhatsAppMessage } from './config.js';
import {
  fetchAdminBookings,
  updateBookingStatus,
  verifyAdminPin,
  isHardeningReady,
} from './supabase.js';
import { formatPrice, escapeHtml, showToast, buildWhatsAppUrl, formatFechaISO } from './utils.js';

const SESSION_PIN_KEY = 'feryza_admin_pin';
const SLOT_PX = 52;
const GRID_START = 10 * 60;
const GRID_END = 21 * 60;
const INTERVAL = APP_CONFIG.businessHours.slotInterval;

const loginEl = document.getElementById('adminLogin');
const panelEl = document.getElementById('adminPanel');
const listEl = document.getElementById('bookingsList');
const countEl = document.getElementById('adminCount');
const configWarn = document.getElementById('configWarn');
const pinForm = document.getElementById('pinForm');
const pinInput = document.getElementById('adminPin');
const pinError = document.getElementById('pinError');
const calLabel = document.getElementById('adminCalLabel');
const sheetEl = document.getElementById('adminSheet');
const sheetBody = document.getElementById('sheetBody');

let bookingsCache = [];
let viewMode = window.innerWidth < 800 ? 'day' : 'week';
let cursor = startOfDay(new Date());

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function toISODate(d) {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

function mondayOf(d) {
  const copy = startOfDay(d);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

function addDays(d, n) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function getPin() {
  return sessionStorage.getItem(SESSION_PIN_KEY) || '';
}

function isLoggedIn() {
  return !!getPin();
}

function setLoggedIn(pin) {
  if (pin) sessionStorage.setItem(SESSION_PIN_KEY, pin);
  else sessionStorage.removeItem(SESSION_PIN_KEY);
}

function showPanel() {
  loginEl.classList.add('hidden');
  panelEl.classList.remove('hidden');
  syncViewButtons();
  loadBookings();
}

function showLogin() {
  panelEl.classList.add('hidden');
  loginEl.classList.remove('hidden');
  pinInput.value = '';
  pinError.textContent = '';
  closeSheet();
}

function cancelMessageFor(booking) {
  return buildCancelWhatsAppMessage({
    ...booking,
    fechaLabel: formatFechaISO(booking.fecha),
  });
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

function timeSlots() {
  const slots = [];
  for (let t = GRID_START; t + INTERVAL <= GRID_END; t += INTERVAL) {
    const h = Math.floor(t / 60);
    const m = t % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
  return slots;
}

function parseMinutes(time) {
  const [h, m] = String(time).split(':').map(Number);
  return h * 60 + m;
}

function rangeISO() {
  if (viewMode === 'day') {
    const iso = toISODate(cursor);
    return { fromISO: iso, toISO: iso };
  }
  const mon = mondayOf(cursor);
  return { fromISO: toISODate(mon), toISO: toISODate(addDays(mon, 6)) };
}

function syncViewButtons() {
  document.getElementById('btnCalDay').classList.toggle('is-active', viewMode === 'day');
  document.getElementById('btnCalWeek').classList.toggle('is-active', viewMode === 'week');
}

function updateCalLabel() {
  if (viewMode === 'day') {
    calLabel.textContent = cursor.toLocaleDateString('es-CL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    return;
  }
  const mon = mondayOf(cursor);
  const sun = addDays(mon, 6);
  calLabel.textContent = `${mon.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })} – ${sun.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}`;
}

function bookingsForFecha(iso) {
  return bookingsCache.filter((b) => b.fecha === iso && b.status !== 'cancelled');
}

function eventStyle(booking) {
  const start = parseMinutes(booking.time);
  const top = ((start - GRID_START) / INTERVAL) * SLOT_PX;
  const height = Math.max((booking.duration / INTERVAL) * SLOT_PX - 4, 36);
  return `top:${top}px;height:${height}px`;
}

function eventClass(booking) {
  if (booking.status === 'completed') return 'week-event week-event--done';
  return 'week-event';
}

function renderEventLabel(b) {
  const done = b.status === 'completed';
  const price = done ? ` · ${formatPrice(b.total || 0)}` : '';
  return `
    <strong>${escapeHtml(b.time)}${done ? ' ✓' : ''}</strong>
    <span>${escapeHtml(b.cliente.nombre)}</span>
    <em>${escapeHtml(b.serviceName)}${price}</em>
  `;
}

function renderDayView() {
  const iso = toISODate(cursor);
  const slots = timeSlots();
  const items = bookingsForFecha(iso);
  const height = slots.length * SLOT_PX;

  listEl.innerHTML = `
    <div class="day-cal" style="--slot-h:${SLOT_PX}px">
      <div class="day-times">
        ${slots.map((s) => `<div class="day-time">${s}</div>`).join('')}
      </div>
      <div class="day-track" style="height:${height}px">
        ${slots.map(() => `<div class="day-line" style="height:${SLOT_PX}px"></div>`).join('')}
        ${items.map((b) => `
          <button type="button" class="${eventClass(b)}" style="${eventStyle(b)}" data-open="${escapeHtml(b.id)}">
            ${renderEventLabel(b)}
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

function renderWeekView() {
  const mon = mondayOf(cursor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  const slots = timeSlots();
  const height = slots.length * SLOT_PX;
  const todayISO = toISODate(new Date());

  listEl.innerHTML = `
    <div class="week-cal" style="--slot-h:${SLOT_PX}px">
      <div class="week-head">
        <div class="week-corner"></div>
        ${days.map((d) => {
          const iso = toISODate(d);
          const name = d.toLocaleDateString('es-CL', { weekday: 'short' });
          return `<div class="week-day-head${iso === todayISO ? ' is-today' : ''}">
            <span>${escapeHtml(name)}</span>
            <strong>${d.getDate()}</strong>
          </div>`;
        }).join('')}
      </div>
      <div class="week-body">
        <div class="week-times">
          ${slots.map((s) => `<div class="day-time">${s}</div>`).join('')}
        </div>
        ${days.map((d) => {
          const iso = toISODate(d);
          const items = bookingsForFecha(iso);
          return `<div class="week-col" style="height:${height}px">
            ${slots.map(() => `<div class="day-line" style="height:${SLOT_PX}px"></div>`).join('')}
            ${items.map((b) => `
              <button type="button" class="${eventClass(b)}" style="${eventStyle(b)}" data-open="${escapeHtml(b.id)}">
                ${renderEventLabel(b)}
              </button>
            `).join('')}
          </div>`;
        }).join('')}
      </div>
    </div>
  `;
}

function renderCalendar() {
  const { fromISO, toISO } = rangeISO();
  const inView = bookingsCache.filter(
    (b) => b.fecha >= fromISO && b.fecha <= toISO && b.status !== 'cancelled',
  );
  const confirmed = inView.filter((b) => b.status === 'confirmed');
  const completed = inView.filter((b) => b.status === 'completed');
  const totalDone = completed.reduce((sum, b) => sum + (Number(b.total) || 0), 0);

  if (inView.length === 0) {
    countEl.textContent = 'Sin citas en esta vista';
  } else {
    const parts = [];
    if (confirmed.length) {
      parts.push(`${confirmed.length} pendiente${confirmed.length === 1 ? '' : 's'}`);
    }
    if (completed.length) {
      parts.push(`${completed.length} completada${completed.length === 1 ? '' : 's'} · ${formatPrice(totalDone)}`);
    }
    countEl.textContent = parts.join(' · ');
  }

  updateCalLabel();
  if (viewMode === 'day') renderDayView();
  else renderWeekView();
}

function openSheet(id) {
  const b = bookingsCache.find((x) => x.id === id);
  if (!b) return;
  const canAct = b.status === 'confirmed';
  const waCliente = buildWhatsAppUrl(b.cliente.telefono);
  const cancelWaUrl = buildWhatsAppUrl(b.cliente.telefono, cancelMessageFor(b));
  sheetBody.innerHTML = `
    <div class="sheet-top">
      <h2 id="sheetTitle">${escapeHtml(b.time)} · ${escapeHtml(b.serviceName)}</h2>
      ${statusBadge(b.status)}
    </div>
    <div class="admin-card-meta">
      <div><span class="admin-meta-label">Fecha</span> ${escapeHtml(formatFechaISO(b.fecha))}</div>
      <div><span class="admin-meta-label">Cliente</span> ${escapeHtml(b.cliente.nombre)}</div>
      <div><span class="admin-meta-label">WhatsApp</span> <a class="admin-wa-link" href="${waCliente.replace(/"/g, '&quot;')}" target="_blank" rel="noopener noreferrer">${escapeHtml(b.cliente.telefono)}</a></div>
      <div><span class="admin-meta-label">Pago</span> ${escapeHtml(b.pago || '—')} · ${formatPrice(b.total || 0)}</div>
    </div>
    <div class="admin-card-actions">
      ${canAct ? `
        <button type="button" class="btn-continue admin-btn-sm" data-action="complete" data-id="${escapeHtml(b.id)}">Completada</button>
        <a class="btn-wa-cancel admin-btn-sm" href="${cancelWaUrl.replace(/"/g, '&quot;')}" target="_blank" rel="noopener noreferrer" data-action="cancel-wa" data-id="${escapeHtml(b.id)}">Cancelar por WhatsApp</a>
      ` : `
        <a class="btn-sec admin-btn-sm" href="${waCliente.replace(/"/g, '&quot;')}" target="_blank" rel="noopener noreferrer">WhatsApp cliente</a>
      `}
    </div>
  `;
  sheetEl.classList.remove('hidden');
}

function closeSheet() {
  sheetEl.classList.add('hidden');
  sheetBody.innerHTML = '';
}

async function loadBookings() {
  if (!isSupabaseConfigured()) {
    configWarn.classList.remove('hidden');
    countEl.textContent = 'Supabase no configurado';
    listEl.innerHTML = '';
    return;
  }

  const hardened = await isHardeningReady();
  configWarn.classList.toggle('hidden', hardened);

  countEl.textContent = 'Cargando…';
  listEl.innerHTML = '<p class="admin-loading">Cargando agenda…</p>';

  try {
    const { fromISO, toISO } = rangeISO();
    bookingsCache = await fetchAdminBookings(getPin(), { fromISO, toISO });
    renderCalendar();
  } catch (err) {
    console.error('[admin] Error al cargar:', err);
    countEl.textContent = 'Error al cargar';
    listEl.innerHTML = `<div class="admin-empty"><p>No se pudieron cargar las citas.</p><p class="admin-empty-hint">${escapeHtml(err.message || 'Error')}</p></div>`;
    showToast('Error al cargar citas', 'error');
  }
}

async function handleStatusChange(id, status) {
  try {
    await updateBookingStatus(getPin(), id, status);
    showToast(
      status === 'completed' ? 'Cita marcada como completada' : 'Cita cancelada',
      'success',
    );
    closeSheet();
    await loadBookings();
  } catch (err) {
    console.error('[admin] Error al actualizar:', err);
    showToast('No se pudo actualizar la cita', 'error');
  }
}

async function cancelViaWhatsApp(id) {
  await handleStatusChange(id, 'cancelled');
}

pinForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  pinError.textContent = '';
  const pin = pinInput.value.trim();
  const btn = document.getElementById('btnPin');
  btn.disabled = true;

  try {
    const ok = await verifyAdminPin(pin);
    if (!ok) {
      pinError.textContent = 'PIN incorrecto';
      pinInput.classList.add('error');
      return;
    }
    pinInput.classList.remove('error');
    setLoggedIn(pin);
    showPanel();
  } catch (err) {
    pinError.textContent = err.message || 'No se pudo validar el PIN';
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('btnLogout').addEventListener('click', () => {
  setLoggedIn('');
  showLogin();
});

document.getElementById('btnRefresh').addEventListener('click', () => {
  loadBookings();
});

document.getElementById('btnCalDay').addEventListener('click', () => {
  viewMode = 'day';
  syncViewButtons();
  loadBookings();
});

document.getElementById('btnCalWeek').addEventListener('click', () => {
  viewMode = 'week';
  syncViewButtons();
  loadBookings();
});

document.getElementById('adminCalPrev').addEventListener('click', () => {
  cursor = addDays(cursor, viewMode === 'day' ? -1 : -7);
  loadBookings();
});

document.getElementById('adminCalNext').addEventListener('click', () => {
  cursor = addDays(cursor, viewMode === 'day' ? 1 : 7);
  loadBookings();
});

document.getElementById('btnCalToday').addEventListener('click', () => {
  cursor = startOfDay(new Date());
  loadBookings();
});

listEl.addEventListener('click', (e) => {
  const openBtn = e.target.closest('[data-open]');
  if (openBtn) openSheet(openBtn.dataset.open);
});

sheetEl.addEventListener('click', (e) => {
  if (e.target.id === 'sheetClose') closeSheet();
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const { action, id } = btn.dataset;
  if (!id) return;
  if (action === 'complete') {
    e.preventDefault();
    handleStatusChange(id, 'completed');
    return;
  }
  if (action === 'cancel-wa') {
    if (!confirm('Se abrirá WhatsApp con el mensaje de cancelación y la cita quedará cancelada. ¿Continuar?')) {
      e.preventDefault();
      return;
    }
    cancelViaWhatsApp(id);
  }
});

if (isLoggedIn()) showPanel();
else showLogin();
