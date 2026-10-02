import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Shield, Briefcase, GraduationCap, Award, FileText, CheckCircle2, Clock, AlertTriangle, Plus, Trash2, Link as LinkIcon, Building, Upload, Loader2 } from 'lucide-react';

export default function ProfileBuilder() {
  const { currentUser, communityProfile, verificationStatus, verificationBadge, refreshProfile, API_URL } = useAuth();
  
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
  const [docType, setDocType] = useState('Aadhaar / Passport / Govt ID');
  const [legalName, setLegalName] = useState('');
  const [address, setAddress] = useState('');

  const [saving, setSaving] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadedDocName, setUploadedDocName] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleIdFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingDoc(true);
    setErrorMsg('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        headers: {
          'x-auth-token': token
        },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'File upload failed');

      const fileUrl = data.url || `${API_URL}${data.relativeUrl}`;
      setIdDocumentUrl(fileUrl);
      setUploadedDocName(file.name);
    } catch (err) {
      setErrorMsg('File upload error: ' + err.message);
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleAvatarFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append('image', file);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        headers: { 'x-auth-token': token },
        body: formData
      });
      const data = await res.json();
      if (res.ok && data.url) {
        setAvatarUrl(data.url);
      }
    } catch (err) {
      console.error(err);
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

  const handleRemoveSkill = (skillToRemove) => {
    setSkills(skills.filter(s => s !== skillToRemove));
  };

  const handleSubmit = async (submitForVerification = false) => {
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

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
    } catch (err) {
      setErrorMsg(err.message || 'Error updating profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: '960px', margin: '40px auto', padding: '0 20px' }}>
      
      {/* Verification Status Banner */}
      <div className="glass-panel" style={{ padding: '24px', borderRadius: '20px', marginBottom: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)' }}>Verification Status</span>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              {verificationStatus === 'verified' && (
                <>
                  <CheckCircle2 size={24} style={{ color: '#38ef7d' }} />
                  <span>Verified {verificationBadge.toUpperCase()} Member</span>
                </>
              )}
              {verificationStatus === 'pending' && (
                <>
                  <Clock size={24} style={{ color: '#ffaa00' }} />
                  <span>Under Verification Review by ITV Team</span>
                </>
              )}
              {verificationStatus === 'unsubmitted' && (
                <>
                  <AlertTriangle size={24} style={{ color: '#ff007f' }} />
                  <span>Profile Incomplete / Unsubmitted</span>
                </>
              )}
              {verificationStatus === 'rejected' && (
                <>
                  <AlertTriangle size={24} style={{ color: '#ff4d4d' }} />
                  <span>Verification Rejected - Please Update Details</span>
                </>
              )}
            </h3>
          </div>

          <div>
            {verificationStatus === 'verified' ? (
              <span className={`badge-category badge-${verificationBadge}`}>
                🚀 {verificationBadge.toUpperCase()}
              </span>
            ) : (
              <button 
                className="btn-primary" 
                onClick={() => handleSubmit(true)}
                disabled={saving}
              >
                <Shield size={16} /> Submit for Manual Verification
              </button>
            )}
          </div>
        </div>

        <p style={{ marginTop: '14px', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
          🔒 <strong>Privacy Rule:</strong> Until your profile is manually verified by ITV Admin, you cannot view full profiles of other members or send messages/calls. Only photo, name, and category will be visible.
        </p>
      </div>

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

      {/* Main Profile Form */}
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
              <label>Bio / Headline</label>
              <textarea className="form-textarea" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Brief introduction about your passion, research, or business in the space sector..." />
            </div>

            <div className="form-group">
              <label>Location / City, Country</label>
              <input type="text" className="form-input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Bengaluru, India / Houston, USA" />
            </div>

            <div className="form-group">
              <label>Profile Avatar Image URL</label>
              <input type="text" className="form-input" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." />
            </div>
          </div>
        </div>

        {/* Section 2: Legal Verification Documents */}
        <div className="glass-panel" style={{ padding: '30px' }}>
          <h4 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Shield size={20} style={{ color: 'var(--accent-gold)' }} /> 2. Govt ID Verification Document (Mandatory for Admin Check)
          </h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
            To ensure a high-class, trusted community, ITV admins manually verify legal identification against official records. This data is strictly private and hidden from public view.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div className="form-group">
              <label>Document Type *</label>
              <select className="form-select" value={docType} onChange={(e) => setDocType(e.target.value)}>
                <option value="Aadhaar Card">Aadhaar Card</option>
                <option value="Passport">Passport</option>
                <option value="Driving License">Driving License</option>
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
                {idDocumentUrl && (
                  <span style={{ color: '#38ef7d', fontSize: '0.8rem', fontWeight: 600 }}>
                    ✓ Document Attached
                  </span>
                )}
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '8px' }}>
                {/* Option 1: File Upload from System */}
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
                    accept="image/*,.pdf" 
                    onChange={handleIdFileUpload}
                    disabled={uploadingDoc}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      opacity: 0,
                      cursor: 'pointer'
                    }}
                  />
                  {uploadingDoc ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-cyan)', fontWeight: 600 }}>
                      <Loader2 size={18} className="animate-spin" /> Uploading Document...
                    </div>
                  ) : (
                    <>
                      <Upload size={22} style={{ color: 'var(--accent-cyan)', marginBottom: '4px' }} />
                      <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#fff' }}>
                        Upload from System (Image / PDF)
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {uploadedDocName ? `Selected: ${uploadedDocName}` : 'Click to browse Aadhaar, Passport, DL, etc.'}
                      </span>
                    </>
                  )}
                </div>

                {/* Option 2: Direct URL Input */}
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>OR Paste Direct File / Drive URL:</span>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={idDocumentUrl} 
                    onChange={(e) => setIdDocumentUrl(e.target.value)} 
                    placeholder="https://... (Direct URL to uploaded ID doc)" 
                  />
                </div>
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

          <div style={{ marginTop: '16px' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: 600, color: '#cbd5e0' }}>Additional Portfolio / Research Links</label>
            {additionalLinks.map((link, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <input type="text" className="form-input" placeholder="Title (e.g. ResearchGate / Twitter)" value={link.label} onChange={(e) => {
                  const updated = [...additionalLinks];
                  updated[idx].label = e.target.value;
                  setAdditionalLinks(updated);
                }} />
                <input type="url" className="form-input" placeholder="URL" value={link.url} onChange={(e) => {
                  const updated = [...additionalLinks];
                  updated[idx].url = e.target.value;
                  setAdditionalLinks(updated);
                }} />
                <button className="btn-secondary" onClick={() => setAdditionalLinks(additionalLinks.filter((_, i) => i !== idx))}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button className="btn-secondary" style={{ marginTop: '12px' }} onClick={handleAddLink}>
              <Plus size={16} /> Add Link
            </button>
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
                  <input type="text" className="form-input" placeholder="Company / Organization Name" value={exp.company} onChange={(e) => {
                    const u = [...workExperience]; u[idx].company = e.target.value; setWorkExperience(u);
                  }} />
                  <input type="text" className="form-input" placeholder="Role / Title (e.g. Propulsion Scientist)" value={exp.role} onChange={(e) => {
                    const u = [...workExperience]; u[idx].role = e.target.value; setWorkExperience(u);
                  }} />
                  <input type="text" className="form-input" placeholder="Start Date (e.g. 2021)" value={exp.startDate} onChange={(e) => {
                    const u = [...workExperience]; u[idx].startDate = e.target.value; setWorkExperience(u);
                  }} />
                  <input type="text" className="form-input" placeholder="End Date (or Present)" value={exp.endDate} onChange={(e) => {
                    const u = [...workExperience]; u[idx].endDate = e.target.value; setWorkExperience(u);
                  }} />
                </div>
                <button className="btn-secondary" style={{ marginTop: '10px', fontSize: '0.8rem' }} onClick={() => setWorkExperience(workExperience.filter((_, i) => i !== idx))}>
                  <Trash2 size={14} /> Remove Experience
                </button>
              </div>
            ))}
            <button className="btn-secondary" onClick={handleAddExp}><Plus size={16} /> Add Work Experience</button>
          </div>

          {/* Education List */}
          <div>
            <h5 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px', color: '#e2e8f0' }}>Education & Degrees</h5>
            {education.map((edu, idx) => (
              <div key={idx} style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-glass)', padding: '16px', borderRadius: '12px', marginBottom: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <input type="text" className="form-input" placeholder="University / Institution" value={edu.institution} onChange={(e) => {
                    const u = [...education]; u[idx].institution = e.target.value; setEducation(u);
                  }} />
                  <input type="text" className="form-input" placeholder="Degree (e.g. M.Tech Aerospace)" value={edu.degree} onChange={(e) => {
                    const u = [...education]; u[idx].degree = e.target.value; setEducation(u);
                  }} />
                </div>
                <button className="btn-secondary" style={{ marginTop: '10px', fontSize: '0.8rem' }} onClick={() => setEducation(education.filter((_, i) => i !== idx))}>
                  <Trash2 size={14} /> Remove Education
                </button>
              </div>
            ))}
            <button className="btn-secondary" onClick={handleAddEdu}><Plus size={16} /> Add Education</button>
          </div>
        </div>

        {/* Section 5: Skills & Business Details */}
        <div className="glass-panel" style={{ padding: '30px' }}>
          <h4 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Award size={20} style={{ color: 'var(--accent-cyan)' }} /> 5. Skills, Certificates & Business Info
          </h4>

          {/* Skills */}
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label>Skills & Expertise Tags</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input type="text" className="form-input" placeholder="Add skill (e.g. Astrophysics, Satellite Systems, VC)" value={skillInput} onChange={(e) => setSkillInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSkill())} />
              <button className="btn-secondary" onClick={handleAddSkill}><Plus size={16} /> Add</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
              {skills.map((skill, i) => (
                <span key={i} style={{ background: 'rgba(0, 242, 254, 0.12)', border: '1px solid rgba(0, 242, 254, 0.3)', color: '#00f2fe', padding: '4px 12px', borderRadius: '16px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  {skill}
                  <button style={{ background: 'none', border: 'none', color: '#00f2fe', cursor: 'pointer' }} onClick={() => handleRemoveSkill(skill)}>×</button>
                </span>
              ))}
            </div>
          </div>

          {/* Business Details */}
          <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '20px', marginTop: '20px' }}>
            <h5 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building size={16} /> Business & Startup Info (Optional for Entrepreneurs)
            </h5>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <input type="text" className="form-input" placeholder="Company Name" value={businessDetails.companyName} onChange={(e) => setBusinessDetails({ ...businessDetails, companyName: e.target.value })} />
              <input type="text" className="form-input" placeholder="Designation / Founder Title" value={businessDetails.designation} onChange={(e) => setBusinessDetails({ ...businessDetails, designation: e.target.value })} />
              <input type="text" className="form-input" placeholder="Website" value={businessDetails.website} onChange={(e) => setBusinessDetails({ ...businessDetails, website: e.target.value })} />
              <input type="text" className="form-input" placeholder="Industry" value={businessDetails.industry} onChange={(e) => setBusinessDetails({ ...businessDetails, industry: e.target.value })} />
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end', marginTop: '10px' }}>
          <button className="btn-secondary" onClick={() => handleSubmit(false)} disabled={saving}>
            Save Draft
          </button>
          <button className="btn-primary" onClick={() => handleSubmit(true)} disabled={saving}>
            <Shield size={18} /> {saving ? 'Submitting...' : 'Submit Profile for Admin Verification'}
          </button>
        </div>

      </div>
    </div>
  );
}
