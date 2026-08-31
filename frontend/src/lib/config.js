export const COMPANY = import.meta.env.VITE_COMPANY_NAME || 'BusGo';

export const AMENITIES = ['wifi', 'charging', 'blanket', 'water', 'snacks', 'toilet'];

export const busLabel = (bus) =>
  bus ? `${bus.reg_no}${bus.label ? ` · ${bus.label}` : ''}` : '';

export const prettyType = (t) => (t || '').replace('_', ' ').toLowerCase();
