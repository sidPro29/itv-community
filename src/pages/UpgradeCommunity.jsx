import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Sparkles, 
  Check, 
  Zap, 
  Crown, 
  ShieldCheck, 
  Lock, 
  ArrowRight, 
  Star,
  Users,
  Briefcase,
  TrendingUp,
  Info
} from 'lucide-react';

export default function UpgradeCommunity() {
  const { currentUser, verificationBadge, verificationStatus, refreshProfile, API_URL } = useAuth();
  const navigate = useNavigate();
  const [loadingTier, setLoadingTier] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const currentBadge = verificationBadge || currentUser?.verificationBadge || 'none';
  const isVerified = verificationStatus === 'verified' || currentUser?.verificationStatus === 'verified';
  const activeTier = currentUser?.communitySubscription?.tier || 'free';
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superAdmin';

  const badgeHierarchy = {
    none: 0,
    enthusiast: 1,
    professional: 2,
    entrepreneur: 3
  };

  const userLevel = isAdmin ? 3 : (badgeHierarchy[currentBadge] || 0);

  const plans = [
    {
      id: 'enthusiast',
      title: 'Space Enthusiast',
      price: '€1.99',
      period: '/ month (+VAT)',
      requiredLevel: 1,
      badgeLabel: 'Space Enthusiast',
      tagline: 'Step inside the global space community and connect with fellow pioneers.',
      freeStarterText: 'Start Free: Create & verify your profile, upload photo/banner/resume, browse community directory, and connect via text chat and friend requests.',
      upgradeText: 'Upgrade for €1.99/mo + VAT: Unlock unlimited text messaging plus unlimited voice and video calls across the network.',
      features: [
        'Verified Member Profile (photo, banner, bio & resume)',
        'Browse Global Space Directory & send connection requests',
        'Unlimited Private Text Messaging with all members',
        'Unlimited Voice & 4K Video Calling across the network',
        'Personal contact details hidden for privacy & safety'
      ],
      icon: <Users size={24} style={{ color: 'var(--accent-cyan)' }} />,
      cardBorder: '1px solid rgba(0, 242, 254, 0.25)',
      cardBg: 'rgba(13, 19, 38, 0.75)'
    },
    {
      id: 'professional',
      title: 'Space Professional',
      price: '€9.99',
      period: '/ month (+VAT)',
      requiredLevel: 2,
      badgeLabel: 'Space Professional',
      featuredBadge: 'MOST POPULAR',
      tagline: 'Built for verified industry specialists ready to showcase credentials & expand reach.',
      freeStarterText: null,
      upgradeText: 'Includes everything in Space Enthusiast plus official industry vetting & credential showcase.',
      features: [
        'Everything in Space Enthusiast (unlimited text, voice & video calls)',
        'Officially Vetted Industry Specialist Badge on profile & directory',
        'Full Credential Showcase: verified education, certifications & awards',
        'Stand out to recruiters, aerospace partners, and industry leaders',
        'Direct connection with verified aerospace decision-makers'
      ],
      icon: <Briefcase size={24} style={{ color: '#00f2fe' }} />,
      cardBorder: '2px solid #00f2fe',
      cardBg: 'linear-gradient(180deg, rgba(0, 122, 255, 0.12) 0%, rgba(13, 19, 38, 0.95) 100%)',
      glow: '0 0 35px rgba(0, 242, 254, 0.25)'
    },
    {
      id: 'entrepreneur',
      title: 'Space Entrepreneur',
      price: '€19.99',
      period: '/ month (+VAT)',
      requiredLevel: 3,
      badgeLabel: 'Space Entrepreneur',
      featuredBadge: 'CAPITAL & VC ACCESS',
      tagline: 'Accelerate your venture with direct capital connections & tailored matchmaking.',
      freeStarterText: null,
      upgradeText: 'Direct capital network, vetted angel & VC introductions, and bespoke talent matching.',
      features: [
        'Everything in Space Professional (all communication & verified standing)',
        'Verified Capital Network: Direct access to vetted business angels, VCs & financial institutions',
        'Bespoke Talent & Funding Matches: Tailored matchmaking for funding and executive hiring',
        'Company & venture verification with priority directory highlight',
        'Exclusive invitations to partner events, pitch summits & deal rooms'
      ],
      icon: <Crown size={24} style={{ color: 'var(--accent-gold)' }} />,
      cardBorder: '1px solid rgba(255, 215, 0, 0.4)',
      cardBg: 'linear-gradient(180deg, rgba(255, 215, 0, 0.08) 0%, rgba(13, 19, 38, 0.95) 100%)',
      glow: '0 0 35px rgba(255, 215, 0, 0.2)'
    }
  ];

  const handleSubscribe = async (tierId) => {
    setErrorMsg('');
    setLoadingTier(tierId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/community/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        },
        body: JSON.stringify({ tier: tierId })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.msg || 'Subscription failed');

      alert(data.msg);
      await refreshProfile();
      navigate('/members');
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoadingTier(null);
    }
  };

  const getBadgeNamePretty = (badge) => {
    if (badge === 'entrepreneur') return 'Space Entrepreneur';
    if (badge === 'professional') return 'Space Professional';
    if (badge === 'enthusiast') return 'Space Enthusiast';
    return 'None';
  };

  return (
    <div style={{ maxWidth: '1240px', margin: '40px auto 80px auto', padding: '0 24px' }}>
      
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <span className="badge-category badge-entrepreneur" style={{ marginBottom: '14px', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 16px', borderRadius: '30px' }}>
          <Sparkles size={14} /> Community Subscription Plans
        </span>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '2.6rem', fontWeight: 800, margin: '8px 0 16px 0', letterSpacing: '-0.02em' }}>
          Connect, Converse & Accelerate in Space
        </h1>
        <p style={{ color: 'var(--text-muted)', maxWidth: '680px', margin: '0 auto', fontSize: '1.05rem', lineHeight: 1.6 }}>
          Choose your community tier to unlock unlimited direct messaging, high-definition voice and video calling, and exclusive aerospace networking.
        </p>
      </div>

      {/* Verification Level Status Banner */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        padding: '16px 24px',
        marginBottom: '36px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: isVerified ? 'rgba(56, 239, 125, 0.15)' : 'rgba(255, 255, 255, 0.08)',
            border: `1px solid ${isVerified ? '#38ef7d' : 'rgba(255, 255, 255, 0.2)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isVerified ? '#38ef7d' : '#fff'
          }}>
            <ShieldCheck size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
              Your Verification Standing
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Badge: <b>{getBadgeNamePretty(currentBadge)}</b></span>
              <span style={{ 
                fontSize: '0.75rem', 
                padding: '2px 8px', 
                borderRadius: '8px',
                background: isVerified ? 'rgba(56, 239, 125, 0.2)' : 'rgba(255, 179, 0, 0.2)',
                color: isVerified ? '#38ef7d' : '#ffb300'
              }}>
                {isVerified ? 'Officially Verified' : 'Unverified Profile'}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ fontSize: '0.88rem', color: '#cbd5e0', maxWidth: '420px', lineHeight: 1.4 }}>
            {userLevel === 3 ? (
              <span>✨ As a verified <b>Space Entrepreneur</b>, you are eligible to subscribe to <b>all three</b> community plans.</span>
            ) : userLevel === 2 ? (
              <span>✨ As a verified <b>Space Professional</b>, you can subscribe to <b>Space Enthusiast</b> and <b>Space Professional</b> plans.</span>
            ) : userLevel === 1 ? (
              <span>✨ As a verified <b>Space Enthusiast</b>, you can subscribe to the <b>Space Enthusiast</b> plan.</span>
            ) : (
              <span>⚠️ Verification badge required to subscribe to plans. Please verify your profile to unlock tiers.</span>
            )}
          </div>
          {!isVerified && (
            <Link to="/profile" className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem', textDecoration: 'none', whiteSpace: 'nowrap' }}>
              Verify Profile <ArrowRight size={14} style={{ marginLeft: '4px' }} />
            </Link>
          )}
        </div>
      </div>

      {errorMsg && (
        <div style={{ 
          background: 'rgba(255, 77, 77, 0.15)', 
          border: '1px solid #ff4d4d', 
          color: '#ffb3b3', 
          padding: '12px 20px', 
          borderRadius: '12px', 
          marginBottom: '24px',
          fontSize: '0.92rem'
        }}>
          {errorMsg}
        </div>
      )}

      {/* Tier Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '28px' }}>
        {plans.map((plan) => {
          const isEligible = userLevel >= plan.requiredLevel;
          const isCurrentActive = activeTier === plan.id;

          return (
            <div 
              key={plan.id}
              className="glass-panel" 
              style={{ 
                padding: '36px', 
                borderRadius: '24px', 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'space-between',
                border: plan.cardBorder,
                background: plan.cardBg,
                boxShadow: plan.glow || '0 8px 32px rgba(0,0,0,0.4)',
                position: 'relative'
              }}
            >
              {plan.featuredBadge && (
                <span style={{ 
                  position: 'absolute', 
                  top: -13, 
                  right: 24, 
                  background: plan.id === 'entrepreneur' 
                    ? 'linear-gradient(135deg, #ffd700 0%, #ff8c00 100%)' 
                    : 'linear-gradient(135deg, #00f2fe 0%, #007aff 100%)', 
                  color: plan.id === 'entrepreneur' ? '#000' : '#fff', 
                  padding: '4px 14px', 
                  borderRadius: '20px', 
                  fontSize: '0.72rem', 
                  fontWeight: 800, 
                  letterSpacing: '0.6px' 
                }}>
                  {plan.featuredBadge}
                </span>
              )}

              <div>
                {/* Title & Icon */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  {plan.icon}
                  <h3 style={{ fontSize: '1.45rem', fontWeight: 800, margin: 0 }}>{plan.title}</h3>
                </div>

                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.4, margin: '8px 0 16px 0', minHeight: '40px' }}>
                  {plan.tagline}
                </p>

                {/* Price */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '20px' }}>
                  <span style={{ fontSize: '2.5rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.03em' }}>{plan.price}</span>
                  <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)', fontWeight: 500 }}>{plan.period}</span>
                </div>

                {/* Free Starter Note for Enthusiast */}
                {plan.freeStarterText && (
                  <div style={{
                    background: 'rgba(0, 242, 254, 0.06)',
                    border: '1px solid rgba(0, 242, 254, 0.18)',
                    borderRadius: '12px',
                    padding: '10px 14px',
                    marginBottom: '18px',
                    fontSize: '0.82rem',
                    color: '#d1f4ff',
                    lineHeight: 1.45
                  }}>
                    <b>Starter Access:</b> {plan.freeStarterText}
                  </div>
                )}

                <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.08)', margin: '16px 0' }}></div>

                {/* Features List */}
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.9rem', color: '#cbd5e0' }}>
                  {plan.features.map((feat, idx) => (
                    <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', lineHeight: 1.45 }}>
                      <Check size={16} strokeWidth={3} style={{ color: '#38ef7d', marginTop: '3px', flexShrink: 0 }} />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action Button & Eligibility check */}
              <div>
                {isCurrentActive ? (
                  <button 
                    disabled
                    style={{
                      width: '100%',
                      padding: '12px 20px',
                      borderRadius: '14px',
                      background: 'rgba(56, 239, 125, 0.2)',
                      border: '1px solid #38ef7d',
                      color: '#38ef7d',
                      fontWeight: 700,
                      cursor: 'default'
                    }}
                  >
                    ✓ Current Active Plan
                  </button>
                ) : isEligible ? (
                  <button 
                    className={plan.id === 'professional' ? 'btn-primary' : 'btn-secondary'}
                    style={{ 
                      width: '100%', 
                      padding: '12px 20px',
                      borderRadius: '14px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={loadingTier === plan.id}
                  >
                    {loadingTier === plan.id ? 'Processing...' : `Upgrade to ${plan.title}`}
                    <ArrowRight size={16} />
                  </button>
                ) : (
                  <div>
                    <button 
                      disabled
                      style={{
                        width: '100%',
                        padding: '12px 20px',
                        borderRadius: '14px',
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: 'rgba(255, 255, 255, 0.4)',
                        fontWeight: 600,
                        cursor: 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}
                    >
                      <Lock size={15} /> Requires {plan.badgeLabel} Badge
                    </button>
                    <div style={{ textAlign: 'center', marginTop: '8px' }}>
                      <Link to="/profile" style={{ fontSize: '0.78rem', color: '#00f2fe', textDecoration: 'none' }}>
                        Apply for {plan.badgeLabel} verification →
                      </Link>
                    </div>
                  </div>
                )}
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
}
