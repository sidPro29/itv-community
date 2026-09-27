import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Users, MessageSquare, UserCheck, Shield, ExternalLink, LogOut, Sparkles, Award } from 'lucide-react';
import './Navbar.css';

export default function Navbar() {
  const { currentUser, verificationStatus, verificationBadge, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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
            <div className="user-menu">
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
