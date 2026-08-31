import { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { prettyType } from '../lib/config.js';

const fmtTime = (d) => new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

export default function SearchResults() {
  const [params] = useSearchParams();
  const origin = params.get('origin');
  const dest = params.get('dest');
  const date = params.get('date');
  const { user } = useAuth();
  const navigate = useNavigate();

  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    api
      .get(`/schedules/search?origin=${encodeURIComponent(origin)}&dest=${encodeURIComponent(dest)}&date=${date}`)
      .then(setTrips)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [origin, dest, date]);

  return (
    <div className="container">
      <h1>{origin} → {dest}</h1>
      <p className="muted">{date}</p>
      {loading && <p>Searching…</p>}
      {error && <p className="error">{error}</p>}
      {!loading && trips.length === 0 && <p>No buses found for this day.</p>}

      {trips.map((t) => (
        <div className="card" key={t.id}>
          <div className="row" style={{ alignItems: 'center' }}>
            <div>
              <strong>{prettyType(t.buses?.bus_type)}</strong>
              <div className="muted">
                {t.buses?.reg_no}
                {t.buses?.amenities?.length ? ` · ${t.buses.amenities.join(', ')}` : ''}
              </div>
            </div>
            <div>
              <div>{fmtTime(t.departure_at)}</div>
              <div className="muted">→ {fmtTime(t.arrival_at)}</div>
            </div>
            <div>
              <div><strong>₹{Number(t.fare).toFixed(0)}</strong></div>
              <div className="muted">{t.seats_left} seats left</div>
            </div>
            <div style={{ flex: '0 0 auto' }}>
              {user ? (
                <button
                  disabled={t.seats_left <= 0}
                  onClick={() => navigate(`/schedules/${t.id}/seats`)}
                >
                  Select seats
                </button>
              ) : (
                <Link to="/login"><button>Login to book</button></Link>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
