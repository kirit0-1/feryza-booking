/**
 * icons.js — Iconos SVG Eryza Barber
 */

const SERVICE_ICONS = {
  corte: `<svg class="sel-card-icon" viewBox="0 0 38 38" fill="none"><circle cx="19" cy="19" r="18" fill="#2A2633"/><circle cx="7" cy="11" r="3" stroke="#9B8EC4" stroke-width="1.4"/><circle cx="7" cy="27" r="3" stroke="#9B8EC4" stroke-width="1.4"/><path d="M9.5 13.5L30 28M30 10L9.5 24.5" stroke="#F2F0F5" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  barba: `<svg class="sel-card-icon" viewBox="0 0 38 38" fill="none"><circle cx="19" cy="19" r="18" fill="#2A2633"/><path d="M8 19c0-6 4-11 11-11s11 5 11 11c0 4-11 14-11 14S8 23 8 19z" stroke="#F2F0F5" stroke-width="1.4" fill="none"/><path d="M13 23c2-3 4-4 6-4s4 1 6 4" stroke="#9B8EC4" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  membresia: `<svg class="sel-card-icon" viewBox="0 0 38 38" fill="none"><circle cx="19" cy="19" r="18" fill="#2A2633"/><rect x="8" y="12" width="22" height="14" rx="2" stroke="#F2F0F5" stroke-width="1.4"/><path d="M8 17h22" stroke="#9B8EC4" stroke-width="1.6"/><circle cx="14" cy="22" r="1.5" fill="#9B8EC4"/></svg>`,
  default: `<svg class="sel-card-icon" viewBox="0 0 38 38" fill="none"><circle cx="19" cy="19" r="18" fill="#2A2633"/><circle cx="19" cy="15" r="6" stroke="#F2F0F5" stroke-width="1.4"/><path d="M10 28c0-5 4-8 9-8s9 3 9 8" stroke="#9B8EC4" stroke-width="1.6" stroke-linecap="round"/></svg>`,
};

export const SUMMARY_ICONS = {
  scissors: `<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M8 8.5L21 19M21 5L8 15.5"/>`,
  person: `<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>`,
  cal: `<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>`,
  clock: `<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>`,
  pay: `<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>`,
};

export const PAGO_ICONS = {
  cash: `<svg viewBox="0 0 24 24" fill="none" stroke="#9B8EC4" stroke-width="1.6"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><circle cx="12" cy="14" r="2"/></svg>`,
  transfer: `<svg viewBox="0 0 24 24" fill="none" stroke="#9B8EC4" stroke-width="1.6"><path d="M18 8l4-4-4-4M2 12h20M6 20l-4-4 4-4M22 12H2"/></svg>`,
  card: `<svg viewBox="0 0 24 24" fill="none" stroke="#9B8EC4" stroke-width="1.6"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>`,
};

export function getServiceIcon(service) {
  return SERVICE_ICONS[service.icon] ?? SERVICE_ICONS.default;
}
