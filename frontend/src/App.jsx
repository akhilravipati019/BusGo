import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

import Home from './pages/Home.jsx';
import SearchResults from './pages/SearchResults.jsx';
import SeatSelection from './pages/SeatSelection.jsx';
import Payment from './pages/Payment.jsx';
import BookingConfirmation from './pages/BookingConfirmation.jsx';
import MyBookings from './pages/MyBookings.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import AdminDashboard from './pages/admin/AdminDashboard.jsx';

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/search" element={<SearchResults />} />
        <Route
          path="/schedules/:id/seats"
          element={<ProtectedRoute><SeatSelection /></ProtectedRoute>}
        />
        <Route
          path="/bookings/:id/pay"
          element={<ProtectedRoute><Payment /></ProtectedRoute>}
        />
        <Route
          path="/bookings/:id/confirmation"
          element={<ProtectedRoute><BookingConfirmation /></ProtectedRoute>}
        />
        <Route
          path="/my-bookings"
          element={<ProtectedRoute><MyBookings /></ProtectedRoute>}
        />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/admin/*"
          element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>}
        />
        <Route path="*" element={<div className="container">Not found.</div>} />
      </Routes>
    </>
  );
}
