import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { COMPANY } from '../lib/config.js';

const linkClass = ({ isActive }) =>
  isActive ? 'font-semibold text-primary' : 'text-muted hover:text-ink';

export default function Navbar() {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="nav">
      <NavLink to="/" className="text-base font-bold text-ink">🚌 {COMPANY}</NavLink>
      <NavLink to="/" className={linkClass} end>Search</NavLink>
      {user && <NavLink to="/my-bookings" className={linkClass}>My Bookings</NavLink>}
      {isAdmin && <NavLink to="/admin" className={linkClass}>Admin</NavLink>}
      <span className="flex-1" />
      {user ? (
        <>
          <span className="muted hidden sm:inline">{user.email}</span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={async () => {
              await signOut();
              navigate('/');
            }}
          >
            Sign out
          </button>
        </>
      ) : (
        <>
          <NavLink to="/login" className={linkClass}>Login</NavLink>
          <NavLink to="/signup" className={linkClass}>Sign up</NavLink>
        </>
      )}
    </nav>
  );
}
