import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { downloadTicket } from '../lib/ticket.js';

export default function BookingConfirmation() {
  const { id } = useParams();
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/bookings').then((list) => {
      setBooking(list.find((x) => x.id === id) || null);
    }).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <div className="container"><p className="error">{error}</p></div>;
  if (!booking) return <div className="container">Loading…</div>;

  const s = booking.schedules;
  return (
    <div className="container">
      <h1>🎉 Booking confirmed</h1>
      <div className="card">
        <p><span className={`pill ${booking.status}`}>{booking.status}</span></p>
        <p className="muted">Booking ID: {booking.id}</p>
        <p>{s?.routes?.origin?.name} → {s?.routes?.dest?.name}</p>
        <p>{s?.buses?.bus_type?.replace('_', ' ')} · {s?.buses?.reg_no} · {new Date(s?.departure_at).toLocaleString()}</p>
        <p>Seats: {booking.booking_seats?.map((x) => x.seat_no).join(', ')}</p>
        <p>Payment ref: {booking.payment_ref}</p>
        <p><strong>Paid: ₹{Number(booking.total_amount).toFixed(0)}</strong></p>
        <button onClick={() => downloadTicket(booking.id).catch((e) => setError(e.message))}>
          Download e-ticket (PDF)
        </button>{' '}
        <Link to="/my-bookings"><button className="ghost">My bookings</button></Link>
      </div>
    </div>
  );
}
