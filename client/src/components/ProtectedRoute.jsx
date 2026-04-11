import { Navigate, useLocation } from 'react-router-dom';
import { isAuthenticated } from '../lib/auth';

export function ProtectedRoute({ children }) {
  const location = useLocation();
  const authenticated = isAuthenticated();

  if (!authenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
