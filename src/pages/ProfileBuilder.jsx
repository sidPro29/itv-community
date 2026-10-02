import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Edit3, Eye, User, Shield, Briefcase, GraduationCap, Award, FileText, CheckCircle2, Clock, AlertTriangle, Plus, Trash2, Link as LinkIcon, Building, Upload, Loader2, MapPin, ExternalLink, Globe, X } from 'lucide-react';

export default function ProfileBuilder() {
  const { currentUser, communityProfile, verificationStatus, verificationBadge, refreshProfile, API_URL } = useAuth();
  
  const [isEditing, setIsEditing] = useState(false);

  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [category, setCategory] = useState('enthusiast');
  const [location, setLocation] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [additionalLinks, setAdditionalLinks] = useState([]);
  const [workExperience, setWorkExperience] = useState([]);
  const [education, setEducation] = useState([]);
  const [skills, setSkills] = useState([]);
  const [skillInput, setSkillInput] = useState('');
  const [certificates, setCertificates] = useState([]);
  const [businessDetails, setBusinessDetails] = useState({ companyName: '', designation: '', website: '', industry: '', description: '' });

  // Verification Documents
  const [idDocumentUrl, setIdDocumentUrl] = useState('');
  const [docType, setDocType] = useState('Aadhaar Card');
  const [legalName, setLegalName] = useState('');
  const [address, setAddress] = useState('');

  const [saving, setSaving] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingCertIndex, setUploadingCertIndex] = useState(null);
  const [uploadedDocName, setUploadedDocName] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const uploadFileToServer = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/upload`, {
      method: 'POST',
      headers: { 'x-auth-token': token },
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'File upload failed');
    return data.url || `${API_URL}${data.relativeUrl}`;
  };

  const handleIdFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingDoc(true);
    setErrorMsg('');

    try {
      const fileUrl = await uploadFileToServer(file);
      setIdDocumentUrl(fileUrl);
      setUploadedDocName(file.name);
    } catch (err) {
      setErrorMsg('Govt ID upload error: ' + err.message);
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleAvatarFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingAvatar(true);
    setErrorMsg('');

    try {
      const fileUrl = await uploadFileToServer(file);
      setAvatarUrl(fileUrl);
    } catch (err) {
      setErrorMsg('Avatar upload error: ' + err.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleCoverFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingCover(true);
    setErrorMsg('');

    try {
      const fileUrl = await uploadFileToServer(file);
      setCoverUrl(fileUrl);
    } catch (err) {
      setErrorMsg('Cover banner upload error: ' + err.message);
    } finally {
      setUploadingCover(false);
    }
  };

  const handleCertFileUpload = async (e, idx) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingCertIndex(idx);
    setErrorMsg('');

    try {
      const fileUrl = await uploadFileToServer(file);
      const updated = [...certificates];
      updated[idx].credentialUrl = fileUrl;
      setCertificates(updated);
    } catch (err) {
      setErrorMsg('Certificate file upload error: ' + err.message);
    } finally {
      setUploadingCertIndex(null);
    }
  };

  useEffect(() => {
    if (currentUser && communityProfile) {
      setFullName(communityProfile.fullName || currentUser.username || '');
      setBio(communityProfile.bio || '');
      setCategory(communityProfile.category || 'enthusiast');
      setLocation(communityProfile.location || '');
      setAvatarUrl(communityProfile.avatarUrl || '');
      setCoverUrl(communityProfile.coverUrl || '');
      setLinkedinUrl(communityProfile.linkedinUrl || '');
      setAdditionalLinks(communityProfile.additionalLinks || []);
      setWorkExperience(communityProfile.workExperience || []);
      setEducation(communityProfile.education || []);
      setSkills(communityProfile.skills || []);
      setCertificates(communityProfile.certificates || []);
      if (communityProfile.businessDetails) setBusinessDetails(communityProfile.businessDetails);

      if (currentUser.verificationDocs) {
        setIdDocumentUrl(currentUser.verificationDocs.idDocumentUrl || '');
        setDocType(currentUser.verificationDocs.docType || 'Aadhaar / Passport / Govt ID');
        setLegalName(currentUser.verificationDocs.legalName || '');
        setAddress(currentUser.verificationDocs.address || '');
      }
    }
  }, [currentUser, communityProfile]);

  const handleAddLink = () => {
    setAdditionalLinks([...additionalLinks, { label: '', url: '' }]);
  };

  const handleAddExp = () => {
    setWorkExperience([...workExperience, { company: '', role: '', startDate: '', endDate: '', current: false, description: '' }]);
  };

  const handleAddEdu = () => {
    setEducation([...education, { institution: '', degree: '', fieldOfStudy: '', startYear: '', endYear: '' }]);
  };

  const handleAddCert = () => {
    setCertificates([...certificates, { title: '', issuer: '', issueDate: '', credentialUrl: '' }]);
  };

  const handleAddSkill = () => {
    if (skillInput.trim() && !skills.includes(skillInput.trim())) {
      setSkills([...skills, skillInput.trim()]);
      setSkillInput('');
    }
  };

  const getBioWordCount = (text) => {
    if (!text || !text.trim()) return 0;
    return text.trim().split(/\s+/).length;
  };

  const handleBioChange = (e) => {
    const text = e.target.value;
    const words = text.trim() ? text.trim().split(/\s+/) : [];
    if (words.length <= 250) {
      setBio(text);
    } else {
      // Keep up to 250 words
      setBio(words.slice(0, 250).join(' '));
    }
  };

  const handleSubmit = async (submitForVerification = false) => {
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    if (getBioWordCount(bio) > 250) {
      setErrorMsg('Bio cannot exceed 250 words.');
      setSaving(false);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const payload = {
        fullName,
        bio,
        category,
        location,
        avatarUrl,
        coverUrl,
        linkedinUrl,
        additionalLinks,
        workExperience,
        education,
        skills,
        certificates,
        businessDetails,
        verificationDocs: {
          idDocumentUrl,
          docType,
          legalName,
          address
        },
        submitForVerification
      };

      const res = await fetch(`${API_URL}/community/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.msg || 'Failed to save profile');

      setSuccessMsg(submitForVerification ? 'Profile & Verification documents submitted! Pending review by ITV Admin.' : 'Profile draft saved successfully!');
      await refreshProfile();
      setIsEditing(false); // Return back to View Mode!
    } catch (err) {
      setErrorMsg(err.message || 'Error updating profile');
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = () => {
    if (verificationStatus === 'verified') {
      return (
        <span className={`status-pill pill-verified pill-${verificationBadge}`}>
          <Shield size={12} /> VERIFIED {verificationBadge.toUpperCase()}
        </span>
      );
    }
    if (verificationStatus === 'pending') {
      return <span className="status-pill pill-pending"><Clock size={12} /> PENDING VERIFICATION</span>;
    }
    return <span className="status-pill pill-incomplete"><AlertTriangle size={12} /> UNVERIFIED / INCOMPLETE</span>;
  };

  return (
    <div style={{ maxWidth: '960px', margin: '40px auto', padding: '0 20px' }}>
      
      {successMsg && (
        <div style={{ background: 'rgba(56, 239, 125, 0.15)', border: '1px solid rgba(56, 239, 125, 0.3)', color: '#38ef7d', padding: '14px 20px', borderRadius: '12px', marginBottom: '24px' }}>
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div style={{ background: 'rgba(255, 77, 77, 0.15)', border: '1px solid rgba(255, 77, 77, 0.3)', color: '#ff4d4d', padding: '14px 20px', borderRadius: '12px', marginBottom: '24px' }}>
          {errorMsg}
        </div>
      )}

      {/* 1. TOP HERO PROFILE CARD (Matches sc1 layout for own profile) */}
      <div className="glass-panel" style={{ borderRadius: '24px', overflow: 'hidden', marginBottom: '30px', position: 'relative' }}>
        
        {/* Cover Banner Graphic */}
        <div style={{
          height: '180px',
          background: coverUrl ? `url(${coverUrl}) center/cover` : 'linear-gradient(135deg, rgba(0, 242, 254, 0.25) 0%, rgba(121, 40, 202, 0.35) 100%)',
          position: 'relative'
        }}>
          {/* Mode Toggle Button on Top Right */}
          <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10 }}>
            <button 
              onClick={() => setIsEditing(!isEditing)} 
              className={isEditing ? "btn-secondary" : "btn-primary"}
              style={{ padding: '8px 18px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.5)' }}
            >
              {isEditing ? (
                <>
                  <Eye size={16} /> View Profile Mode
                </>
              ) : (
                <>
                  <Edit3 size={16} /> Edit Profile
                </>
              )}
            </button>
          </div>
        </div>

        {/* Profile Details Header */}
        <div style={{ padding: '0 32px 32px 32px', position: 'relative', marginTop: '-55px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
            
            {/* Avatar & Name */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '20px' }}>
              <div style={{
                width: '110px',
                height: '110px',
                borderRadius: '50%',
                background: avatarUrl ? `url(${avatarUrl}) center/cover` : 'linear-gradient(135deg, #00f2fe, #7928ca)',
                border: '4px solid var(--bg-dark)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2.8rem',
                fontWeight: 800,
                color: '#fff',
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                flexShrink: 0
              }}>
                {!avatarUrl && (fullName ? fullName.charAt(0).toUpperCase() : 'U')}
              </div>

              <div style={{ marginBottom: '6px' }}>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.8rem', fontWeight: 800 }}>
                  {fullName || currentUser?.username || 'Space Member'}
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px', flexWrap: 'wrap' }}>
                  <span className={`badge-category badge-${category}`}>
                    🚀 {category.toUpperCase()}
                  </span>
                  {getStatusBadge()}
                  {location && (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <MapPin size={14} /> {location}
                    </span>
                  )}
                </div>
              </div>
            </div>

          </div>

          {/* Bio Headline */}
          <p style={{ marginTop: '20px', color: '#e2e8f0', fontSize: '1.05rem', lineHeight: 1.6 }}>
            {bio || 'Space enthusiast & member of the Interplanetary Community.'}
          </p>
        </div>
      </div>

      {/* 2. SECOND BLOCK: VIEW MODE vs EDIT MODE */}
      {!isEditing ? (
        /* --- VIEW MODE --- */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Verification Status Card */}
          <div className="glass-panel" style={{ padding: '24px', borderRadius: '20px' }}>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Shield size={20} style={{ color: 'var(--accent-gold)' }} /> Verification & Security Status
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status</span>
                <p style={{ fontWeight: 700, fontSize: '1rem', color: verificationStatus === 'verified' ? '#38ef7d' : '#ffaa00', marginTop: '2px' }}>
                  {verificationStatus === 'verified' ? '✓ Verified Community Member' : verificationStatus === 'pending' ? '⏳ Under Review by ITV Admin' : '⚠️ Unsubmitted Profile'}
                </p>
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Govt ID Document</span>
                <p style={{ fontWeight: 600, fontSize: '0.95rem', color: idDocumentUrl ? '#38ef7d' : '#ff4d4d', marginTop: '2px' }}>
                  {idDocumentUrl ? `✓ Attached (${docType})` : '✕ Document Missing'}
                </p>
              </div>
            </div>
            {verificationStatus !== 'verified' && (
              <button className="btn-primary" style={{ marginTop: '16px' }} onClick={() => setIsEditing(true)}>
                <Shield size={16} /> Complete Details & Submit Verification
              </button>
            )}
          </div>

          {/* LinkedIn & Portfolio Links */}
          {(linkedinUrl || additionalLinks.length > 0) && (
            <div className="glass-panel" style={{ padding: '24px', borderRadius: '20px' }}>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <LinkIcon size={20} style={{ color: 'var(--accent-cyan)' }} /> Online Profiles & Links
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                {linkedinUrl && (
                  <a href={linkedinUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
                    <Globe size={14} /> LinkedIn Profile <ExternalLink size={12} />
                  </a>
                )}
                {additionalLinks.map((l, i) => (
                  l.url && (
                    <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
                      <Globe size={14} /> {l.label || 'Link'} <ExternalLink size={12} />
                    </a>
                  )
                ))}
              </div>
            </div>
          )}

          {/* Work Experience */}
          {workExperience.length > 0 && (
            <div className="glass-panel" style={{ padding: '24px', borderRadius: '20px' }}>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Briefcase size={20} style={{ color: 'var(--accent-cyan)' }} /> Work Experience
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {workExperience.map((w, i) => (
                  <div key={i} style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
                    <h5 style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff' }}>{w.role || 'Position'}</h5>
                    <p style={{ color: 'var(--accent-cyan)', fontSize: '0.85rem' }}>{w.company} • {w.startDate} - {w.endDate || 'Present'}</p>
                    {w.description && <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>{w.description}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Education */}
          {education.length > 0 && (
            <div className="glass-panel" style={{ padding: '24px', borderRadius: '20px' }}>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <GraduationCap size={20} style={{ color: 'var(--accent-cyan)' }} /> Education & Degrees
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {education.map((e, i) => (
                  <div key={i} style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
                    <h5 style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff' }}>{e.degree}</h5>
                    <p style={{ color: 'var(--accent-cyan)', fontSize: '0.85rem' }}>{e.institution}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Skills */}
          {skills.length > 0 && (
            <div className="glass-panel" style={{ padding: '24px', borderRadius: '20px' }}>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Award size={20} style={{ color: 'var(--accent-cyan)' }} /> Skills & Expertise
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {skills.map((s, i) => (
                  <span key={i} style={{ background: 'rgba(0, 242, 254, 0.12)', border: '1px solid rgba(0, 242, 254, 0.3)', color: '#00f2fe', padding: '6px 14px', borderRadius: '16px', fontSize: '0.85rem', fontWeight: 600 }}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Certificates */}
          {certificates.length > 0 && (
            <div className="glass-panel" style={{ padding: '24px', borderRadius: '20px' }}>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Award size={20} style={{ color: 'var(--accent-cyan)' }} /> Certificates & Credentials
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {certificates.map((c, i) => (
                  <div key={i} style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
                    <h5 style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fff' }}>{c.title}</h5>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{c.issuer} ({c.issueDate})</p>
                    {c.credentialUrl && (
                      <a href={c.credentialUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#00f2fe', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                        View Credential <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Business Details */}
          {businessDetails.companyName && (
            <div className="glass-panel" style={{ padding: '24px', borderRadius: '20px' }}>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Building size={20} style={{ color: 'var(--accent-cyan)' }} /> Business Details
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Company</span>
                  <p style={{ fontWeight: 700, color: '#fff' }}>{businessDetails.companyName}</p>
                </div>
                <div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Title</span>
                  <p style={{ fontWeight: 700, color: '#fff' }}>{businessDetails.designation || 'Founder / Executive'}</p>
                </div>
              </div>
            </div>
          )}

        </div>
      ) : (
        /* --- EDIT MODE FORM --- */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          
          {/* Section 1: Basic Info & Category */}
          <div className="glass-panel" style={{ padding: '30px' }}>
            <h4 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <User size={20} style={{ color: 'var(--accent-cyan)' }} /> 1. Personal Info & Category
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div className="form-group">
                <label>Full Name *</label>
                <input type="text" className="form-input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Dr. Sarah Jenkins" />
              </div>

              <div className="form-group">
                <label>Category Badge Selection *</label>
                <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="enthusiast">Space Enthusiast 🚀</option>
                  <option value="professional">Space Professional 🧑‍🚀</option>
                  <option value="entrepreneur">Space Entrepreneur 💼</option>
                </select>
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ margin: 0 }}>Bio / Headline</label>
                  <span style={{ fontSize: '0.8rem', color: getBioWordCount(bio) > 240 ? '#ff4d4d' : 'var(--text-muted)' }}>
                    {getBioWordCount(bio)} / 250 words max
                  </span>
                </div>
                <textarea className="form-textarea" rows={3} value={bio} onChange={handleBioChange} placeholder="Brief introduction about your passion, research, or business in the space sector (Max 250 words)..." />
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Location / City, Country</label>
                <input type="text" className="form-input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Bengaluru, India / Houston, USA" />
              </div>

              {/* Profile Avatar Image Field */}
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 600 }}>Profile Avatar Image (Upload from Computer or Enter Link)</span>
                  {avatarUrl && (
                    <span style={{ color: '#38ef7d', fontSize: '0.8rem', fontWeight: 600 }}>
                      ✓ Avatar Uploaded
                    </span>
                  )}
                </label>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{
                    border: '1px dashed var(--accent-cyan)',
                    borderRadius: '12px',
                    padding: '16px',
                    textAlign: 'center',
                    background: 'rgba(0, 242, 254, 0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    position: 'relative',
                    minHeight: '85px'
                  }}>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleAvatarFileUpload}
                      disabled={uploadingAvatar}
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                    />
                    {uploadingAvatar ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-cyan)', fontWeight: 600 }}>
                        <Loader2 size={18} className="animate-spin" /> Uploading Avatar...
                      </div>
                    ) : (
                      <>
                        <Upload size={22} style={{ color: 'var(--accent-cyan)', marginBottom: '4px' }} />
                        <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#fff' }}>Upload Avatar Image</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>Choose PNG, JPG or WEBP</span>
                      </>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>OR Paste Image URL:</span>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <input type="text" className="form-input" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." />
                      {avatarUrl && (
                        <img src={avatarUrl} alt="Preview" style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent-cyan)' }} onError={(e) => e.target.style.display='none'} />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Profile Cover Banner Image Field */}
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 600 }}>Profile Cover / Header Banner (Upload from Computer or Enter Link)</span>
                  {coverUrl && <span style={{ color: '#38ef7d', fontSize: '0.8rem', fontWeight: 600 }}>✓ Cover Uploaded</span>}
                </label>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{
                    border: '1px dashed var(--accent-cyan)',
                    borderRadius: '12px',
                    padding: '16px',
                    textAlign: 'center',
                    background: 'rgba(0, 242, 254, 0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    position: 'relative',
                    minHeight: '85px'
                  }}>
                    <input type="file" accept="image/*" onChange={handleCoverFileUpload} disabled={uploadingCover} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
                    {uploadingCover ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-cyan)', fontWeight: 600 }}>
                        <Loader2 size={18} className="animate-spin" /> Uploading Cover...
                      </div>
                    ) : (
                      <>
                        <Upload size={22} style={{ color: 'var(--accent-cyan)', marginBottom: '4px' }} />
                        <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#fff' }}>Upload Cover Banner Image</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>Choose wide image from system</span>
                      </>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>OR Paste Banner Link:</span>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <input type="text" className="form-input" value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="https://..." />
                      {coverUrl && (
                        <img src={coverUrl} alt="Preview" style={{ width: '64px', height: '38px', borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--accent-cyan)' }} onError={(e) => e.target.style.display='none'} />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Legal Verification Documents */}
          <div className="glass-panel" style={{ padding: '30px' }}>
            <h4 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Shield size={20} style={{ color: 'var(--accent-gold)' }} /> 2. Govt ID Verification Document (Mandatory for Admin Check)
            </h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
              To ensure a high-class, trusted community, ITV admins manually verify legal identification against official records. This data is strictly private.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div className="form-group">
                <label>Document Type *</label>
                <select className="form-select" value={docType} onChange={(e) => setDocType(e.target.value)}>
                  <option value="Aadhaar Card">Aadhaar Card</option>
                  <option value="PAN Card">PAN Card</option>
                  <option value="Passport">Passport</option>
                  <option value="Driving License">Driving License</option>
                  <option value="National ID Card / Govt ID">National ID Card / Govt ID</option>
                  <option value="Government Employee ID">Government Employee ID</option>
                </select>
              </div>

              <div className="form-group">
                <label>Legal Full Name (Matching Document) *</label>
                <input type="text" className="form-input" value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="Full name as printed on ID card" />
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Address *</label>
                <input type="text" className="form-input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Full physical residential / office address" />
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Govt ID Document (Upload File or Enter URL) *</span>
                  {idDocumentUrl && <span style={{ color: '#38ef7d', fontSize: '0.8rem', fontWeight: 600 }}>✓ Document Attached</span>}
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '8px' }}>
                  <div style={{ border: '1px dashed var(--accent-cyan)', borderRadius: '12px', padding: '16px', textAlign: 'center', background: 'rgba(0, 242, 254, 0.05)', position: 'relative', cursor: 'pointer' }}>
                    <input type="file" accept="image/*,.pdf" onChange={handleIdFileUpload} disabled={uploadingDoc} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
                    {uploadingDoc ? (
                      <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}><Loader2 size={18} className="animate-spin" /> Uploading...</span>
                    ) : (
                      <>
                        <Upload size={22} style={{ color: 'var(--accent-cyan)', marginBottom: '4px' }} />
                        <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#fff' }}>Upload from System</span>
                      </>
                    )}
                  </div>
                  <input type="text" className="form-input" value={idDocumentUrl} onChange={(e) => setIdDocumentUrl(e.target.value)} placeholder="OR Direct URL..." />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: LinkedIn & Career Links */}
          <div className="glass-panel" style={{ padding: '30px' }}>
            <h4 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <LinkIcon size={20} style={{ color: 'var(--accent-cyan)' }} /> 3. LinkedIn & Online Profiles
            </h4>
            <div className="form-group">
              <label>LinkedIn Profile URL *</label>
              <input type="url" className="form-input" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/yourname" />
            </div>
          </div>

          {/* Section 4: Work Experience & Education */}
          <div className="glass-panel" style={{ padding: '30px' }}>
            <h4 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Briefcase size={20} style={{ color: 'var(--accent-cyan)' }} /> 4. Work Experience & Education
            </h4>
            {/* Experience List */}
            <div style={{ marginBottom: '24px' }}>
              <h5 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px', color: '#e2e8f0' }}>Work Experience</h5>
              {workExperience.map((exp, idx) => (
                <div key={idx} style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-glass)', padding: '16px', borderRadius: '12px', marginBottom: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <input type="text" className="form-input" placeholder="Company Name" value={exp.company} onChange={(e) => { const u = [...workExperience]; u[idx].company = e.target.value; setWorkExperience(u); }} />
                    <input type="text" className="form-input" placeholder="Role / Title" value={exp.role} onChange={(e) => { const u = [...workExperience]; u[idx].role = e.target.value; setWorkExperience(u); }} />
                  </div>
                  <button className="btn-secondary" style={{ marginTop: '10px', fontSize: '0.8rem' }} onClick={() => setWorkExperience(workExperience.filter((_, i) => i !== idx))}>
                    <Trash2 size={14} /> Remove
                  </button>
                </div>
              ))}
              <button className="btn-secondary" onClick={handleAddExp}><Plus size={16} /> Add Experience</button>
            </div>
          </div>

          {/* Action Controls */}
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button className="btn-secondary" onClick={() => setIsEditing(false)}>
              Cancel
            </button>
            <button className="btn-secondary" onClick={() => handleSubmit(false)} disabled={saving}>
              Save Draft
            </button>
            <button className="btn-primary" onClick={() => handleSubmit(true)} disabled={saving}>
              <Shield size={18} /> {saving ? 'Submitting...' : 'Submit Profile for Admin Verification'}
            </button>
          </div>

        </div>
      )}

    </div>
  );
}
