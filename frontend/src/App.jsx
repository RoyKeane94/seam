import { Navigate, Route, Routes } from 'react-router-dom';
import GuestRoute from './components/GuestRoute';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Record from './pages/Record';
import Search from './pages/Search';
import { getToken } from './api';

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          getToken() ? <Navigate to="/record" replace /> : <Navigate to="/login" replace />
        }
      />
      <Route
        path="/login"
        element={
          <GuestRoute>
            <Login />
          </GuestRoute>
        }
      />
      <Route
        path="/register"
        element={
          <GuestRoute>
            <Register />
          </GuestRoute>
        }
      />
      <Route
        path="/record"
        element={
          <ProtectedRoute>
            <Record />
          </ProtectedRoute>
        }
      />
      <Route
        path="/search"
        element={
          <ProtectedRoute>
            <Search />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
