import { Navigate } from 'react-router-dom';
import { getToken } from '../api';

export default function GuestRoute({ children }) {
  if (getToken()) {
    return <Navigate to="/record" replace />;
  }
  return children;
}
