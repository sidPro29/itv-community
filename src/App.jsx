import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Login from './pages/Login';
import ProfileBuilder from './pages/ProfileBuilder';
import Directory from './pages/Directory';
import MemberDetail from './pages/MemberDetail';
import MessagingHub from './pages/MessagingHub';
import UpgradeCommunity from './pages/UpgradeCommunity';
import './index.css';

function ProtectedRoute({ children }) {
  const { currentUser, isSubscribed, loading } = useAuth();

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '100px', color: 'var(--text-muted)' }}>Validating Space Community Credentials...</div>;
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (!isSubscribed) {
    // Redirect to ITV Web Plans if active subscription is missing
    window.location.href = `${import.meta.env.VITE_WEB_URL || 'http://localhost:5173'}/plans`;
    return null;
  }

  return children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <Navbar />
          <main style={{ flex: 1 }}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<ProtectedRoute><Directory /></ProtectedRoute>} />
              <Route path="/members" element={<ProtectedRoute><Directory /></ProtectedRoute>} />
              <Route path="/members/:id" element={<ProtectedRoute><MemberDetail /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><ProfileBuilder /></ProtectedRoute>} />
              <Route path="/messages" element={<ProtectedRoute><MessagingHub /></ProtectedRoute>} />
              <Route path="/upgrade" element={<ProtectedRoute><UpgradeCommunity /></ProtectedRoute>} />
            </Routes>
          </main>
          <Footer />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
