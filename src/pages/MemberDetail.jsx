import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Lock, MessageSquare, PhoneCall, Video, Briefcase, GraduationCap, Award, Link as LinkIcon, Building, ChevronLeft, Sparkles, AlertCircle } from 'lucide-react';

export default function MemberDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { verificationStatus, API_URL } = useAuth();

  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMemberDetail = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/community/members/${id}`, {
        headers: { 'x-auth-token': token }
      });
      if (!res.ok) {
        throw new Error('Member profile not found or permission denied');
      }
      const data = await res.json();
      setMember(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMemberDetail();
  }, [id]);

  const handleToggleBlock = async () => {
    try {
      const token = localStorage.getItem('token');
      const endpoint = member.isBlockedByMe ? `/community/unblock/${id}` : `/community/block/${id}`;
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'x-auth-token': token }
      });
      if (res.ok) {
        setMember(prev => ({ ...prev, isBlockedByMe: !prev.isBlockedByMe }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleConnectAction = (actionType) => {
    if (member?.communityTier === 'free') {
      navigate('/upgrade');
    } else {
      navigate(`/messages?recipient=${id}&action=${actionType}`);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '100px', color: 'var(--text-muted)' }}>Loading Profile...</div>;
  }

  if (error || !member) {
    return (
      <div style={{ maxWidth: '600px', margin: '80px auto', padding: '0 20px', textAlign: 'center' }}>
        <div className="glass-panel" style={{ padding: '40px' }}>
          <AlertCircle size={40} style={{ color: '#ff4d4d', marginBottom: '12px' }} />
          <h3>Member Profile Unavailable</h3>
          <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>{error}</p>
          <button className="btn-secondary" style={{ marginTop: '20px' }} onClick={() => navigate('/members')}>
            <ChevronLeft size={16} /> Back to Directory
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '960px', margin: '40px auto', padding: '0 20px' }}>
      
      {/* Back Button */}
      <button className="btn-secondary" style={{ marginBottom: '20px' }} onClick={() => navigate('/members')}>
        <ChevronLeft size={16} /> Back to Directory
      </button>

      {/* Profile Header Banner */}
      <div className="glass-panel" style={{ borderRadius: '24px', overflow: 'hidden', marginBottom: '30px' }}>
        {/* Cover Graphic */}
        <div style={{
          height: '160px',
          background: 'linear-gradient(135deg, rgba(0, 242, 254, 0.25) 0%, rgba(121, 40, 202, 0.3) 100%)',
          position: 'relative'
        }} />

        <div style={{ padding: '0 32px 32px 32px', position: 'relative', marginTop: '-50px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
            
            {/* Avatar & Title */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '20px' }}>
              <div style={{
                width: '100px',
                height: '100px',
                borderRadius: '50%',
                background: member.avatarUrl ? `url(${member.avatarUrl}) center/cover` : 'linear-gradient(135deg, #00f2fe, #7928ca)',
                border: '4px solid var(--bg-dark)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2.5rem',
                fontWeight: 800,
                color: '#fff',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
              }}>
                {!member.avatarUrl && member.fullName.charAt(0).toUpperCase()}
              </div>

              <div style={{ marginBottom: '6px' }}>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.8rem', fontWeight: 800 }}>
                  {member.fullName}
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                  <span className={`badge-category badge-${member.category}`}>
                    🚀 {member.category.toUpperCase()}
                  </span>
                  {member.location && (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>📍 {member.location}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Interactive Buttons */}
            {!member.isLocked && (
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button className="btn-primary" onClick={() => handleConnectAction('text')} disabled={member.isBlockedByMe}>
                  <MessageSquare size={16} /> Private Message
                </button>
                <button className="btn-secondary" onClick={() => handleConnectAction('audio')} disabled={member.isBlockedByMe}>
                  <PhoneCall size={16} /> Audio Call
                </button>
                <button className="btn-secondary" onClick={() => handleConnectAction('video')} disabled={member.isBlockedByMe}>
                  <Video size={16} /> Video Call
                </button>
                <button 
                  className="btn-secondary" 
                  style={{ color: member.isBlockedByMe ? '#38ef7d' : '#ff4d4d', borderColor: member.isBlockedByMe ? '#38ef7d' : '#ff4d4d' }}
                  onClick={handleToggleBlock}
                >
                  {member.isBlockedByMe ? 'Unblock Member' : 'Block Member'}
                </button>
              </div>
            )}
          </div>

          <p style={{ marginTop: '20px', color: '#e2e8f0', fontSize: '1rem', lineHeight: 1.6 }}>
            {member.bio || 'Space enthusiast & member of the Interplanetary Community.'}
          </p>
        </div>
      </div>

      {/* Privacy Gate Warning if Locked */}
      {member.isLocked ? (
        <div className="glass-panel" style={{ padding: '40px', borderRadius: '20px', textAlign: 'center' }}>
          <Lock size={48} style={{ color: '#ff007f', margin: '0 auto 16px auto', display: 'block' }} />
          <h3 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Full Profile Locked</h3>
          <p style={{ color: 'var(--text-muted)', maxWidth: '500px', margin: '8px auto 24px auto', fontSize: '0.95rem' }}>
            To protect community members, full career experience, degrees, skills, and business profiles are accessible to verified members only.
          </p>
          <button className="btn-primary" onClick={() => navigate('/profile')}>
            <Shield size={18} /> Complete & Verify Your Profile
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          
          {/* Section 1: Work Experience */}
          {member.workExperience && member.workExperience.length > 0 && (
            <div className="glass-panel" style={{ padding: '30px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Briefcase size={20} style={{ color: 'var(--accent-cyan)' }} /> Work Experience
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {member.workExperience.map((exp, idx) => (
                  <div key={idx} style={{ borderLeft: '2px solid var(--accent-cyan)', paddingLeft: '16px' }}>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff' }}>{exp.role}</h4>
                    <p style={{ color: 'var(--accent-cyan)', fontSize: '0.9rem', fontWeight: 600 }}>{exp.company}</p>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{exp.startDate} - {exp.endDate || 'Present'}</span>
                    {exp.description && <p style={{ marginTop: '6px', color: '#cbd5e0', fontSize: '0.9rem' }}>{exp.description}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 2: Education */}
          {member.education && member.education.length > 0 && (
            <div className="glass-panel" style={{ padding: '30px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <GraduationCap size={20} style={{ color: 'var(--accent-cyan)' }} /> Education & Degrees
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {member.education.map((edu, idx) => (
                  <div key={idx} style={{ borderLeft: '2px solid var(--accent-purple)', paddingLeft: '16px' }}>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff' }}>{edu.degree}</h4>
                    <p style={{ color: '#cbd5e0', fontSize: '0.9rem' }}>{edu.institution}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 3: Skills & Expertise */}
          {member.skills && member.skills.length > 0 && (
            <div className="glass-panel" style={{ padding: '30px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Award size={20} style={{ color: 'var(--accent-gold)' }} /> Verified Skills & Expertise
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {member.skills.map((skill, i) => (
                  <span key={i} style={{ background: 'rgba(0, 242, 254, 0.12)', border: '1px solid rgba(0, 242, 254, 0.3)', color: '#00f2fe', padding: '6px 14px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600 }}>
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Section 4: Business Details */}
          {member.businessDetails && member.businessDetails.companyName && (
            <div className="glass-panel" style={{ padding: '30px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Building size={20} style={{ color: 'var(--accent-gold)' }} /> Business & Company Details
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Company Name</span>
                  <p style={{ fontWeight: 700, fontSize: '1rem', color: '#fff' }}>{member.businessDetails.companyName}</p>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Designation</span>
                  <p style={{ fontWeight: 700, fontSize: '1rem', color: '#fff' }}>{member.businessDetails.designation || 'Founder / Executive'}</p>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
