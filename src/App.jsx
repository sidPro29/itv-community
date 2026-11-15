import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Login from './pages/Login';
import Home from './pages/Home';
import Directory from './pages/Directory';
import MemberDetail from './pages/MemberDetail';
import UpgradeCommunity from './pages/UpgradeCommunity';
import ScheduleMeetings from './pages/ScheduleMeetings';
import SupportChatWidget from './components/SupportChatWidget';
import './index.css';

function RequireAuth({ children }) {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '100px', color: 'var(--text-muted)' }}>Validating Space Community Credentials...</div>;
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function ProtectedRoute({ children }) {
  const { currentUser, isSubscribed, loading } = useAuth();

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '100px', color: 'var(--text-muted)' }}>Validating Space Community Credentials...</div>;
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (!isSubscribed) {
    // Redirect to upgrade page to choose a community plan
    return <Navigate to="/upgrade" replace />;
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
              <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
              <Route path="/schedule" element={<ProtectedRoute><ScheduleMeetings /></ProtectedRoute>} />
              <Route path="/members" element={<ProtectedRoute><Directory /></ProtectedRoute>} />
              <Route path="/members/:id" element={<ProtectedRoute><MemberDetail /></ProtectedRoute>} />
              <Route path="/profile" element={<Navigate to="/" replace />} />
              <Route path="/messages" element={<ProtectedRoute><Home /></ProtectedRoute>} />
              <Route path="/upgrade" element={<RequireAuth><UpgradeCommunity /></RequireAuth>} />
            </Routes>
          </main>
          <Footer />
          <SupportChatWidget platform="community" />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
