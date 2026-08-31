import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Signup() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { data, error } = await signUp(email, password, name);
    setBusy(false);
    if (error) return setError(error.message);
    if (data.session) navigate('/', { replace: true });
    else setMsg('Check your email to confirm your account, then log in.');
  };

  return (
    <div className="container" style={{ maxWidth: 400 }}>
      <h1>Sign up</h1>
      <form className="card" onSubmit={submit}>
        <label>Full name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required />
        <label>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label>Password</label>
        <input type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="error">{error}</p>}
        {msg && <p className="muted">{msg}</p>}
        <button disabled={busy}>{busy ? '…' : 'Create account'}</button>
      </form>
      <p className="muted">Already have an account? <Link to="/login">Login</Link></p>
    </div>
  );
}
