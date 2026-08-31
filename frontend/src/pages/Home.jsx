import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';

export default function Home() {
  const [cities, setCities] = useState([]);
  const [origin, setOrigin] = useState('');
  const [dest, setDest] = useState('');
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const navigate = useNavigate();

  useEffect(() => {
    supabase.from('cities').select('name').order('name').then(({ data }) => {
      setCities(data || []);
    });
  }, []);

  const submit = (e) => {
    e.preventDefault();
    if (!origin || !dest || origin === dest) return;
    navigate(`/search?origin=${encodeURIComponent(origin)}&dest=${encodeURIComponent(dest)}&date=${date}`);
  };

  return (
    <div className="container">
      <h1>Find your bus</h1>
      <form className="card" onSubmit={submit}>
        <div className="row">
          <div>
            <label>From</label>
            <select value={origin} onChange={(e) => setOrigin(e.target.value)}>
              <option value="">Select</option>
              {cities.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label>To</label>
            <select value={dest} onChange={(e) => setDest(e.target.value)}>
              <option value="">Select</option>
              {cities.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        {origin && dest && origin === dest && (
          <p className="error">Origin and destination must differ.</p>
        )}
        <button type="submit">Search buses</button>
      </form>
    </div>
  );
}
