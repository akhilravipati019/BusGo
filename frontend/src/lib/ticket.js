import { api } from './api.js';

export async function downloadTicket(bookingId) {
  const res = await api.raw(`/bookings/${bookingId}/ticket`);
  if (!res.ok) {
    let msg = 'Could not download ticket';
    try { msg = (await res.json()).error || msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ticket-${bookingId}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
