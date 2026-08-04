/**
 * calendar.js — Calendario Feryza Barber (abre domingo con horario reducido)
 */

import { APP_CONFIG } from './config.js';
import { getAvailableSlots } from './availability.js';
import { toISODate } from './utils.js';

let calYear;
let calMonth;
let callbacksRef = {};

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

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
    if (state.date && state.time) callbacks.onContinue?.();
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
        document.getElementById('btn3').disabled = true;
        callbacksRef.onDateSelect?.();
        await renderSlots(state, callbacksRef);
      });
    }
    grid.appendChild(el);
  }
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
    return;
  }

  available.forEach((slot) => {
    const btn = document.createElement('button');
    btn.className = 'slot';
    btn.textContent = slot;
    if (state.time === slot) btn.classList.add('selected');

    btn.addEventListener('click', () => {
      grid.querySelectorAll('.slot').forEach((s) => s.classList.remove('selected'));
      btn.classList.add('selected');
      state.time = slot;
      document.getElementById('btn3').disabled = false;
      callbacks.onTimeSelect?.();
    });
    grid.appendChild(btn);
  });
}

export async function refreshSlotsIfNeeded(state) {
  if (state.date && state.barber && state.service) {
    state.time = null;
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
  document.getElementById('slotsWrap').hidden = true;
  document.getElementById('btn3').disabled = true;
  renderCalendar(state);
}
