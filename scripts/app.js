/**
 * app.js — Orquestador Feryza Barber
 */

import { APP_CONFIG } from './config.js';
import { SERVICES, BARBERS, PAYMENT_METHODS, BANK_DETAILS, BARBA_ADDON_PRICE, getActiveService } from './data.js';
import { state, saveState, clearStorage, restoreState, resetState } from './state.js';
import { initCalendar, renderCalendar, renderSlots, refreshSlotsIfNeeded, resetCalendarView } from './calendar.js';
import { buildCalendarURL } from './calendar-url.js';
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

const ACCENT = '#370D5E';
const MUTED_RING = '#D7C6EA';

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
            : `<text x="16" y="20" text-anchor="middle" font-family="Barlow,sans-serif" font-weight="700" font-size="10" fill="${isActive ? ACCENT : '#5C4E6E'}">${stepNum}</text>`
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
  const active = getActiveService(state.service, state.addBarba);
  const show = step >= 2 && step <= 5 && active;

  if (!show) {
    bar.classList.add('hidden');
    return;
  }

  const parts = [active.name];
  if (state.barber) parts.push(state.barber.name);
  if (state.time) parts.push(state.time);

  bar.classList.remove('hidden');
  bar.innerHTML = `
    <span class="mobile-summary-text">${escapeHtml(parts.join(' · '))}</span>
    <span class="mobile-summary-price">${formatPrice(active.price)}</span>
  `;
}

function renderServicios() {
  const list = document.getElementById('servicios-list');
  list.innerHTML = '';

  SERVICES.forEach((svc) => {
    const btn = document.createElement('button');
    const badge = svc.id === 'membresia-4'
      ? '<span class="sel-card-badge">Ahorro</span>'
      : (svc.featured ? '<span class="sel-card-badge">Más pedido</span>' : '');

    const includes = (svc.includes ?? [])
      .map((item) => `<li>${escapeHtml(item)}</li>`)
      .join('');

    btn.type = 'button';
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
      <ul class="sel-card-includes">${includes}</ul>
      ${badge}
    `;
    btn.addEventListener('click', () => {
      list.querySelectorAll('.sel-card').forEach((c) => c.classList.remove('selected'));
      btn.classList.add('selected');
      state.service = svc;
      if (!svc.allowBarbaAddon) state.addBarba = false;
      document.getElementById('btn1').disabled = false;
      renderBarbaAddon();
      saveState();
    });
    list.appendChild(btn);
  });

  renderBarbaAddon();

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

function renderBarbaAddon() {
  const wrap = document.getElementById('barbaAddon');
  if (!wrap) return;

  const show = state.service?.allowBarbaAddon;
  wrap.classList.toggle('hidden', !show);
  if (!show) return;

  const isCorte = state.service?.id === 'corte';
  const title = isCorte
    ? '🔥 Promo: Corte + Barba por $10.000'
    : '¿Sumas la barba?';
  const desc = isCorte
    ? `Suma barba por solo +${formatPrice(BARBA_ADDON_PRICE)} en el mismo turno (Ahorras $1.000)`
    : `Perfilado en el mismo turno de 45 min · +${formatPrice(BARBA_ADDON_PRICE)}`;
  const actionText = state.addBarba
    ? (isCorte ? 'Promo aplicada ✓' : 'Agregada ✓')
    : (isCorte ? 'Aprovechar promo' : 'Agregar');

  wrap.innerHTML = `
    <button type="button" class="addon-card${state.addBarba ? ' selected' : ''}" id="btnAddBarba">
      <div class="addon-copy">
        <div class="addon-title">${escapeHtml(title)}</div>
        <div class="addon-desc">${desc}</div>
      </div>
      <div class="addon-price">${actionText}</div>
    </button>
  `;

  document.getElementById('btnAddBarba').addEventListener('click', (e) => {
    e.preventDefault();
    state.addBarba = !state.addBarba;
    renderBarbaAddon();
    updateSummary();
    saveState();
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
          <text x="30" y="37" text-anchor="middle" font-family="Barlow,sans-serif" font-weight="700" font-size="20" fill="${b.color}">${b.letter}</text>
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
      { id: 'telefono', err: 'err-telefono', msg: 'Ingresa un WhatsApp válido', check: () => isValidChilePhone(telefono) },
      {
        id: 'correo',
        err: 'err-correo',
        msg: 'Correo no válido',
        check: () => !correo || isValidEmail(correo),
      },
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
    state.correo = correo || '';
    goTo(5);
  });
}

function renderBankBox(show) {
  const box = document.getElementById('bankBox');
  if (!show) {
    box.classList.add('hidden');
    box.innerHTML = '';
    return;
  }

  const b = BANK_DETAILS;
  box.classList.remove('hidden');
  box.innerHTML = `
    <div class="bank-box-title">Datos para transferir</div>
    <dl class="bank-rows">
      <div><dt>Nombre</dt><dd>${escapeHtml(b.nombre)}</dd></div>
      <div><dt>RUT</dt><dd>${escapeHtml(b.rut)}</dd></div>
      <div><dt>Email</dt><dd>${escapeHtml(b.email)}</dd></div>
      <div><dt>Tipo</dt><dd>${escapeHtml(b.tipoCuenta)}</dd></div>
      <div><dt>Nº cuenta</dt><dd class="bank-num">${escapeHtml(b.numero)}</dd></div>
      <div><dt>Banco</dt><dd>${escapeHtml(b.banco)}</dd></div>
    </dl>
  `;
}

function renderPago() {
  const list = document.getElementById('pago-list');
  list.innerHTML = '';

  PAYMENT_METHODS.forEach((pm) => {
    const btn = document.createElement('button');
    btn.type = 'button';
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
      renderBankBox(pm.id === 'transferencia');
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
  const active = getActiveService(state.service, state.addBarba);
  const rows = [
    { icon: SUMMARY_ICONS.scissors, label: 'Servicio', val: active?.name, num: active ? formatPrice(active.price) : null },
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
  btn.textContent = 'Guardando cita…';

  try {
    const active = getActiveService(state.service, state.addBarba);
    const saved = await saveBooking({
      barberId: state.barber.id,
      fecha: toISODate(state.date),
      time: state.time,
      duration: active.dur,
      serviceId: active.id,
      serviceName: active.name,
      pago: state.pago.name,
      total: active.price,
      cliente: { nombre: state.nombre, telefono: state.telefono, correo: state.correo || '' },
    });

    if (state.barber.id === 'any') {
      state.assignedBarberName = getBarberNameById(saved.barberId);
    }

    await scheduleReminder(state).catch(() => {});

    document.getElementById('calLink').href = buildCalendarURL(state);
    const waUrl = buildConfirmWhatsAppUrl();
    renderConfirmation();
    clearStorage();
    goTo(6);
    showToast('Cita agendada. Abriendo WhatsApp…', 'success');

    // Abre WhatsApp para enviar el mensaje de confirmación
    try {
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    } catch {
      /* si el navegador bloquea el popup, el botón de WhatsApp en el paso 6 queda disponible */
    }
  } catch (err) {
    console.error('[app] Error al confirmar:', err);
    const msg = err?.code === 'SLOT_TAKEN'
      ? err.message
      : err?.code === 'SLOT_BLOCKED'
        ? err.message
        : 'No se pudo agendar la cita. Intenta otro horario.';
    showToast(msg, 'error');
    btn.disabled = false;
    btn.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg> Confirmar cita por WhatsApp`;
    await refreshSlotsIfNeeded(state);
  }
}

function buildConfirmWhatsAppUrl() {
  const active = getActiveService(state.service, state.addBarba);
  const { date, time, pago, nombre, telefono } = state;
  const barberName = state.assignedBarberName || state.barber?.name || 'Fernando';
  const text = `Hola, soy ${nombre} (tel: ${telefono}). Confirmo mi cita en Feryza Barber:\n` +
    `• Servicio: ${active.name} (${formatPrice(active.price)})\n` +
    `• Barbero: ${barberName}\n` +
    `• Fecha: ${formatDateLong(date)}\n` +
    `• Hora: ${time}\n` +
    `• Pago: ${pago.name}\n\n` +
    `¡Llegaré 10 minutos antes!`;
  return `https://wa.me/${APP_CONFIG.whatsapp}?text=${encodeURIComponent(text)}`;
}

function renderConfirmation() {
  const active = getActiveService(state.service, state.addBarba);
  const { barber, date, time, pago } = state;
  const barberDisplay = state.assignedBarberName
    ? `${barber.name} (${state.assignedBarberName})`
    : barber.name;

  document.getElementById('confirmWa').href = buildConfirmWhatsAppUrl();

  let extra = '';
  if (pago.id === 'transferencia') {
    const b = BANK_DETAILS;
    extra = `
      <div class="confirm-bank">
        <div class="bank-box-title">Transferencia</div>
        <div class="confirm-row"><span>Nombre</span><span>${escapeHtml(b.nombre)}</span></div>
        <div class="confirm-row"><span>RUT</span><span>${escapeHtml(b.rut)}</span></div>
        <div class="confirm-row"><span>Cuenta</span><span>${escapeHtml(b.numero)}</span></div>
        <div class="confirm-row"><span>Banco</span><span>${escapeHtml(b.banco)}</span></div>
      </div>
    `;
  }

  document.getElementById('confirmDetail').innerHTML = `
    <div class="confirm-row"><span>Servicio</span><span>${escapeHtml(active.name)}</span></div>
    <div class="confirm-row"><span>Barbero</span><span>${escapeHtml(barberDisplay)}</span></div>
    <div class="confirm-row"><span>Fecha</span><span>${escapeHtml(formatDateLong(date))}</span></div>
    <div class="confirm-row"><span>Hora</span><span>${escapeHtml(time)}</span></div>
    <div class="confirm-row"><span>Duración</span><span>${active.dur} min</span></div>
    <div class="confirm-row"><span>Pago</span><span>${escapeHtml(pago.name)}</span></div>
    <div class="confirm-row"><span>Total</span><span class="confirm-total">${formatPrice(active.price)}</span></div>
    ${extra}
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
    renderBarbaAddon();
  }
  if (state.barber) {
    document.querySelector(`#barberos-list [data-id="${state.barber.id}"]`)?.classList.add('selected');
    document.getElementById('btn2').disabled = false;
  }
  if (state.pago) {
    const idx = PAYMENT_METHODS.findIndex((p) => p.id === state.pago.id);
    document.querySelectorAll('#pago-list .pago-card')[idx]?.classList.add('selected');
    document.getElementById('btn5').disabled = false;
    renderBankBox(state.pago.id === 'transferencia');
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
  state.addBarba = false;
  if (BARBERS.length === 1) state.barber = BARBERS[0];

  document.querySelectorAll('.sel-card, .barber-card, .pago-card').forEach((c) => c.classList.remove('selected'));
  document.getElementById('nombre').value = '';
  document.getElementById('telefono').value = '';
  document.getElementById('correo').value = '';
  document.getElementById('btn1').disabled = true;
  document.getElementById('btn2').disabled = true;
  document.getElementById('btn5').disabled = true;
  renderBankBox(false);
  renderBarbaAddon();

  resetCalendarView(state);
  goTo(1);
}

function init() {
  document.getElementById('whatsappFab').href = `https://wa.me/${APP_CONFIG.whatsapp}`;

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
