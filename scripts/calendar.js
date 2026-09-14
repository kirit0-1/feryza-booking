/**
 * calendar.js — Calendario Feryza Barber (abre domingo con horario reducido)
 */

import { APP_CONFIG, getHoursForDay } from './config.js';
import { SOBRECUPO_PRICE, SOBRECUPO_TIME_LABEL } from './data.js';
import { getAvailableSlots } from './availability.js';
import { toISODate, formatPrice } from './utils.js';

let calYear;
let calMonth;
let callbacksRef = {};

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** Menos de 2 h hasta el cierre = pocas horas / fuera de horario */
const SOBRECUPO_REMAINING_MIN = 120;
const SOBRECUPO_MAX_SLOTS = 2;

export function initCalendar(state, callbacks) {
  callbacksRef = callbacks;
  const today = new Date();
  calYear = today.getFullYear();
  calMonth = today.getMonth();

  document.getElementById('calPrev').addEventListener('click', () => {
    calMonth--;
    if (calMonth < 0) { calMonth = 11; calYear--; }
    renderCalendar(state);
  });

  document.getElementById('calNext').addEventListener('click', () => {
    calMonth++;
    if (calMonth > 11) { calMonth = 0; calYear++; }
    renderCalendar(state);
  });

  document.getElementById('btn3').addEventListener('click', () => {
    if (state.date && (state.time || state.sobrecupo)) callbacks.onContinue?.();
  });

  renderCalendar(state);
}

export function renderCalendar(state) {
  const today = new Date();
  document.getElementById('calMonthLabel').textContent = `${MONTH_NAMES[calMonth]} ${calYear}`;

  const grid = document.getElementById('calGrid');
  grid.innerHTML = '';

  ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'].forEach((d) => {
    const el = document.createElement('div');
    el.className = 'cal-day-name';
    el.textContent = d;
    grid.appendChild(el);
  });

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const closedDays = APP_CONFIG.businessHours.closedDays;

  for (let i = 0; i < offset; i++) {
    const el = document.createElement('div');
    el.className = 'cal-day empty';
    grid.appendChild(el);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const el = document.createElement('div');
    el.className = 'cal-day';
    el.textContent = d;

    const thisDate = new Date(calYear, calMonth, d);
    const isClosed = closedDays.includes(thisDate.getDay());
    const isPast = thisDate < new Date(today.getFullYear(), today.getMonth(), today.getDate());

    if (isClosed || isPast) {
      el.classList.add('disabled');
    } else {
      if (d === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear()) {
        el.classList.add('today');
      }
      if (state.date?.d === d && state.date?.m === calMonth && state.date?.y === calYear) {
        el.classList.add('selected');
      }
      el.addEventListener('click', async () => {
        grid.querySelectorAll('.cal-day').forEach((c) => c.classList.remove('selected'));
        el.classList.add('selected');
        state.date = { d, m: calMonth, y: calYear };
        state.time = null;
        state.sobrecupo = false;
        document.getElementById('btn3').disabled = true;
        callbacksRef.onDateSelect?.();
        await renderSlots(state, callbacksRef);
      });
    }
    grid.appendChild(el);
  }
}

/** Solo hoy: pocas horas restantes, después del cierre, o casi sin cupos */
export function shouldOfferSobrecupo(date, availableCount = 0) {
  if (!date) return false;
  const now = new Date();
  const isToday = date.d === now.getDate()
    && date.m === now.getMonth()
    && date.y === now.getFullYear();
  if (!isToday) return false;

  const hours = getHoursForDay(now.getDay());
  if (!hours) return true;

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const closeMin = hours.close * 60;

  if (nowMin >= closeMin) return true;
  if ((closeMin - nowMin) <= SOBRECUPO_REMAINING_MIN) return true;
  if (availableCount <= SOBRECUPO_MAX_SLOTS) return true;

  return false;
}

function appendSobrecupoButton(state, callbacks, grid) {
  const wrap = document.createElement('div');
  wrap.className = 'sobrecupo-wrap';
  wrap.innerHTML = `
    <button type="button" class="sobrecupo-btn${state.sobrecupo ? ' selected' : ''}" id="btnSobrecupo">
      <div class="sobrecupo-copy">
        <div class="sobrecupo-badge">Sobrecupo</div>
        <div class="sobrecupo-title">¿No te acomodan los horarios?</div>
        <div class="sobrecupo-desc">Pide sobrecupo a ${formatPrice(SOBRECUPO_PRICE)}. Solo se confirma coordinando el horario con el barbero por WhatsApp.</div>
      </div>
      <div class="sobrecupo-price">${formatPrice(SOBRECUPO_PRICE)}</div>
    </button>
  `;
  grid.appendChild(wrap);

  document.getElementById('btnSobrecupo').addEventListener('click', () => {
    grid.querySelectorAll('.slot').forEach((s) => s.classList.remove('selected'));
    state.sobrecupo = true;
    state.time = SOBRECUPO_TIME_LABEL;
    wrap.querySelector('.sobrecupo-btn').classList.add('selected');
    document.getElementById('btn3').disabled = false;
    callbacks.onTimeSelect?.();
  });
}

export async function renderSlots(state, callbacks = callbacksRef) {
  const wrap = document.getElementById('slotsWrap');
  const grid = document.getElementById('slotsGrid');
  const title = document.getElementById('slotsTitle');

  if (!state.date || !state.barber || !state.service) {
    wrap.hidden = true;
    return;
  }

  const { d, m, y } = state.date;
  const dateStr = toISODate(state.date);
  const dayName = DAY_NAMES[new Date(y, m, d).getDay()];
  const duration = state.service.dur;

  title.textContent = `Horas disponibles · ${dayName} ${d} · ${duration} min`;
  grid.innerHTML = '<div class="slots-loading">Cargando horarios…</div>';
  wrap.hidden = false;

  const available = await getAvailableSlots(state.barber.id, dateStr, duration);
  grid.innerHTML = '';

  if (available.length === 0) {
    grid.innerHTML = '<p class="slots-empty">No hay horarios disponibles este día. Prueba otra fecha.</p>';
  } else {
    available.forEach((slot) => {
      const btn = document.createElement('button');
      btn.className = 'slot';
      btn.textContent = slot;
      if (!state.sobrecupo && state.time === slot) btn.classList.add('selected');

      btn.addEventListener('click', () => {
        grid.querySelectorAll('.slot').forEach((s) => s.classList.remove('selected'));
        grid.querySelector('.sobrecupo-btn')?.classList.remove('selected');
        btn.classList.add('selected');
        state.sobrecupo = false;
        state.time = slot;
        document.getElementById('btn3').disabled = false;
        callbacks.onTimeSelect?.();
      });
      grid.appendChild(btn);
    });
  }

  // Al final: opción sobrecupo (nunca al inicio)
  if (shouldOfferSobrecupo(state.date, available.length)) {
    appendSobrecupoButton(state, callbacks, grid);
  }

  if (state.sobrecupo) {
    document.getElementById('btn3').disabled = false;
  }
}

export async function refreshSlotsIfNeeded(state) {
  if (state.date && state.barber && state.service) {
    state.time = null;
    state.sobrecupo = false;
    document.getElementById('btn3').disabled = true;
    await renderSlots(state);
  }
}

export function resetCalendarView(state) {
  const today = new Date();
  calYear = today.getFullYear();
  calMonth = today.getMonth();
  state.date = null;
  state.time = null;
  state.sobrecupo = false;
  document.getElementById('slotsWrap').hidden = true;
  document.getElementById('btn3').disabled = true;
  renderCalendar(state);
}
