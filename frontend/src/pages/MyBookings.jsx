import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { downloadTicket } from '../lib/ticket.js';

export default function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);

  const load = () => {
    setLoading(true);
    api.get('/bookings').then(setBookings).catch((e) => setError(e.message)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const cancel = async (id) => {
    if (!confirm('Cancel this booking?')) return;
    setBusy(id);
    try {
      await api.post(`/bookings/${id}/cancel`);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <div className="container">Loading…</div>;

  return (
    <div className="container">
      <h1>My bookings</h1>
      {error && <p className="error">{error}</p>}
      {bookings.length === 0 && <p>No bookings yet. <Link to="/">Search buses</Link></p>}

      {bookings.map((b) => {
        const s = b.schedules;
        const upcoming = s && new Date(s.departure_at) > new Date();
        return (
          <div className="card" key={b.id}>
            <div className="row" style={{ alignItems: 'center' }}>
              <div>
                <strong>{s?.routes?.origin?.name} → {s?.routes?.dest?.name}</strong>
                <div className="muted">
                  {s?.buses?.reg_no} · {s && new Date(s.departure_at).toLocaleString()}
                </div>
                <div className="muted">Seats: {b.booking_seats?.map((x) => x.seat_no).join(', ') || '—'}</div>
              </div>
              <div>
                <span className={`pill ${b.status}`}>{b.status}</span>
                <div className="muted">₹{Number(b.total_amount).toFixed(0)}</div>
              </div>
              <div style={{ flex: '0 0 auto', display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
                {b.status === 'pending' && (
                  <Link to={`/bookings/${b.id}/pay`}><button className="sm">Pay</button></Link>
                )}
                {b.status === 'expired' && (
                  <Link to="/"><button className="sm ghost">Book again</button></Link>
                )}
                {b.status === 'confirmed' && (
                  <button className="sm ghost" onClick={() => downloadTicket(b.id).catch((e) => setError(e.message))}>
                    E-ticket
                  </button>
                )}
                {b.status !== 'cancelled' && b.status !== 'expired' && upcoming && (
                  <button className="sm danger" disabled={busy === b.id} onClick={() => cancel(b.id)}>
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
