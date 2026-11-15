import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Sparkles, 
  Check, 
  Crown, 
  ShieldCheck, 
  Lock, 
  ArrowRight, 
  Users,
  Briefcase,
  X,
  CreditCard,
  Loader2,
  Info
} from 'lucide-react';

const STRIPE_KEYS = {
  TEST_KEY: 'pk_test_51QXMnwGoExYliEVvZWtX57kEp0pympGoygrsomujWz3e0QQspmRqO0cEzdejsGX4iGTlNbcRc6NFmvv60sIII6wh00pDj3Tvms',
  LIVE_KEY: 'pk_live_51QXMnwGoExYliEVvUJ0Bej64womLcFqX4wS2abP0YHHCQwAdMAgFEAv1Tvxlk9Jrzx3kJ1gtNnS4BEjwb19Zo2oS00j60jbUuj'
};

export default function UpgradeCommunity() {
  const { currentUser, verificationBadge, verificationStatus, refreshProfile, API_URL } = useAuth();
  const navigate = useNavigate();

  const [selectedCycle, setSelectedCycle] = useState('Monthly'); // 'Monthly' | 'Yearly'
  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Stripe Modal States
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [processing, setProcessing] = useState(false);

  const cardElementRef = useRef(null);
  const [stripeInstance, setStripeInstance] = useState(null);
  const [cardInstance, setCardInstance] = useState(null);

  const currentBadge = verificationBadge || currentUser?.verificationBadge || 'none';
  const isVerified = verificationStatus === 'verified' || currentUser?.verificationStatus === 'verified';
  const activeTier = currentUser?.communitySubscription?.tier || 'free';
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superAdmin';

  const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
  const publishableKey = isProduction ? STRIPE_KEYS.LIVE_KEY : STRIPE_KEYS.TEST_KEY;

  const badgeHierarchy = {
    none: 0,
    enthusiast: 1,
    professional: 2,
    entrepreneur: 3
  };

  const userLevel = isAdmin ? 3 : (badgeHierarchy[currentBadge] || 0);

  // Fetch plans from backend API
  useEffect(() => {
    async function fetchPlans() {
      try {
        setLoadingPlans(true);
        const res = await fetch(`${API_URL}/plans`);
        if (res.ok) {
          const data = await res.json();
          // Filter community plans only
          const commPlans = data.filter(p => 
            p.type === 'community' || 
            p.category === 'community' ||
            p.name.toLowerCase().includes('space')
          );
          setPlans(commPlans);
        }
      } catch (err) {
        console.error('Failed to fetch community plans:', err);
      } finally {
        setLoadingPlans(false);
      }
    }
    fetchPlans();
  }, [API_URL]);

  // Mount Stripe Card Element in Modal
  useEffect(() => {
    if (!isModalOpen || !selectedPlan) return;

    let stripe = null;
    let elements = null;
    let card = null;

    const timer = setTimeout(() => {
      if (window.Stripe) {
        try {
          stripe = window.Stripe(publishableKey);
          setStripeInstance(stripe);

          elements = stripe.elements();
          card = elements.create('card', {
            style: {
              base: {
                color: '#ffffff',
                fontFamily: '"Plus Jakarta Sans", sans-serif',
                fontSize: '16px',
                '::placeholder': {
                  color: '#94a3b8'
                }
              },
              invalid: {
                color: '#ff4d4d',
                iconColor: '#ff4d4d'
              }
            }
          });
          setCardInstance(card);

          if (cardElementRef.current) {
            card.mount(cardElementRef.current);
          }
        } catch (e) {
          console.error('Stripe initialization error:', e);
          setPaymentError('Unable to initialize Stripe.');
        }
      } else {
        setPaymentError('Stripe library not loaded. Please refresh the page.');
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      if (card) {
        try {
          card.unmount();
        } catch (e) {}
      }
    };
  }, [isModalOpen, selectedPlan, publishableKey]);

  // Plan Definitions with exact 10x yearly pricing
  const planTiers = [
    {
      tierId: 'enthusiast',
      title: 'Space Enthusiast',
      requiredLevel: 1,
      badgeLabel: 'Space Enthusiast',
      monthlyPrice: '€1.99',
      yearlyPrice: '€19.90',
      monthlyAmount: 1.99,
      yearlyAmount: 19.90,
      tagline: 'Step inside the global space community and connect with fellow pioneers.',
      freeStarterText: 'Start Free: Create & verify profile, upload photo/banner/resume, browse directory & send friend requests.',
      features: [
        'Verified Member Profile (photo, banner, bio & resume)',
        'Browse Global Space Directory & send friend requests',
        'Unlimited Private Text Messaging with all members',
        'Unlimited Voice & 4K Video Calling across the network',
        'Personal contact details hidden for privacy & safety'
      ],
      icon: <Users size={24} style={{ color: 'var(--accent-cyan)' }} />,
      cardBorder: '1px solid rgba(0, 242, 254, 0.25)',
      cardBg: 'rgba(13, 19, 38, 0.75)'
    },
    {
      tierId: 'professional',
      title: 'Space Professional',
      requiredLevel: 2,
      badgeLabel: 'Space Professional',
      featuredBadge: 'MOST POPULAR',
      monthlyPrice: '€9.99',
      yearlyPrice: '€99.90',
      monthlyAmount: 9.99,
      yearlyAmount: 99.90,
      tagline: 'Built for verified industry specialists ready to showcase credentials & expand reach.',
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
      tierId: 'entrepreneur',
      title: 'Space Entrepreneur',
      requiredLevel: 3,
      badgeLabel: 'Space Entrepreneur',
      featuredBadge: 'CAPITAL & VC ACCESS',
      monthlyPrice: '€19.99',
      yearlyPrice: '€199.90',
      monthlyAmount: 19.99,
      yearlyAmount: 199.90,
      tagline: 'Accelerate your venture with direct capital connections & tailored matchmaking.',
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

  const handleOpenCheckout = (tier) => {
    setErrorMsg('');
    const targetAmount = selectedCycle === 'Yearly' ? tier.yearlyAmount : tier.monthlyAmount;
    
    // Find matching plan from fetched DB plans
    let matchedPlan = plans.find(p => 
      p.billingCycle === selectedCycle && 
      p.name.toLowerCase().includes(tier.tierId)
    );

    if (!matchedPlan) {
      // Fallback: match by amount & billingCycle
      matchedPlan = plans.find(p => 
        p.billingCycle === selectedCycle && 
        Math.abs(p.amount - targetAmount) < 0.5
      );
    }

    const planToSelect = matchedPlan || {
      _id: `comm_${tier.tierId}_${selectedCycle.toLowerCase()}`,
      name: `${tier.title} - ${selectedCycle} (${selectedCycle === 'Yearly' ? tier.yearlyPrice : tier.monthlyPrice} + VAT)`,
      amount: targetAmount,
      billingCycle: selectedCycle,
      tierId: tier.tierId,
      tagline: tier.tagline
    };

    setSelectedPlan(planToSelect);
    setIsModalOpen(true);
    setPaymentError('');
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    if (!stripeInstance || !cardInstance || !selectedPlan) return;

    setProcessing(true);
    setPaymentError('');

    try {
      const tokenResult = await stripeInstance.createToken(cardInstance);
      if (tokenResult.error) {
        setPaymentError(tokenResult.error.message);
        setProcessing(false);
        return;
      }

      const authToken = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json'
      };
      if (authToken) headers['x-auth-token'] = authToken;

      // Call Backend Purchase API
      const purchaseRes = await fetch(`${API_URL}/plans/purchase`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          planId: selectedPlan._id,
          stripeTokenId: tokenResult.token.id
        })
      });

      const purchaseData = await purchaseRes.json();
      if (!purchaseRes.ok) {
        throw new Error(purchaseData.msg || 'Payment failed.');
      }

      alert(`🎉 Congratulations! You have successfully upgraded to ${selectedPlan.name}.`);
      setIsModalOpen(false);
      setSelectedPlan(null);
      await refreshProfile();
      navigate('/members');
    } catch (err) {
      console.error(err);
      setPaymentError(err.message || 'Payment processing failed. Please try again.');
    } finally {
      setProcessing(false);
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
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <span className="badge-category badge-entrepreneur" style={{ marginBottom: '14px', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 16px', borderRadius: '30px' }}>
          <Sparkles size={14} /> Community Subscription Plans
        </span>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '2.6rem', fontWeight: 800, margin: '8px 0 14px 0', letterSpacing: '-0.02em' }}>
          Connect, Converse & Accelerate in Space
        </h1>
        <p style={{ color: 'var(--text-muted)', maxWidth: '680px', margin: '0 auto', fontSize: '1.05rem', lineHeight: 1.6 }}>
          Choose your community tier to unlock unlimited direct messaging, high-definition voice & video calling, and exclusive aerospace networking.
        </p>

        {/* Monthly / Yearly Toggle (10x Monthly Price = 2 Months Free) */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '28px' }}>
          <div style={{
            display: 'inline-flex',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '30px',
            padding: '4px',
            backdropFilter: 'blur(10px)'
          }}>
            <button
              onClick={() => setSelectedCycle('Monthly')}
              style={{
                background: selectedCycle === 'Monthly' ? 'linear-gradient(135deg, #007aff 0%, #004094 100%)' : 'transparent',
                color: selectedCycle === 'Monthly' ? '#fff' : 'var(--text-muted)',
                border: 'none',
                padding: '8px 24px',
                borderRadius: '26px',
                fontWeight: 700,
                fontSize: '0.92rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Monthly
            </button>
            <button
              onClick={() => setSelectedCycle('Yearly')}
              style={{
                background: selectedCycle === 'Yearly' ? 'linear-gradient(135deg, #007aff 0%, #004094 100%)' : 'transparent',
                color: selectedCycle === 'Yearly' ? '#fff' : 'var(--text-muted)',
                border: 'none',
                padding: '8px 24px',
                borderRadius: '26px',
                fontWeight: 700,
                fontSize: '0.92rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease'
              }}
            >
              <span>Yearly</span>
              <span style={{
                background: '#38ef7d',
                color: '#051a0e',
                fontSize: '0.7rem',
                fontWeight: 800,
                padding: '2px 6px',
                borderRadius: '6px'
              }}>
                Save ~17% (2 Mo Free)
              </span>
            </button>
          </div>
        </div>
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
          <div style={{ fontSize: '0.88rem', color: '#cbd5e0', maxWidth: '440px', lineHeight: 1.4 }}>
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
        {planTiers.map((tier) => {
          const isEligible = userLevel >= tier.requiredLevel;
          const isCurrentActive = activeTier === tier.tierId;
          const displayPrice = selectedCycle === 'Yearly' ? tier.yearlyPrice : tier.monthlyPrice;
          const periodLabel = selectedCycle === 'Yearly' ? '/ year (+VAT)' : '/ month (+VAT)';

          return (
            <div 
              key={tier.tierId}
              className="glass-panel" 
              style={{ 
                padding: '36px', 
                borderRadius: '24px', 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'space-between',
                border: tier.cardBorder,
                background: tier.cardBg,
                boxShadow: tier.glow || '0 8px 32px rgba(0,0,0,0.4)',
                position: 'relative'
              }}
            >
              {tier.featuredBadge && (
                <span style={{ 
                  position: 'absolute', 
                  top: -13, 
                  right: 24, 
                  background: tier.tierId === 'entrepreneur' 
                    ? 'linear-gradient(135deg, #ffd700 0%, #ff8c00 100%)' 
                    : 'linear-gradient(135deg, #00f2fe 0%, #007aff 100%)', 
                  color: tier.tierId === 'entrepreneur' ? '#000' : '#fff', 
                  padding: '4px 14px', 
                  borderRadius: '20px', 
                  fontSize: '0.72rem', 
                  fontWeight: 800, 
                  letterSpacing: '0.6px' 
                }}>
                  {tier.featuredBadge}
                </span>
              )}

              <div>
                {/* Title & Icon */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  {tier.icon}
                  <h3 style={{ fontSize: '1.45rem', fontWeight: 800, margin: 0 }}>{tier.title}</h3>
                </div>

                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.4, margin: '8px 0 16px 0', minHeight: '40px' }}>
                  {tier.tagline}
                </p>

                {/* Price */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '20px' }}>
                  <span style={{ fontSize: '2.5rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.03em' }}>{displayPrice}</span>
                  <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)', fontWeight: 500 }}>{periodLabel}</span>
                </div>

                {/* Free Starter Note for Enthusiast */}
                {tier.freeStarterText && (
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
                    <b>Starter Access:</b> {tier.freeStarterText}
                  </div>
                )}

                <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.08)', margin: '16px 0' }}></div>

                {/* Features List */}
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.9rem', color: '#cbd5e0' }}>
                  {tier.features.map((feat, idx) => (
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
                    className={tier.tierId === 'professional' ? 'btn-primary' : 'btn-secondary'}
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
                    onClick={() => handleOpenCheckout(tier)}
                  >
                    Upgrade to {tier.title} ({displayPrice})
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
                      <Lock size={15} /> Requires {tier.badgeLabel} Badge
                    </button>
                    <div style={{ textAlign: 'center', marginTop: '8px' }}>
                      <Link to="/profile" style={{ fontSize: '0.78rem', color: '#00f2fe', textDecoration: 'none' }}>
                        Apply for {tier.badgeLabel} verification →
                      </Link>
                    </div>
                  </div>
                )}
              </div>

            </div>
          );
        })}
      </div>

      {/* Stripe Payment Modal */}
      {isModalOpen && selectedPlan && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999,
          padding: '20px'
        }} onClick={() => setIsModalOpen(false)}>
          
          <div style={{
            background: '#0d1326',
            border: '1px solid rgba(0, 242, 254, 0.3)',
            borderRadius: '24px',
            padding: '32px',
            width: '100%',
            maxWidth: '480px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
            position: 'relative'
          }} onClick={e => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CreditCard size={22} style={{ color: '#00f2fe' }} />
                <h3 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0 }}>Community Subscription</h3>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Plan Summary */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '16px 20px',
              marginBottom: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#00f2fe', fontWeight: 800 }}>
                  Space Community Plan
                </span>
                <h4 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '4px 0 0 0' }}>{selectedPlan.name}</h4>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff' }}>€{selectedPlan.amount}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>/ {selectedPlan.billingCycle === 'Yearly' ? 'Year' : 'Month'}</div>
              </div>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 20px 0' }}>
              <Info size={14} style={{ flexShrink: 0 }} />
              <span>VAT or GST added upon checkout. Real-time activation via Stripe.</span>
            </p>

            {/* Payment Form */}
            <form onSubmit={handlePaymentSubmit}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e0', marginBottom: '8px' }}>
                  Card Details (Credit / Debit)
                </label>
                <div 
                  ref={cardElementRef}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '12px',
                    padding: '14px 16px'
                  }}
                />
              </div>

              {paymentError && (
                <div style={{
                  background: 'rgba(255, 77, 77, 0.15)',
                  border: '1px solid #ff4d4d',
                  color: '#ffb3b3',
                  padding: '10px 16px',
                  borderRadius: '10px',
                  fontSize: '0.85rem',
                  marginBottom: '16px'
                }}>
                  {paymentError}
                </div>
              )}

              <button
                type="submit"
                disabled={processing}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, #007aff 0%, #004094 100%)',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 800,
                  fontSize: '1rem',
                  cursor: processing ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 0 20px rgba(0, 122, 255, 0.4)'
                }}
              >
                {processing ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    <span>Processing Payment...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={18} />
                    <span>Pay €{selectedPlan.amount} & Activate Tier</span>
                  </>
                )}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              🔒 256-Bit Encrypted Payment powered by Stripe
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
