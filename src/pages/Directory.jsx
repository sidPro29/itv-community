import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Search, Filter, Lock, ShieldCheck, Rocket, UserCheck, Briefcase, ChevronRight, MessageSquare, PhoneCall } from 'lucide-react';

export default function Directory() {
  const { currentUser, verificationStatus, API_URL } = useAuth();
  const navigate = useNavigate();

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const fetchMembers = async () => {
    try {
      const token = localStorage.getItem('token');
      const url = new URL(`${API_URL}/community/members`);
      if (selectedCategory !== 'all') url.searchParams.append('category', selectedCategory);
      if (search) url.searchParams.append('search', search);

      const res = await fetch(url.toString(), {
        headers: { 'x-auth-token': token }
      });
      if (res.ok) {
        const data = await res.json();
        setMembers(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error fetching members:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [selectedCategory, search]);

  const isCurrentVerified = verificationStatus === 'verified';

  return (
    <div style={{ maxWidth: '1280px', margin: '40px auto', padding: '0 24px' }}>
      
      {/* Header Banner */}
      <div className="glass-panel" style={{ padding: '36px', borderRadius: '24px', marginBottom: '32px', textAlign: 'center' }}>
        <span className="badge-category badge-professional" style={{ marginBottom: '12px' }}>
          ✨ Verified Space Network
        </span>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '2.4rem', fontWeight: 800, marginBottom: '12px' }}>
          Connect with Top Space Minds
        </h1>
        <p style={{ color: 'var(--text-muted)', maxWidth: '680px', margin: '0 auto 28px auto', fontSize: '1rem', lineHeight: 1.6 }}>
          Discover verified scientists, aerospace engineers, satellite researchers, space founders, and passionate enthusiasts from around the globe.
        </p>

        {!isCurrentVerified && (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '12px',
            background: 'rgba(255, 0, 127, 0.12)',
            border: '1px solid rgba(255, 0, 127, 0.3)',
            color: '#ff007f',
            padding: '12px 24px',
            borderRadius: '50px',
            fontSize: '0.9rem',
            fontWeight: 600
          }}>
            <Lock size={18} />
            <span>Complete & verify your profile to unlock full member details, experience, & connections.</span>
            <button 
              className="btn-primary" 
              style={{ padding: '6px 16px', fontSize: '0.82rem' }}
              onClick={() => navigate('/profile')}
            >
              Verify Profile
            </button>
          </div>
        )}
      </div>

      {/* Controls Bar: Search & Category Filter Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '30px' }}>
        
        {/* Category Tabs */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'All Members', icon: '🌌' },
            { id: 'enthusiast', label: 'Space Enthusiasts', icon: '🚀' },
            { id: 'professional', label: 'Space Professionals', icon: '🧑‍🚀' },
            { id: 'entrepreneur', label: 'Space Entrepreneurs', icon: '💼' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedCategory(tab.id)}
              style={{
                padding: '10px 18px',
                borderRadius: '12px',
                border: '1px solid',
                borderColor: selectedCategory === tab.id ? 'var(--accent-cyan)' : 'var(--border-glass)',
                background: selectedCategory === tab.id ? 'rgba(0, 242, 254, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                color: selectedCategory === tab.id ? '#00f2fe' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', width: '300px' }}>
          <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text"
            className="form-input"
            style={{ width: '100%', paddingLeft: '40px' }}
            placeholder="Search name, title, skill..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Directory Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          Loading Space Network...
        </div>
      ) : members.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '60px', borderRadius: '20px' }}>
          <Rocket size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>No Members Found</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            Try adjusting your search criteria or filter tabs.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
          {members.map(member => (
            <div 
              key={member._id}
              className="glass-panel glass-panel-interactive"
              style={{
                padding: '24px',
                borderRadius: '20px',
                display: 'flex',
                flexDirection: 'column',
                justify: 'space-between',
                position: 'relative'
              }}
            >
              <div>
                {/* Header: Photo & Badge */}
                <div style={{ display: 'flex', items: 'center', gap: '16px', marginBottom: '16px' }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: member.avatarUrl ? `url(${member.avatarUrl}) center/cover` : 'linear-gradient(135deg, #00f2fe, #7928ca)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem',
                    fontWeight: 800,
                    color: '#fff',
                    border: '2px solid rgba(255, 255, 255, 0.2)'
                  }}>
                    {!member.avatarUrl && (member.fullName ? member.fullName.charAt(0).toUpperCase() : 'S')}
                  </div>

                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff' }}>
                      {member.fullName}
                    </h3>
                    <span className={`badge-category badge-${member.category}`} style={{ marginTop: '4px' }}>
                      {member.category.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Body Content depending on Verification Privacy Rule */}
                {member.isLocked ? (
                  <div style={{
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px dashed var(--border-glass)',
                    borderRadius: '12px',
                    padding: '16px',
                    textAlign: 'center',
                    margin: '12px 0'
                  }}>
                    <Lock size={22} style={{ color: '#ff007f', margin: '0 auto 6px auto', display: 'block' }} />
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      Full profile details, experience, & skills are locked until your profile is verified.
                    </p>
                  </div>
                ) : (
                  <div>
                    <p style={{ fontSize: '0.88rem', color: '#cbd5e0', lineHeight: 1.5, marginBottom: '14px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {member.bio || 'Space sector contributor & member of Interplanetary Network.'}
                    </p>

                    {member.skills && member.skills.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                        {member.skills.slice(0, 3).map((skill, sIdx) => (
                          <span key={sIdx} style={{ background: 'rgba(255, 255, 255, 0.08)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', color: '#a0aec0' }}>
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-glass)', paddingTop: '16px', display: 'flex', gap: '8px' }}>
                <button 
                  className="btn-secondary"
                  style={{ flex: 1, padding: '10px 14px', fontSize: '0.85rem' }}
                  onClick={() => navigate(`/members/${member._id}`)}
                >
                  View Profile <ChevronRight size={14} />
                </button>
              </div>

            </div>
          ))}
        </div>
      )}

    </div>
  );
}
