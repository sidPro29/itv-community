import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, Key, ShieldAlert, ArrowRight } from 'lucide-react';

export default function Login() {
  const { login, isSubscribed } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [subRequiredError, setSubRequiredError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubRequiredError(false);
    setLoading(true);

    try {
      const user = await login(email, password);
      // Check active subscription
      const hasSub = user.activePlans && Array.isArray(user.activePlans) && user.activePlans.some(p => !p.expiryDate || new Date(p.expiryDate) > new Date());
      if (!hasSub) {
        setSubRequiredError(true);
      } else {
        navigate('/members');
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '80vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px'
    }}>
      <div className="glass-panel" style={{
        maxWidth: '440px',
        width: '100%',
        padding: '40px 32px',
        borderRadius: '24px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            fontSize: '2.5rem',
            marginBottom: '12px'
          }}>🚀</div>
          <h2 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '1.8rem',
            fontWeight: 800,
            marginBottom: '8px'
          }}>Space Community Login</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Use your Interplanetary TV account credentials to enter the exclusive network.
          </p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(255, 77, 77, 0.15)',
            border: '1px solid rgba(255, 77, 77, 0.3)',
            color: '#ff4d4d',
            padding: '12px 16px',
            borderRadius: '10px',
            fontSize: '0.88rem',
            marginBottom: '20px'
          }}>
            {error}
          </div>
        )}

        {subRequiredError && (
          <div style={{
            background: 'rgba(255, 170, 0, 0.15)',
            border: '1px solid rgba(255, 170, 0, 0.4)',
            color: '#ffaa00',
            padding: '16px',
            borderRadius: '14px',
            fontSize: '0.9rem',
            marginBottom: '24px',
            textAlign: 'center'
          }}>
            <ShieldAlert size={28} style={{ margin: '0 auto 8px auto', display: 'block' }} />
            <strong>No Active Subscription Found</strong>
            <p style={{ marginTop: '6px', fontSize: '0.85rem', color: '#e2e8f0' }}>
              Your Interplanetary account does not have an active subscription. Please subscribe on ITV Web to access the community.
            </p>
            <a 
              href={`${import.meta.env.VITE_WEB_URL || 'http://localhost:5173'}/plans`}
              className="btn-primary" 
              style={{ width: '100%', marginTop: '12px', fontSize: '0.9rem' }}
            >
              Buy Subscription on ITV Web <ArrowRight size={16} />
            </a>
          </div>
        )}

        {!subRequiredError && (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label><Mail size={14} style={{ display: 'inline', marginRight: 6 }} /> Email Address</label>
              <input 
                type="email"
                required
                className="form-input"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label><Key size={14} style={{ display: 'inline', marginRight: 6 }} /> Password</label>
              <input 
                type="password"
                required
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button 
              type="submit" 
              disabled={loading} 
              className="btn-primary" 
              style={{ width: '100%', marginTop: '10px' }}
            >
              {loading ? 'Authenticating...' : 'Sign In to Community'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
