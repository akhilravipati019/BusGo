import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import SeatMap from '../components/SeatMap.jsx';

export default function SeatSelection() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [data, setData] = useState(null);
  const [selected, setSelected] = useState([]);
  const [pax, setPax] = useState({});
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    api.get(`/schedules/${id}/seats`).then(setData).catch((e) => setError(e.message));
  };
  useEffect(load, [id]);

  const setPaxField = (seat, field, value) =>
    setPax((p) => ({ ...p, [seat]: { ...p[seat], [field]: value } }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const seats = selected.map((seat_no) => ({
        seat_no,
        passenger_name: pax[seat_no]?.name?.trim(),
        passenger_age: pax[seat_no]?.age || null,
        passenger_gender: pax[seat_no]?.gender || null,
      }));
      if (seats.some((s) => !s.passenger_name)) {
        throw new Error('Enter a name for every passenger.');
      }
      const booking = await api.post('/bookings', {
        schedule_id: Number(id),
        seats,
        contact_email: user.email,
        contact_phone: phone || null,
      });
      navigate(`/bookings/${booking.id}/pay`);
    } catch (e) {
      setError(e.message);
      load(); // refresh taken seats in case of a clash
      setSelected([]);
    } finally {
      setSubmitting(false);
    }
  };

  if (error && !data) return <div className="container"><p className="error">{error}</p></div>;
  if (!data) return <div className="container">Loading…</div>;

  const s = data.schedule;
  const fare = Number(s.fare);

  return (
    <div className="container">
      <h1>{s.routes?.origin?.name} → {s.routes?.dest?.name}</h1>
      <p className="muted">
        {s.buses?.bus_type?.replace('_', ' ')} · {s.buses?.reg_no} · {new Date(s.departure_at).toLocaleString()}
      </p>

      <div className="card">
        <h3>Pick your seats</h3>
        <SeatMap
          seatMap={data.seat_map}
          busType={s.buses?.bus_type}
          taken={data.taken}
          selected={selected}
          onToggle={setSelected}
        />
      </div>

      {selected.length > 0 && (
        <form className="card" onSubmit={submit}>
          <h3>Passenger details</h3>
          {selected.map((seat) => (
            <div className="row" key={seat}>
              <div>
                <label>Seat {seat} — name</label>
                <input
                  value={pax[seat]?.name || ''}
                  onChange={(e) => setPaxField(seat, 'name', e.target.value)}
                />
              </div>
              <div>
                <label>Age</label>
                <input
                  type="number" min="0"
                  value={pax[seat]?.age || ''}
                  onChange={(e) => setPaxField(seat, 'age', e.target.value)}
                />
              </div>
              <div>
                <label>Gender</label>
                <select
                  value={pax[seat]?.gender || ''}
                  onChange={(e) => setPaxField(seat, 'gender', e.target.value)}
                >
                  <option value="">-</option>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                  <option value="O">Other</option>
                </select>
              </div>
            </div>
          ))}
          <div className="row">
            <div>
              <label>Contact phone (optional)</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          {error && <p className="error">{error}</p>}
          <p><strong>Total: ₹{(fare * selected.length).toFixed(0)}</strong> ({selected.length} × ₹{fare.toFixed(0)})</p>
          <button type="submit" disabled={submitting}>
            {submitting ? 'Holding seats…' : 'Continue to payment'}
          </button>
        </form>
      )}
    </div>
  );
}
