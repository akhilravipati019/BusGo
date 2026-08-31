import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';

export default function Payment() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    api.get('/bookings').then((list) => {
      const b = list.find((x) => x.id === id);
      if (!b) setError('Booking not found.');
      else setBooking(b);
    }).catch((e) => setError(e.message));
  }, [id]);

  const pay = async () => {
    setPaying(true);
    setError('');
    try {
      await api.post(`/bookings/${id}/pay`);
      navigate(`/bookings/${id}/confirmation`);
    } catch (e) {
      setError(e.message);
    } finally {
      setPaying(false);
    }
  };

  if (error) return <div className="container"><p className="error">{error}</p></div>;
  if (!booking) return <div className="container">Loading…</div>;

  if (booking.status === 'expired') {
    return (
      <div className="container">
        <h1>Payment</h1>
        <div className="card">
          <p className="error">This seat hold expired before payment. Please book again.</p>
          <button onClick={() => navigate('/')}>Search buses</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>Payment</h1>
      <div className="card">
        <p className="muted">
          {booking.schedules?.routes?.origin?.name} → {booking.schedules?.routes?.dest?.name}
        </p>
        <p>Seats: {booking.booking_seats?.map((s) => s.seat_no).join(', ')}</p>
        <h2>₹{Number(booking.total_amount).toFixed(0)}</h2>
        <p className="muted">This is a mock payment — no real money moves.</p>
        {error && <p className="error">{error}</p>}
        <button onClick={pay} disabled={paying || booking.status === 'confirmed'}>
          {booking.status === 'confirmed' ? 'Already paid' : paying ? 'Processing…' : 'Pay now'}
        </button>
      </div>
      <p className="muted">
        Seats are held for 10 minutes. If you don’t pay, the hold is released.
      </p>
    </div>
  );
}
