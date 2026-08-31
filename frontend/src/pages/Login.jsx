import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error } = await signIn(email, password);
    setBusy(false);
    if (error) return setError(error.message);
    navigate(loc.state?.from || '/', { replace: true });
  };

  return (
    <div className="container" style={{ maxWidth: 400 }}>
      <h1>Login</h1>
      <form className="card" onSubmit={submit}>
        <label>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="error">{error}</p>}
        <button disabled={busy}>{busy ? '…' : 'Login'}</button>
      </form>
      <p className="muted">No account? <Link to="/signup">Sign up</Link></p>
    </div>
  );
}
