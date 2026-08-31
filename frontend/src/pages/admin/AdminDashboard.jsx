import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { AMENITIES, busLabel, prettyType } from '../../lib/config.js';
import { generateSeatMap } from '../../lib/seats.js';
import SeatMap from '../../components/SeatMap.jsx';

const TABS = ['Buses', 'Routes', 'Schedules', 'Bookings'];
const fmt = (d) => new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

export default function AdminDashboard() {
  const [tab, setTab] = useState('Buses');
  return (
    <div className="container">
      <h1>Admin</h1>
      <div className="mb-4 flex flex-wrap gap-1 rounded-xl border border-line bg-card p-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`unstyled rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === t ? 'bg-primary text-white' : 'text-muted hover:bg-slate-100'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === 'Buses' && <Buses />}
      {tab === 'Routes' && <RoutesTab />}
      {tab === 'Schedules' && <Schedules />}
      {tab === 'Bookings' && <Bookings />}
    </div>
  );
}

function useList(path, deps = []) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const reload = () => api.get(path).then(setItems).catch((e) => setError(e.message));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, [path, ...deps]);
  return { items, error, reload, setError };
}

function Buses() {
  const { items, error, reload, setError } = useList('/admin/buses');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState(null);
  const empty = { reg_no: '', label: '', bus_type: 'AC_SEATER', seats: '', plan: '2+2', amenities: [] };
  const [f, setF] = useState(empty);

  const isSleeper = f.bus_type === 'AC_SLEEPER';
  const previewMap = f.seats ? generateSeatMap(f.bus_type, f.seats, f.plan) : [];

  const add = async (e) => {
    e.preventDefault();
    try {
      const n = Number(f.seats);
      if (!n || n < 1) throw new Error('Enter a seat count.');
      await api.post('/admin/buses', {
        reg_no: f.reg_no.trim().toUpperCase(),
        label: f.label.trim() || null,
        bus_type: f.bus_type,
        total_seats: n,
        amenities: f.amenities,
        seat_map: generateSeatMap(f.bus_type, n, f.plan),
      });
      setF(empty);
      reload();
    } catch (e) { setError(e.message); }
  };

  const toggleAmenity = (a) =>
    setF((p) => ({ ...p, amenities: p.amenities.includes(a) ? p.amenities.filter((x) => x !== a) : [...p.amenities, a] }));

  const filtered = items.filter(
    (b) => `${b.reg_no} ${b.label || ''}`.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <>
      <div className="card">
        <h3>Register a bus</h3>
        <form onSubmit={add}>
          <div className="row">
            <div><label>Registration no.</label><input value={f.reg_no} placeholder="KA-01-AB-1234" onChange={(e) => setF({ ...f, reg_no: e.target.value })} required /></div>
            <div><label>Fleet label (optional)</label><input value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} /></div>
            <div>
              <label>Type</label>
              <select value={f.bus_type} onChange={(e) => setF({ ...f, bus_type: e.target.value })}>
                <option>AC_SEATER</option><option>AC_SLEEPER</option><option>NON_AC</option>
              </select>
            </div>
            {!isSleeper && (
              <div>
                <label>Layout</label>
                <select value={f.plan} onChange={(e) => setF({ ...f, plan: e.target.value })}>
                  <option value="2+2">2 + 2</option>
                  <option value="2+1">2 + 1</option>
                </select>
              </div>
            )}
            <div><label>Total seats</label><input type="number" min="1" value={f.seats} onChange={(e) => setF({ ...f, seats: e.target.value })} required /></div>
          </div>
          {previewMap.length > 0 && (
            <div style={{ margin: '.4rem 0 1rem' }}>
              <label>Layout preview</label>
              <SeatMap seatMap={previewMap} busType={f.bus_type} taken={[]} selected={[]} onToggle={() => {}} />
            </div>
          )}
          <label>Amenities</label>
          <div style={{ display: 'flex', gap: '.8rem', flexWrap: 'wrap', marginBottom: '.8rem' }}>
            {AMENITIES.map((a) => (
              <label key={a} style={{ display: 'flex', gap: '.3rem', alignItems: 'center', margin: 0 }}>
                <input type="checkbox" style={{ width: 'auto', margin: 0 }} checked={f.amenities.includes(a)} onChange={() => toggleAmenity(a)} />
                {a}
              </label>
            ))}
          </div>
          <button>Add bus</button>
        </form>
        {error && <p className="error">{error}</p>}
      </div>

      <div className="card">
        <input placeholder="Search buses by reg no or label…" value={q} onChange={(e) => setQ(e.target.value)} />
        <table>
          <thead><tr><th>Reg no.</th><th>Label</th><th>Type</th><th>Seats</th><th>Amenities</th><th /></tr></thead>
          <tbody>
            {filtered.map((b) => (
              <tr key={b.id}>
                <td><strong>{b.reg_no}</strong></td>
                <td>{b.label || '—'}</td>
                <td>{prettyType(b.bus_type)}</td>
                <td>{b.total_seats}</td>
                <td className="muted">{(b.amenities || []).join(', ') || '—'}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="sm ghost" onClick={() => setOpenId(openId === b.id ? null : b.id)}>
                    {openId === b.id ? 'Hide' : 'Details'}
                  </button>{' '}
                  <button className="sm danger" onClick={async () => { try { await api.del(`/admin/buses/${b.id}`); reload(); } catch (e) { setError(e.message); } }}>Delete</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6} className="muted">No buses.</td></tr>}
          </tbody>
        </table>
      </div>

      {openId && <BusOverview busId={openId} />}
    </>
  );
}

function BusOverview({ busId }) {
  const [ov, setOv] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    setOv(null);
    api.get(`/admin/buses/${busId}/overview`).then(setOv).catch((e) => setErr(e.message));
  }, [busId]);

  if (err) return <div className="card"><p className="error">{err}</p></div>;
  if (!ov) return <div className="card">Loading bus…</div>;

  return (
    <div className="card">
      <h3>{ov.bus.reg_no} {ov.bus.label ? `· ${ov.bus.label}` : ''}</h3>
      <p className="muted">{prettyType(ov.bus.bus_type)} · {ov.bus.total_seats} seats · {(ov.bus.amenities || []).join(', ') || 'no amenities'}</p>
      <h4>Trips for this bus</h4>
      <table>
        <thead><tr><th>Route</th><th>Departure</th><th>Fare</th><th>Load</th><th>Status</th></tr></thead>
        <tbody>
          {ov.schedules.map((s) => (
            <tr key={s.id}>
              <td>{s.routes?.origin?.name} → {s.routes?.dest?.name}</td>
              <td>{fmt(s.departure_at)}</td>
              <td>₹{Number(s.fare).toFixed(0)}</td>
              <td>{s.seats_sold}/{s.seats_total}</td>
              <td>{s.status}</td>
            </tr>
          ))}
          {ov.schedules.length === 0 && <tr><td colSpan={5} className="muted">No trips scheduled.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}


function RoutesTab() {
  const { items, error, reload, setError } = useList('/admin/routes');
  const { items: cities } = useList('/admin/cities');
  const [newCity, setNewCity] = useState('');
  const [f, setF] = useState({ origin_city_id: '', dest_city_id: '', distance_km: '' });

  const addCity = async (e) => {
    e.preventDefault();
    try { await api.post('/admin/cities', { name: newCity.trim() }); setNewCity(''); reload(); }
    catch (e) { setError(e.message); }
  };
  const add = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/routes', {
        origin_city_id: Number(f.origin_city_id),
        dest_city_id: Number(f.dest_city_id),
        distance_km: f.distance_km ? Number(f.distance_km) : null,
      });
      setF({ origin_city_id: '', dest_city_id: '', distance_km: '' });
      reload();
    } catch (e) { setError(e.message); }
  };

  return (
    <>
      <div className="card">
        <h3>Cities</h3>
        <form className="row" onSubmit={addCity}>
          <div><label>New city</label><input value={newCity} onChange={(e) => setNewCity(e.target.value)} required /></div>
          <div style={{ flex: '0 0 auto', alignSelf: 'end' }}><button>Add city</button></div>
        </form>
        <p className="muted">{cities.map((c) => c.name).join(' · ') || 'none yet'}</p>
      </div>

      <div className="card">
        <h3>Add route</h3>
        <form className="row" onSubmit={add}>
          <div>
            <label>Origin</label>
            <select value={f.origin_city_id} onChange={(e) => setF({ ...f, origin_city_id: e.target.value })} required>
              <option value="">-</option>{cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label>Destination</label>
            <select value={f.dest_city_id} onChange={(e) => setF({ ...f, dest_city_id: e.target.value })} required>
              <option value="">-</option>{cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div><label>Distance km</label><input type="number" value={f.distance_km} onChange={(e) => setF({ ...f, distance_km: e.target.value })} /></div>
          <div style={{ flex: '0 0 auto', alignSelf: 'end' }}><button>Add</button></div>
        </form>
        {error && <p className="error">{error}</p>}
        <table>
          <thead><tr><th>Route</th><th>km</th><th /></tr></thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <td>{r.origin?.name} → {r.dest?.name}</td>
                <td>{r.distance_km || '—'}</td>
                <td style={{ textAlign: 'right' }}>
                  <button className="sm danger" onClick={async () => { try { await api.del(`/admin/routes/${r.id}`); reload(); } catch (e) { setError(e.message); } }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}


function Schedules() {
  const { items: buses } = useList('/admin/buses');
  const { items: routes } = useList('/admin/routes');
  const [filter, setFilter] = useState({ bus_id: '', route_id: '', date: '' });
  const qs = Object.entries(filter).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  const { items, error, reload, setError } = useList(`/admin/schedules${qs ? `?${qs}` : ''}`, [qs]);

  const empty = { bus_id: '', route_id: '', departure_at: '', arrival_at: '', fare: '' };
  const [f, setF] = useState(empty);
  const add = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/schedules', {
        bus_id: Number(f.bus_id),
        route_id: Number(f.route_id),
        departure_at: new Date(f.departure_at).toISOString(),
        arrival_at: new Date(f.arrival_at).toISOString(),
        fare: Number(f.fare),
      });
      setF(empty);
      reload();
    } catch (e) { setError(e.message); }
  };

  return (
    <>
      <div className="card">
        <h3>Schedule a bus</h3>
        <form onSubmit={add}>
          <div className="row">
            <div>
              <label>Bus</label>
              <select value={f.bus_id} onChange={(e) => setF({ ...f, bus_id: e.target.value })} required>
                <option value="">-</option>{buses.map((b) => <option key={b.id} value={b.id}>{busLabel(b)} ({prettyType(b.bus_type)})</option>)}
              </select>
            </div>
            <div>
              <label>Route</label>
              <select value={f.route_id} onChange={(e) => setF({ ...f, route_id: e.target.value })} required>
                <option value="">-</option>{routes.map((r) => <option key={r.id} value={r.id}>{r.origin?.name} → {r.dest?.name}</option>)}
              </select>
            </div>
            <div><label>Fare ₹</label><input type="number" value={f.fare} onChange={(e) => setF({ ...f, fare: e.target.value })} required /></div>
          </div>
          <div className="row">
            <div><label>Departure</label><input type="datetime-local" value={f.departure_at} onChange={(e) => setF({ ...f, departure_at: e.target.value })} required /></div>
            <div><label>Arrival</label><input type="datetime-local" value={f.arrival_at} onChange={(e) => setF({ ...f, arrival_at: e.target.value })} required /></div>
          </div>
          {f.departure_at && (
            <p className={new Date(f.departure_at) < new Date() ? 'error' : 'muted'}>
              Departs {new Date(f.departure_at).toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' })}
              {f.arrival_at && ` · arrives ${new Date(f.arrival_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`}
              {new Date(f.departure_at) < new Date() && ' — this is in the past!'}
            </p>
          )}
          <button>Add schedule</button>
        </form>
        {error && <p className="error">{error}</p>}
      </div>

      <div className="card">
        <h3>Scheduled trips</h3>
        <div className="row">
          <div>
            <label>Filter by bus</label>
            <select value={filter.bus_id} onChange={(e) => setFilter({ ...filter, bus_id: e.target.value })}>
              <option value="">All buses</option>{buses.map((b) => <option key={b.id} value={b.id}>{busLabel(b)}</option>)}
            </select>
          </div>
          <div>
            <label>Filter by route</label>
            <select value={filter.route_id} onChange={(e) => setFilter({ ...filter, route_id: e.target.value })}>
              <option value="">All routes</option>{routes.map((r) => <option key={r.id} value={r.id}>{r.origin?.name} → {r.dest?.name}</option>)}
            </select>
          </div>
          <div><label>Date</label><input type="date" value={filter.date} onChange={(e) => setFilter({ ...filter, date: e.target.value })} /></div>
        </div>
        <table>
          <thead><tr><th>Bus</th><th>Route</th><th>Departure</th><th>Fare</th><th>Sold</th><th>Status</th><th /></tr></thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.id}>
                <td>{s.buses?.reg_no}</td>
                <td>{s.routes?.origin?.name} → {s.routes?.dest?.name}</td>
                <td>{fmt(s.departure_at)}</td>
                <td>₹{Number(s.fare).toFixed(0)}</td>
                <td>{s.seats_sold}/{s.buses?.total_seats}</td>
                <td>{s.status}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="sm ghost" onClick={async () => { try { await api.put(`/admin/schedules/${s.id}`, { status: s.status === 'active' ? 'cancelled' : 'active' }); reload(); } catch (e) { setError(e.message); } }}>
                    {s.status === 'active' ? 'Cancel' : 'Reactivate'}
                  </button>{' '}
                  <button className="sm danger" onClick={async () => { try { await api.del(`/admin/schedules/${s.id}`); reload(); } catch (e) { setError(e.message); } }}>Delete</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={7} className="muted">No trips match.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}


function Bookings() {
  const { items: buses } = useList('/admin/buses');
  const [filter, setFilter] = useState({ bus_id: '', date: '' });
  const qs = Object.entries(filter).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  const { items, error } = useList(`/admin/bookings${qs ? `?${qs}` : ''}`, [qs]);

  const revenue = items
    .filter((b) => b.status === 'confirmed')
    .reduce((sum, b) => sum + Number(b.total_amount), 0);

  return (
    <div className="card">
      <h3>Bookings</h3>
      <div className="row">
        <div>
          <label>Bus</label>
          <select value={filter.bus_id} onChange={(e) => setFilter({ ...filter, bus_id: e.target.value })}>
            <option value="">All buses</option>{buses.map((b) => <option key={b.id} value={b.id}>{busLabel(b)}</option>)}
          </select>
        </div>
        <div><label>Travel date</label><input type="date" value={filter.date} onChange={(e) => setFilter({ ...filter, date: e.target.value })} /></div>
      </div>
      {error && <p className="error">{error}</p>}
      <p className="muted">{items.length} bookings · confirmed revenue ₹{revenue.toFixed(0)}</p>
      <table>
        <thead><tr><th>Booked</th><th>Bus</th><th>Route</th><th>Departure</th><th>Passengers</th><th>Amount</th><th>Status</th><th>Contact</th></tr></thead>
        <tbody>
          {items.map((b) => (
            <tr key={b.id}>
              <td>{new Date(b.created_at).toLocaleDateString()}</td>
              <td>{b.schedules?.buses?.reg_no}</td>
              <td>{b.schedules?.routes?.origin?.name} → {b.schedules?.routes?.dest?.name}</td>
              <td>{b.schedules?.departure_at ? fmt(b.schedules.departure_at) : '—'}</td>
              <td>
                {(b.booking_seats || []).map((s) => (
                  <div key={s.seat_no}>{s.seat_no} — {s.passenger_name}{s.passenger_age ? `, ${s.passenger_age}` : ''}{s.passenger_gender ? `/${s.passenger_gender}` : ''}</div>
                ))}
                {(b.booking_seats || []).length === 0 && <span className="muted">—</span>}
              </td>
              <td>₹{Number(b.total_amount).toFixed(0)}</td>
              <td><span className={`pill ${b.status}`}>{b.status}</span></td>
              <td className="muted">{b.contact_email}{b.contact_phone ? <><br />{b.contact_phone}</> : null}</td>
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan={8} className="muted">No bookings match.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
