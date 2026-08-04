/**
 * app.js — Orquestador Eryza Barber
 */

import { APP_CONFIG } from './config.js';
import { SERVICES, BARBERS, PAYMENT_METHODS } from './data.js';
import { state, saveState, clearStorage, restoreState, resetState } from './state.js';
import { initCalendar, renderCalendar, renderSlots, refreshSlotsIfNeeded, resetCalendarView } from './calendar.js';
import { buildCalendarURL } from './calendar-url.js';
import { sendEmails, initEmailJS } from './email.js';
import { scheduleReminder } from './reminder.js';
import { saveBooking, getBarberNameById } from './availability.js';
import { getServiceIcon, SUMMARY_ICONS, PAGO_ICONS } from './icons.js';
import {
  formatPrice, formatDateShort, formatDateLong, toISODate, escapeHtml,
  isValidEmail, isValidChilePhone, debounce, showToast,
} from './utils.js';

const STEPS = [
  { label: 'Servicio' },
  { label: 'Barbero' },
  { label: 'Horario' },
  { label: 'Datos' },
  { label: 'Pago' },
];

const ACCENT = '#9B8EC4';
const MUTED_RING = '#3A3545';

function renderProgress(active) {
  const track = document.getElementById('progressTrack');
  track.innerHTML = '';

  STEPS.forEach((s, i) => {
    const stepNum = i + 1;
    const isDone = stepNum < active;
    const isActive = stepNum === active;
    const div = document.createElement('div');
    div.className = `pt-step ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}`;
    const doneStroke = isDone ? ACCENT : (isActive ? ACCENT : MUTED_RING);
    const innerStroke = isDone ? ACCENT : MUTED_RING;

    div.innerHTML = `
      <div class="pt-node">
        <svg viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="14" stroke="${doneStroke}" stroke-width="1.6" opacity="${isDone || isActive ? 1 : 0.5}"/>
          <circle cx="16" cy="16" r="9" stroke="${innerStroke}" stroke-width="1.6" opacity="${isDone || isActive ? 1 : 0.4}"/>
          ${isDone
            ? `<path d="M10 16l4 4 8-8" stroke="${ACCENT}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
            : `<text x="16" y="20" text-anchor="middle" font-family="DM Sans,sans-serif" font-weight="700" font-size="10" fill="${isActive ? ACCENT : '#9A95A3'}">${stepNum}</text>`
          }
        </svg>
      </div>
      <div class="pt-label">${s.label}</div>
      ${i < STEPS.length - 1 ? `<div class="pt-line ${isDone ? 'done' : ''}"></div>` : ''}
    `;
    track.appendChild(div);
  });
}

function goTo(step) {
  document.querySelectorAll('.step-panel').forEach((p) => p.classList.remove('active'));
  document.getElementById(`step${step}`).classList.add('active');
  state.currentStep = step;
  renderProgress(step > 5 ? 5 : step);
  updateSummary();
  updateWhatsAppFab(step);
  updateMobileSummaryBar();

  const back = document.getElementById('btnBack');
  back.classList.toggle('hidden', step === 1 || step === 6);

  if (step === 3) refreshSlotsIfNeeded(state);
  if (step < 6) saveState();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateWhatsAppFab(step) {
  document.getElementById('whatsappFab').classList.toggle('hidden', step === 6);
}

function updateMobileSummaryBar() {
  const bar = document.getElementById('mobileSummaryBar');
  const step = state.currentStep;
  const show = step >= 2 && step <= 5 && state.service;

  if (!show) {
    bar.classList.add('hidden');
    return;
  }

  const parts = [state.service.name];
  if (state.barber) parts.push(state.barber.name);
  if (state.time) parts.push(state.time);

  bar.classList.remove('hidden');
  bar.innerHTML = `
    <span class="mobile-summary-text">${escapeHtml(parts.join(' · '))}</span>
    <span class="mobile-summary-price">${formatPrice(state.service.price)}</span>
  `;
}

function renderServicios() {
  const list = document.getElementById('servicios-list');
  list.innerHTML = '';

  SERVICES.forEach((svc) => {
    const btn = document.createElement('button');
    const badge = svc.id === 'membresia-4'
      ? '<span class="sel-card-badge">Membresía</span>'
      : (svc.featured ? '<span class="sel-card-badge">Más pedido</span>' : '');

    btn.className = `sel-card${svc.featured || svc.id === 'membresia-4' ? ' sel-card--featured' : ''}`;
    btn.dataset.id = svc.id;
    btn.innerHTML = `
      <div class="sel-card-head">
        ${getServiceIcon(svc)}
        <div class="sel-card-body">
          <div class="sel-card-name">${escapeHtml(svc.name)}</div>
          <div class="sel-card-desc">${escapeHtml(svc.desc)} · ${svc.dur} min</div>
        </div>
        <div class="sel-card-meta">${formatPrice(svc.price)}</div>
        <div class="sel-card-check"></div>
      </div>
      ${badge}
    `;
    btn.addEventListener('click', () => {
      list.querySelectorAll('.sel-card').forEach((c) => c.classList.remove('selected'));
      btn.classList.add('selected');
      state.service = svc;
      document.getElementById('btn1').disabled = false;
      saveState();
    });
    list.appendChild(btn);
  });

  document.getElementById('btn1').addEventListener('click', () => {
    if (!state.service) return;
    if (BARBERS.length === 1) {
      state.barber = BARBERS[0];
      goTo(3);
    } else {
      goTo(2);
    }
  });
}

function renderBarberos() {
  const list = document.getElementById('barberos-list');
  list.innerHTML = '';

  BARBERS.forEach((b) => {
    const btn = document.createElement('button');
    btn.className = 'barber-card';
    btn.dataset.id = b.id;
    btn.innerHTML = `
      <div class="barber-avatar">
        <svg viewBox="0 0 60 60" fill="none">
          <circle cx="30" cy="30" r="30" fill="${b.color}33"/>
          <text x="30" y="37" text-anchor="middle" font-family="DM Sans,sans-serif" font-weight="700" font-size="20" fill="${b.color}">${b.letter}</text>
        </svg>
      </div>
      <div class="barber-name">${escapeHtml(b.name)}</div>
      <div class="barber-tag">${escapeHtml(b.tag)}</div>
    `;
    btn.addEventListener('click', () => {
      list.querySelectorAll('.barber-card').forEach((c) => c.classList.remove('selected'));
      btn.classList.add('selected');
      state.barber = b;
      state.time = null;
      document.getElementById('btn2').disabled = false;
      refreshSlotsIfNeeded(state);
      saveState();
    });
    list.appendChild(btn);
  });

  document.getElementById('btn2').addEventListener('click', () => {
    if (state.barber) goTo(3);
  });
}

function initDatos() {
  const debouncedSave = debounce(saveState, 400);
  ['nombre', 'telefono', 'correo'].forEach((id) => {
    document.getElementById(id).addEventListener('input', debouncedSave);
  });

  document.getElementById('btn4').addEventListener('click', () => {
    const nombre = document.getElementById('nombre').value.trim();
    const telefono = document.getElementById('telefono').value.trim();
    const correo = document.getElementById('correo').value.trim();
    let valid = true;

    const fields = [
      { id: 'nombre', err: 'err-nombre', msg: 'Ingresa tu nombre', check: () => !!nombre },
      { id: 'telefono', err: 'err-telefono', msg: 'Ingresa un teléfono válido', check: () => isValidChilePhone(telefono) },
      { id: 'correo', err: 'err-correo', msg: 'Ingresa un correo válido', check: () => isValidEmail(correo) },
    ];

    fields.forEach(({ id, err, msg, check }) => {
      document.getElementById(err).textContent = '';
      document.getElementById(id).classList.remove('error');
      if (!check()) {
        document.getElementById(err).textContent = msg;
        document.getElementById(id).classList.add('error');
        valid = false;
      }
    });

    if (!valid) return;

    state.nombre = nombre;
    state.telefono = telefono;
    state.correo = correo;
    goTo(5);
  });
}

function renderPago() {
  const list = document.getElementById('pago-list');
  list.innerHTML = '';

  PAYMENT_METHODS.forEach((pm) => {
    const btn = document.createElement('button');
    btn.className = 'pago-card';
    btn.innerHTML = `
      <div class="pago-icon">${PAGO_ICONS[pm.icon]}</div>
      <div class="pago-text">
        <div class="pago-name">${escapeHtml(pm.name)}</div>
        <div class="pago-desc">${escapeHtml(pm.desc)}</div>
      </div>
      <div class="pago-radio"></div>
    `;
    btn.addEventListener('click', () => {
      list.querySelectorAll('.pago-card').forEach((c) => c.classList.remove('selected'));
      btn.classList.add('selected');
      state.pago = pm;
      document.getElementById('btn5').disabled = false;
      updateSummary();
      saveState();
    });
    list.appendChild(btn);
  });

  document.getElementById('btn5').addEventListener('click', () => {
    if (state.pago) confirmarReserva();
  });
}

function buildSummaryRows() {
  const rows = [
    { icon: SUMMARY_ICONS.scissors, label: 'Servicio', val: state.service?.name, num: state.service ? formatPrice(state.service.price) : null },
    { icon: SUMMARY_ICONS.person, label: 'Barbero', val: state.barber?.name },
    { icon: SUMMARY_ICONS.cal, label: 'Fecha', val: formatDateShort(state.date) },
    { icon: SUMMARY_ICONS.clock, label: 'Hora', val: state.time },
    { icon: SUMMARY_ICONS.pay, label: 'Pago', val: state.pago?.name },
  ];

  return rows.map((r) => `
    <div class="sum-row">
      <svg class="sum-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">${r.icon}</svg>
      <div>
        <div class="sum-label">${r.label}</div>
        <div class="sum-val">${r.val ? escapeHtml(r.val) : '<span class="sum-placeholder">—</span>'}</div>
        ${r.num ? `<div class="sum-val num">${r.num}</div>` : ''}
      </div>
    </div>
  `).join('');
}

function updateSummary() {
  const rows = buildSummaryRows();
  document.getElementById('summaryBody').innerHTML = rows;
  document.getElementById('summaryMobile').innerHTML = state.currentStep === 5
    ? `<div class="summary-mobile-box"><div class="summary-mobile-title">Resumen</div>${rows}</div>`
    : '';
}

async function confirmarReserva() {
  const btn = document.getElementById('btn5');
  btn.disabled = true;
  btn.textContent = 'Confirmando…';

  try {
    const saved = await saveBooking({
      barberId: state.barber.id,
      fecha: toISODate(state.date),
      time: state.time,
      duration: state.service.dur,
      serviceId: state.service.id,
      cliente: { nombre: state.nombre, telefono: state.telefono, correo: state.correo },
    });

    if (state.barber.id === 'any') {
      state.assignedBarberName = getBarberNameById(saved.barberId);
    }

    const [emailResult] = await Promise.all([
      sendEmails(state),
      scheduleReminder(state),
    ]);

    document.getElementById('calLink').href = buildCalendarURL(state);
    renderConfirmation();
    clearStorage();
    goTo(6);

    if (!emailResult.sent) {
      showToast('Reserva guardada. Te contactaremos por WhatsApp si hace falta.', 'info', 5000);
    }
  } catch (err) {
    console.error('[app] Error al confirmar:', err);
    showToast('No se pudo confirmar la reserva. Intenta otro horario.', 'error');
    btn.disabled = false;
    btn.innerHTML = `Confirmar reserva <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 6L9 17l-5-5"/></svg>`;
    await refreshSlotsIfNeeded(state);
  }
}

function renderConfirmation() {
  const { service, barber, date, time, pago } = state;
  const barberDisplay = state.assignedBarberName
    ? `${barber.name} (${state.assignedBarberName})`
    : barber.name;

  document.getElementById('confirmDetail').innerHTML = `
    <div class="confirm-row"><span>Servicio</span><span>${escapeHtml(service.name)}</span></div>
    <div class="confirm-row"><span>Barbero</span><span>${escapeHtml(barberDisplay)}</span></div>
    <div class="confirm-row"><span>Fecha</span><span>${escapeHtml(formatDateLong(date))}</span></div>
    <div class="confirm-row"><span>Hora</span><span>${escapeHtml(time)}</span></div>
    <div class="confirm-row"><span>Duración</span><span>${service.dur} min</span></div>
    <div class="confirm-row"><span>Pago</span><span>${escapeHtml(pago.name)}</span></div>
    <div class="confirm-row"><span>Total</span><span class="confirm-total">${formatPrice(service.price)}</span></div>
  `;
}

function restoreFormFields() {
  if (state.nombre) document.getElementById('nombre').value = state.nombre;
  if (state.telefono) document.getElementById('telefono').value = state.telefono;
  if (state.correo) document.getElementById('correo').value = state.correo;
}

async function restoreUISelections() {
  if (state.service) {
    document.querySelector(`#servicios-list [data-id="${state.service.id}"]`)?.classList.add('selected');
    document.getElementById('btn1').disabled = false;
  }
  if (state.barber) {
    document.querySelector(`#barberos-list [data-id="${state.barber.id}"]`)?.classList.add('selected');
    document.getElementById('btn2').disabled = false;
  }
  if (state.pago) {
    const idx = PAYMENT_METHODS.findIndex((p) => p.id === state.pago.id);
    document.querySelectorAll('#pago-list .pago-card')[idx]?.classList.add('selected');
    document.getElementById('btn5').disabled = false;
  }
  if (state.date) {
    renderCalendar(state);
    if (state.time && state.service) {
      await renderSlots(state, { onTimeSelect: () => updateSummary() });
      document.getElementById('btn3').disabled = false;
    }
  }
}

function resetBooking() {
  clearStorage();
  resetState();
  state.assignedBarberName = undefined;
  if (BARBERS.length === 1) state.barber = BARBERS[0];

  document.querySelectorAll('.sel-card, .barber-card, .pago-card').forEach((c) => c.classList.remove('selected'));
  document.getElementById('nombre').value = '';
  document.getElementById('telefono').value = '';
  document.getElementById('correo').value = '';
  document.getElementById('btn1').disabled = true;
  document.getElementById('btn2').disabled = true;
  document.getElementById('btn5').disabled = true;

  resetCalendarView(state);
  goTo(1);
}

function init() {
  document.getElementById('whatsappFab').href = `https://wa.me/${APP_CONFIG.whatsapp}`;

  initEmailJS();
  renderServicios();
  renderBarberos();
  renderPago();
  initDatos();

  if (BARBERS.length === 1) {
    state.barber = BARBERS[0];
  }

  initCalendar(state, {
    onDateSelect: () => updateSummary(),
    onTimeSelect: () => { updateSummary(); saveState(); },
    onContinue: () => goTo(4),
  });

  document.getElementById('btnBack').addEventListener('click', () => {
    if (state.currentStep <= 1) return;
    if (state.currentStep === 3 && BARBERS.length === 1) {
      goTo(1);
      return;
    }
    goTo(state.currentStep - 1);
  });

  document.getElementById('btnNuevaReserva').addEventListener('click', resetBooking);

  const restored = restoreState();
  if (restored) {
    restoreFormFields();
    restoreUISelections();
    goTo(state.currentStep);
  } else {
    renderProgress(1);
    updateSummary();
    updateWhatsAppFab(1);
    updateMobileSummaryBar();
  }
}

init();
