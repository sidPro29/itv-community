import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Users, MessageSquare, UserCheck, Shield, ExternalLink, LogOut, Sparkles, Bell, Check, Clock } from 'lucide-react';
import './Navbar.css';

export default function Navbar() {
  const { currentUser, verificationStatus, verificationBadge, logout, API_URL } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [notifications, setNotifications] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);

  useEffect(() => {
    if (currentUser) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 15000); // Poll every 15s
      return () => clearInterval(interval);
    }
  }, [currentUser]);

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/community/notifications`, {
        headers: { 'x-auth-token': token }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error fetching notifications', err);
    }
  };

  const handleNotifClick = async () => {
    const nextState = !showNotifs;
    setShowNotifs(nextState);
    if (nextState && unreadCount > 0) {
      try {
        const token = localStorage.getItem('token');
        await fetch(`${API_URL}/community/notifications/mark-read`, {
          method: 'PUT',
          headers: { 'x-auth-token': token }
        });
        setNotifications(notifications.map(n => ({ ...n, read: true })));
      } catch (err) {
        console.error(err);
      }
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getStatusBadge = () => {
    if (verificationStatus === 'verified') {
      return (
        <span className={`status-pill pill-verified pill-${verificationBadge}`}>
          <Shield size={12} /> {verificationBadge.toUpperCase()}
        </span>
      );
    }
    if (verificationStatus === 'pending') {
      return <span className="status-pill pill-pending">Pending Review</span>;
    }
    return <span className="status-pill pill-incomplete">Incomplete</span>;
  };

  return (
    <nav className="navbar-container">
      <div className="navbar-inner">
        <Link to="/members" className="navbar-brand">
          <div className="brand-logo">🚀</div>
          <div className="brand-text">
            <span className="brand-title">ITV SPACE</span>
            <span className="brand-sub">COMMUNITY</span>
          </div>
        </Link>

        {currentUser && (
          <div className="navbar-links">
            <Link to="/members" className={`nav-link ${location.pathname === '/members' ? 'active' : ''}`}>
              <Users size={18} /> Directory
            </Link>
            <Link to="/messages" className={`nav-link ${location.pathname === '/messages' ? 'active' : ''}`}>
              <MessageSquare size={18} /> Messages & Calls
            </Link>
            <Link to="/profile" className={`nav-link ${location.pathname === '/profile' ? 'active' : ''}`}>
              <UserCheck size={18} /> Profile & Verification
            </Link>
            <Link to="/upgrade" className={`nav-link ${location.pathname === '/upgrade' ? 'active' : ''}`}>
              <Sparkles size={18} style={{ color: '#ffd700' }} /> Community Tiers
            </Link>
          </div>
        )}

        <div className="navbar-actions">
          {currentUser ? (
            <div className="user-menu" style={{ position: 'relative' }}>
              {/* Notification Bell */}
              <button 
                onClick={handleNotifClick}
                style={{
                  position: 'relative',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid var(--border-glass)',
                  color: '#fff',
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
                title="Notifications"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-2px',
                    right: '-2px',
                    background: '#ff007f',
                    color: '#fff',
                    borderRadius: '50%',
                    width: '18px',
                    height: '18px',
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid #04060f'
                  }}>
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown Panel */}
              {showNotifs && (
                <div style={{
                  position: 'absolute',
                  top: '50px',
                  right: '0',
                  width: '320px',
                  maxHeight: '380px',
                  overflowY: 'auto',
                  background: 'rgba(10, 14, 28, 0.95)',
                  border: '1px solid var(--border-glass)',
                  backdropFilter: 'blur(20px)',
                  borderRadius: '16px',
                  boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
                  zIndex: 9999,
                  padding: '16px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '8px' }}>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 800 }}>Notifications</h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{notifications.length} total</span>
                  </div>

                  {notifications.length === 0 ? (
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>No notifications yet</p>
                  ) : (
                    notifications.map((n, i) => (
                      <div 
                        key={i}
                        onClick={() => {
                          setShowNotifs(false);
                          if (n.link) navigate(n.link);
                        }}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '10px',
                          background: n.read ? 'transparent' : 'rgba(0, 242, 254, 0.08)',
                          marginBottom: '8px',
                          cursor: 'pointer',
                          border: '1px solid var(--border-glass)'
                        }}
                      >
                        <h5 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>{n.title}</h5>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              )}

              {getStatusBadge()}
              <a 
                href={import.meta.env.VITE_WEB_URL || 'http://localhost:5173'} 
                className="btn-link-itv"
                title="Back to Interplanetary TV"
              >
                <span>ITV Web</span> <ExternalLink size={14} />
              </a>
              <button onClick={handleLogout} className="btn-logout" title="Sign out">
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <a href={import.meta.env.VITE_WEB_URL || 'http://localhost:5173'} className="btn-link-itv">
              Back to ITV Web <ExternalLink size={14} />
            </a>
          )}
        </div>
      </div>
    </nav>
  );
}
