// A pending booking holds its seats for this long; after that it is treated as
// expired everywhere it is read (seat maps, my bookings, admin, payment).
export const HOLD_MS = 10 * 60 * 1000;

export function isHoldExpired(status, createdAt) {
  return status === 'pending' && Date.now() - new Date(createdAt).getTime() > HOLD_MS;
}

// a seat is really taken unless the booking behind it is an expired pending hold
export function seatIsLive(booking) {
  if (!booking) return true;
  return !isHoldExpired(booking.status, booking.created_at);
}

export function effectiveStatus(booking) {
  return isHoldExpired(booking.status, booking.created_at) ? 'expired' : booking.status;
}
