import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, isAdmin, loading, profile } = useAuth();
  const loc = useLocation();

  if (loading) return <div className="container">Loading…</div>;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  if (adminOnly && !profile) return <div className="container">Loading…</div>;
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;
  return children;
}
