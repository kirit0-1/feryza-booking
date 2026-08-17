/**
 * state.js — Estado global con persistencia
 */

import { APP_CONFIG } from './config.js';
import { findServiceById, findBarberById, findPaymentById } from './data.js';

const { stateKey, stateVersion, stateTtlMs } = APP_CONFIG.storage;

export function createInitialState() {
  return {
    currentStep: 1,
    service: null,
    barber: null,
    date: null,
    time: null,
    nombre: '',
    telefono: '',
    correo: '',
    pago: null,
    addBarba: false,
  };
}

export const state = createInitialState();

export function saveState() {
  if (state.currentStep >= 6) return;

  const payload = {
    version: stateVersion,
    savedAt: Date.now(),
    currentStep: state.currentStep,
    serviceId: state.service?.id ?? null,
    barberId: state.barber?.id ?? null,
    date: state.date,
    time: state.time,
    nombre: state.nombre,
    telefono: state.telefono,
    correo: state.correo,
    pagoId: state.pago?.id ?? null,
    addBarba: !!state.addBarba,
  };

  localStorage.setItem(stateKey, JSON.stringify(payload));
}

export function clearStorage() {
  localStorage.removeItem(stateKey);
}

export function restoreState() {
  const raw = localStorage.getItem(stateKey);
  if (!raw) return false;

  try {
    const saved = JSON.parse(raw);

    if (saved.version !== stateVersion) {
      clearStorage();
      return false;
    }

    if (Date.now() - saved.savedAt > stateTtlMs) {
      clearStorage();
      return false;
    }

    state.currentStep = saved.currentStep ?? 1;
    state.service = saved.serviceId ? findServiceById(saved.serviceId) : null;
    state.barber = saved.barberId ? findBarberById(saved.barberId) : null;
    state.date = saved.date ?? null;
    state.time = saved.time ?? null;
    state.nombre = saved.nombre ?? '';
    state.telefono = saved.telefono ?? '';
    state.correo = saved.correo ?? '';
    state.pago = saved.pagoId ? findPaymentById(saved.pagoId) : null;
    state.addBarba = !!saved.addBarba && !!state.service?.allowBarbaAddon;

    return true;
  } catch {
    clearStorage();
    return false;
  }
}

export function resetState() {
  Object.assign(state, createInitialState());
}
