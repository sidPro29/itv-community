import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Sparkles, Check, Zap, Crown, Shield, ArrowRight } from 'lucide-react';

export default function UpgradeCommunity() {
  const { currentUser, refreshProfile, API_URL } = useAuth();
  const navigate = useNavigate();
  const [loadingTier, setLoadingTier] = useState(null);

  const handleSubscribe = async (tier) => {
    setLoadingTier(tier);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/community/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        },
        body: JSON.stringify({ tier })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.msg || 'Subscription failed');

      alert(data.msg);
      await refreshProfile();
      navigate('/members');
    } catch (err) {
      alert(err.message);
    } finally {
      setLoadingTier(null);
    }
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '40px auto', padding: '0 24px' }}>
      
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <span className="badge-category badge-entrepreneur" style={{ marginBottom: '12px' }}>
          <Sparkles size={14} /> Community Tier Plans
        </span>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '2.5rem', fontWeight: 800 }}>
          Unlock Private Networking & Direct Calls
        </h1>
        <p style={{ color: 'var(--text-muted)', maxWidth: '600px', margin: '12px auto 0 auto', fontSize: '1rem', lineHeight: 1.6 }}>
          Choose a tier to start private messaging, audio calls, and 4K video calls with top space professionals and entrepreneurs.
        </p>
      </div>

      {/* Tier Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px' }}>
        
        {/* Basic Plan */}
        <div className="glass-panel" style={{ padding: '36px', borderRadius: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <Zap size={24} style={{ color: 'var(--accent-cyan)' }} />
              <h3 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Basic Tier</h3>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', marginBottom: '16px' }}>
              $19 <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 500 }}>/ month</span>
            </div>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.92rem', color: '#cbd5e0' }}>
              <li style={{ display: 'flex', gap: '8px' }}><Check size={18} style={{ color: '#38ef7d' }} /> Private chat with up to 10 verified members/mo</li>
              <li style={{ display: 'flex', gap: '8px' }}><Check size={18} style={{ color: '#38ef7d' }} /> Audio call with unlocked connections</li>
              <li style={{ display: 'flex', gap: '8px' }}><Check size={18} style={{ color: '#38ef7d' }} /> Standard community badge</li>
            </ul>
          </div>
          <button 
            className="btn-secondary" 
            style={{ width: '100%', marginTop: '30px' }}
            onClick={() => handleSubscribe('basic')}
            disabled={loadingTier === 'basic'}
          >
            {loadingTier === 'basic' ? 'Processing...' : 'Subscribe Basic'}
          </button>
        </div>

        {/* Plus Plan (Featured) */}
        <div className="glass-panel" style={{
          padding: '36px',
          borderRadius: '24px',
          border: '2px solid var(--accent-cyan)',
          boxShadow: '0 0 35px rgba(0, 242, 254, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          justify: 'space-between',
          position: 'relative'
        }}>
          <span style={{ position: 'absolute', top: -14, right: 24, background: 'linear-gradient(135deg, #00f2fe, #007aff)', color: '#fff', padding: '4px 14px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.5px' }}>
            MOST POPULAR
          </span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <Sparkles size={24} style={{ color: 'var(--accent-cyan)' }} />
              <h3 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Plus Tier</h3>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', marginBottom: '16px' }}>
              $49 <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 500 }}>/ month</span>
            </div>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.92rem', color: '#cbd5e0' }}>
              <li style={{ display: 'flex', gap: '8px' }}><Check size={18} style={{ color: '#38ef7d' }} /> Private chat with up to 50 verified members/mo</li>
              <li style={{ display: 'flex', gap: '8px' }}><Check size={18} style={{ color: '#38ef7d' }} /> High-Definition Video & Audio calling</li>
              <li style={{ display: 'flex', gap: '8px' }}><Check size={18} style={{ color: '#38ef7d' }} /> Featured profile highlight in directory</li>
            </ul>
          </div>
          <button 
            className="btn-primary" 
            style={{ width: '100%', marginTop: '30px' }}
            onClick={() => handleSubscribe('plus')}
            disabled={loadingTier === 'plus'}
          >
            {loadingTier === 'plus' ? 'Processing...' : 'Subscribe Plus'}
          </button>
        </div>

        {/* Pro Plan */}
        <div className="glass-panel" style={{ padding: '36px', borderRadius: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <Crown size={24} style={{ color: 'var(--accent-gold)' }} />
              <h3 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Pro VIP Tier</h3>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', marginBottom: '16px' }}>
              $99 <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 500 }}>/ month</span>
            </div>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.92rem', color: '#cbd5e0' }}>
              <li style={{ display: 'flex', gap: '8px' }}><Check size={18} style={{ color: '#38ef7d' }} /> Unlimited member private messaging & calls</li>
              <li style={{ display: 'flex', gap: '8px' }}><Check size={18} style={{ color: '#38ef7d' }} /> VIP Gold verified badge</li>
              <li style={{ display: 'flex', gap: '8px' }}><Check size={18} style={{ color: '#38ef7d' }} /> Direct priority connection with Space Entrepreneurs</li>
            </ul>
          </div>
          <button 
            className="btn-secondary" 
            style={{ width: '100%', marginTop: '30px' }}
            onClick={() => handleSubscribe('pro')}
            disabled={loadingTier === 'pro'}
          >
            {loadingTier === 'pro' ? 'Processing...' : 'Subscribe Pro VIP'}
          </button>
        </div>

      </div>
    </div>
  );
}
