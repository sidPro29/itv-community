import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { io } from 'socket.io-client';
import Hls from 'hls.js';
import { 
  Send, PhoneCall, Video, Mic, MicOff, VideoOff, PhoneOff, ShieldAlert, 
  Sparkles, MessageSquare, User, Shield, Briefcase, GraduationCap, Award, 
  FileText, CheckCircle2, Clock, AlertTriangle, Plus, Trash2, Link as LinkIcon, 
  Building, Upload, Loader2, MapPin, ExternalLink, Globe, X, Edit3, Eye, PhoneIncoming 
} from 'lucide-react';

const HARDCODED_VIDEO_URL = 'https://service.webvideocore.net/CL1olYogIrDWvwqiIKK7eHbBxDyYany25g-L4QOVH5_l5daXY9tfEZPDJS0YHgpW/a_td54sa9zvwgw.m3u8';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

// 16:9 HLS Video Player Component (Increased by 20% width to 380px)
function HlsVideoPlayer({ src }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (Hls.isSupported()) {
      const hls = new Hls({
        autoStartLoad: true,
        debug: false
      });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(e => console.log('Autoplay blocked', e));
      });
      return () => hls.destroy();
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(e => console.log('Autoplay blocked', e));
      });
    }
  }, [src]);

  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.6)', border: '1px solid var(--border-glass)', background: '#000' }}>
      <video
        ref={videoRef}
        controls
        muted
        playsInline
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </div>
  );
}

export default function Home() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser, communityProfile, verificationStatus, verificationBadge, refreshProfile, API_URL } = useAuth();

  const recipientIdFromQuery = searchParams.get('recipient');
  const initialAction = searchParams.get('action');

  // --- Profile States ---
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

  // Verification Docs
  const [idDocumentUrl, setIdDocumentUrl] = useState('');
  const [docType, setDocType] = useState('Aadhaar Card');
  const [legalName, setLegalName] = useState('');
  const [address, setAddress] = useState('');

  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingCertIndex, setUploadingCertIndex] = useState(null);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState('');
  const [profileErrorMsg, setProfileErrorMsg] = useState('');

  // --- Messaging & Calling States ---
  const [conversations, setConversations] = useState([]);
  const [activeRecipient, setActiveRecipient] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [chatErrorMsg, setChatErrorMsg] = useState('');

  // WebRTC Call States
  const [activeCall, setActiveCall] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [micMuted, setMicMuted] = useState(false);
  const [videoMuted, setVideoMuted] = useState(false);

  // WebRTC & Socket Refs
  const socketRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const chatContainerRef = useRef(null);

  // Load Profile State
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
        setDocType(currentUser.verificationDocs.docType || 'Aadhaar Card');
        setLegalName(currentUser.verificationDocs.legalName || '');
        setAddress(currentUser.verificationDocs.address || '');
      }
    }
  }, [currentUser, communityProfile]);

  // Socket Connection Setup
  useEffect(() => {
    if (!currentUser) return;

    const socketUrl = API_URL.replace(/\/api$/, '');
    socketRef.current = io(socketUrl);

    socketRef.current.emit('register_user', currentUser._id);

    socketRef.current.on('receive_message', (data) => {
      setMessages(prev => [...prev, data]);
      fetchConversations();
    });

    socketRef.current.on('incoming_call', (data) => {
      setIncomingCall(data);
    });

    socketRef.current.on('call_accepted', async ({ answer }) => {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        setActiveCall(prev => prev ? { ...prev, status: 'connected' } : null);
      }
    });

    socketRef.current.on('ice_candidate', async ({ candidate }) => {
      if (peerConnectionRef.current && candidate) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('ICE candidate error', e);
        }
      }
    });

    socketRef.current.on('call_rejected', () => {
      setChatErrorMsg('Call was declined by recipient.');
      cleanUpCall();
    });

    socketRef.current.on('call_ended', () => {
      cleanUpCall();
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      cleanUpCall();
    };
  }, [currentUser, API_URL]);

  // Fetch Conversations List
  useEffect(() => {
    if (currentUser) {
      fetchConversations();
    }
  }, [currentUser]);

  const fetchConversations = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/community/conversations`, {
        headers: { 'x-auth-token': token }
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(Array.isArray(data) ? data : []);
        if (!recipientIdFromQuery && Array.isArray(data) && data.length > 0 && !activeRecipient) {
          fetchRecipient(data[0]._id);
        }
      }
    } catch (err) {
      console.error('Error fetching conversations', err);
    }
  };

  // Fetch recipient member info if query or click exists
  useEffect(() => {
    if (recipientIdFromQuery) {
      fetchRecipient(recipientIdFromQuery);
    }
  }, [recipientIdFromQuery]);

  const fetchRecipient = async (rId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/community/members/${rId}`, {
        headers: { 'x-auth-token': token }
      });
      if (res.ok) {
        const data = await res.json();
        setActiveRecipient(data);
        fetchMessages(rId);

        if (initialAction === 'audio' || initialAction === 'video') {
          startCall(initialAction, data);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMessages = async (rId) => {
    setLoadingMsgs(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/community/messages/${rId}`, {
        headers: { 'x-auth-token': token }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMsgs(false);
    }
  };

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !activeRecipient) return;

    setChatErrorMsg('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/community/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        },
        body: JSON.stringify({
          recipientId: activeRecipient._id,
          content: inputText,
          type: 'text'
        })
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.requiresPlanUpgrade) {
          navigate('/upgrade');
          return;
        }
        throw new Error(data.msg || 'Failed to send message');
      }

      setMessages(prev => [...prev, data]);

      if (socketRef.current) {
        socketRef.current.emit('send_message', {
          recipientId: activeRecipient._id,
          sender: currentUser._id,
          content: inputText,
          type: 'text',
          createdAt: new Date()
        });
      }

      setInputText('');
      fetchConversations();
    } catch (err) {
      setChatErrorMsg(err.message);
    }
  };

  // WebRTC Handlers
  const createPeerConnection = (targetUserId) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('ice_candidate', {
          targetId: targetUserId,
          candidate: event.candidate
        });
      }
    };

    pc.ontrack = (event) => {
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  };

  const startCall = async (type, recipient = activeRecipient) => {
    if (!recipient) return;
    setChatErrorMsg('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === 'video'
      });
      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const pc = createPeerConnection(recipient._id);

      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      setActiveCall({
        type,
        status: 'ringing',
        duration: 0,
        recipient
      });

      socketRef.current?.emit('call_user', {
        recipientId: recipient._id,
        offer,
        callType: type,
        callerInfo: {
          userId: currentUser._id,
          fullName: currentUser.communityProfile?.fullName || currentUser.username,
          avatarUrl: currentUser.communityProfile?.avatarUrl
        }
      });
    } catch (err) {
      console.error(err);
      setChatErrorMsg('Microphone or Camera access denied: ' + err.message);
    }
  };

  const acceptIncomingCall = async () => {
    if (!incomingCall) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: incomingCall.callType === 'video'
      });
      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const pc = createPeerConnection(incomingCall.callerId);

      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socketRef.current?.emit('answer_call', {
        callerId: incomingCall.callerId,
        answer
      });

      setActiveCall({
        type: incomingCall.callType,
        status: 'connected',
        duration: 0,
        recipient: {
          _id: incomingCall.callerId,
          fullName: incomingCall.callerName,
          avatarUrl: incomingCall.callerAvatar
        }
      });

      setIncomingCall(null);
    } catch (err) {
      console.error(err);
      setChatErrorMsg('Media error: ' + err.message);
      rejectIncomingCall();
    }
  };

  const rejectIncomingCall = () => {
    if (incomingCall && socketRef.current) {
      socketRef.current.emit('reject_call', { targetId: incomingCall.callerId });
    }
    setIncomingCall(null);
  };

  const cleanUpCall = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    setActiveCall(null);
    setMicMuted(false);
    setVideoMuted(false);
  };

  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoMuted(!videoTrack.enabled);
      }
    }
  };

  const endCall = async () => {
    const targetId = activeCall?.recipient?._id;
    if (targetId && socketRef.current) {
      socketRef.current.emit('end_call', { targetId });
    }

    if (activeCall && activeCall.recipient) {
      try {
        const token = localStorage.getItem('token');
        await fetch(`${API_URL}/community/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-auth-token': token
          },
          body: JSON.stringify({
            recipientId: activeCall.recipient._id,
            content: `${activeCall.type === 'audio' ? 'Audio Call' : 'Video Call'} (${activeCall.duration}s)`,
            type: activeCall.type === 'audio' ? 'audio_call' : 'video_call',
            callDurationSeconds: activeCall.duration
          })
        });
        if (activeRecipient) fetchMessages(activeRecipient._id);
      } catch (err) {
        console.error(err);
      }
    }

    cleanUpCall();
  };

  // Upload Handlers for Profile
  const uploadFileToServer = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/upload`, {
      method: 'POST',
      headers: {
        'x-auth-token': token,
        'x-upload-source': 'community'
      },
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
    setProfileErrorMsg('');
    try {
      const fileUrl = await uploadFileToServer(file);
      setIdDocumentUrl(fileUrl);
    } catch (err) {
      setProfileErrorMsg('Govt ID upload error: ' + err.message);
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleAvatarFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingAvatar(true);
    setProfileErrorMsg('');
    try {
      const fileUrl = await uploadFileToServer(file);
      setAvatarUrl(fileUrl);
    } catch (err) {
      setProfileErrorMsg('Avatar upload error: ' + err.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleCoverFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingCover(true);
    setProfileErrorMsg('');
    try {
      const fileUrl = await uploadFileToServer(file);
      setCoverUrl(fileUrl);
    } catch (err) {
      setProfileErrorMsg('Cover banner upload error: ' + err.message);
    } finally {
      setUploadingCover(false);
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
      setBio(words.slice(0, 250).join(' '));
    }
  };

  // Helper Array Modifiers for Edit Mode
  const addWorkExp = () => setWorkExperience([...workExperience, { company: '', role: '', startDate: '', endDate: '', description: '' }]);
  const removeWorkExp = (idx) => setWorkExperience(workExperience.filter((_, i) => i !== idx));

  const addEdu = () => setEducation([...education, { institution: '', degree: '', fieldOfStudy: '', startYear: '', endYear: '' }]);
  const removeEdu = (idx) => setEducation(education.filter((_, i) => i !== idx));

  const addSkill = () => {
    if (skillInput.trim() && !skills.includes(skillInput.trim())) {
      setSkills([...skills, skillInput.trim()]);
      setSkillInput('');
    }
  };
  const removeSkill = (s) => setSkills(skills.filter(sk => sk !== s));

  const addCert = () => setCertificates([...certificates, { title: '', issuer: '', issueDate: '', credentialUrl: '' }]);
  const removeCert = (idx) => setCertificates(certificates.filter((_, i) => i !== idx));

  const addLink = () => setAdditionalLinks([...additionalLinks, { label: '', url: '' }]);
  const removeLink = (idx) => setAdditionalLinks(additionalLinks.filter((_, i) => i !== idx));

  const handleSaveProfile = async (submitForVerification = false) => {
    setSavingProfile(true);
    setProfileSuccessMsg('');
    setProfileErrorMsg('');

    if (getBioWordCount(bio) > 250) {
      setProfileErrorMsg('Bio cannot exceed 250 words.');
      setSavingProfile(false);
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

      setProfileSuccessMsg(submitForVerification ? 'Profile & Verification documents submitted! Pending review by ITV Admin.' : 'Profile draft saved successfully!');
      await refreshProfile();
      setIsEditing(false);
    } catch (err) {
      setProfileErrorMsg(err.message || 'Error updating profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const getStatusBadge = () => {
    if (verificationStatus === 'verified') {
      return (
        <span className={`status-pill pill-verified pill-${verificationBadge}`}>
          <Shield size={12} /> VERIFIED {(verificationBadge !== 'none' ? verificationBadge : category).toUpperCase()}
        </span>
      );
    }
    if (verificationStatus === 'pending') {
      return <span className="status-pill pill-pending"><Clock size={12} /> PENDING VERIFICATION</span>;
    }
    return <span className="status-pill pill-incomplete"><AlertTriangle size={12} /> UNVERIFIED / INCOMPLETE</span>;
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '30px auto', padding: '0 20px' }}>
      
      {/* 1. TOP HERO BLOCK (Full Width, Compact Height, Cover upper half, Info lower half, 16:9 HLS Video Player top right) */}
      <div className="glass-panel" style={{ borderRadius: '24px', overflow: 'hidden', marginBottom: '30px', position: 'relative' }}>
        
        {/* Upper Half Height: Cover Banner Graphic */}
        <div style={{
          height: '160px',
          background: coverUrl ? `url(${coverUrl}) center/cover` : 'linear-gradient(135deg, rgba(0, 242, 254, 0.25) 0%, rgba(121, 40, 202, 0.35) 100%)',
          position: 'relative'
        }}>
          {/* Top Right: 16:9 HLS Video Player (20% Larger width: 380px) */}
          <div style={{ position: 'absolute', top: '16px', right: '16px', width: '380px', zIndex: 10 }}>
            <HlsVideoPlayer src={HARDCODED_VIDEO_URL} />
          </div>
        </div>

        {/* Lower Half Height: Avatar, Name, Single Badge, Location, Full-width Bio */}
        <div style={{ padding: '0 28px 20px 28px', position: 'relative', marginTop: '-50px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
            
            {/* Avatar & Name */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '18px' }}>
              <div style={{
                width: '105px',
                height: '105px',
                borderRadius: '50%',
                background: avatarUrl ? `url(${avatarUrl}) center/cover` : 'linear-gradient(135deg, #00f2fe, #7928ca)',
                border: '4px solid var(--bg-dark)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2.5rem',
                fontWeight: 800,
                color: '#fff',
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                flexShrink: 0
              }}>
                {!avatarUrl && (fullName ? fullName.charAt(0).toUpperCase() : 'U')}
              </div>

              <div style={{ marginBottom: '6px' }}>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.8rem', fontWeight: 800, color: '#fff' }}>
                  {fullName || currentUser?.username || 'Space Member'}
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px', flexWrap: 'wrap' }}>
                  {/* Just ONE badge: If verified show ONLY SINGLE VERIFIED BADGE, else show category + status */}
                  {verificationStatus === 'verified' ? (
                    <span className={`status-pill pill-verified pill-${verificationBadge}`}>
                      <Shield size={12} /> VERIFIED {(verificationBadge !== 'none' ? verificationBadge : category).toUpperCase()}
                    </span>
                  ) : (
                    <>
                      <span className={`badge-category badge-${category}`}>
                        🚀 {category.toUpperCase()}
                      </span>
                      {getStatusBadge()}
                    </>
                  )}
                  {location && (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <MapPin size={14} /> {location}
                    </span>
                  )}
                </div>
              </div>
            </div>

          </div>

          {/* Full-width Bio Headline (Spans till the end of the hero card so height remains compact) */}
          <p style={{ marginTop: '16px', color: '#e2e8f0', fontSize: '0.98rem', lineHeight: 1.6, width: '100%', maxWidth: 'none' }}>
            {bio || 'Space enthusiast & member of the Interplanetary Community.'}
          </p>
        </div>
      </div>

      {/* 2. TWO COLUMNS LAYOUT: LEFT COLUMN (PROFILE DETAILS) | RIGHT COLUMN (CONTACTS + CHAT) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: '24px', alignItems: 'start' }}>
        
        {/* --- LEFT COLUMN: PROFILE DETAILS BLOCK --- */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Section Header with View/Edit Mode Toggle */}
          <div className="glass-panel" style={{ padding: '18px 24px', borderRadius: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <User size={22} style={{ color: 'var(--accent-cyan)' }} /> Member Profile & Verification Details
            </h3>
            <button 
              onClick={() => setIsEditing(!isEditing)} 
              className={isEditing ? "btn-secondary" : "btn-primary"}
              style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem' }}
            >
              {isEditing ? <><Eye size={16} /> View Profile Mode</> : <><Edit3 size={16} /> Edit Profile</>}
            </button>
          </div>

          {profileSuccessMsg && (
            <div style={{ background: 'rgba(56, 239, 125, 0.15)', border: '1px solid rgba(56, 239, 125, 0.3)', color: '#38ef7d', padding: '14px 20px', borderRadius: '14px' }}>
              {profileSuccessMsg}
            </div>
          )}

          {profileErrorMsg && (
            <div style={{ background: 'rgba(255, 77, 77, 0.15)', border: '1px solid rgba(255, 77, 77, 0.3)', color: '#ff4d4d', padding: '14px 20px', borderRadius: '14px' }}>
              {profileErrorMsg}
            </div>
          )}

          {!isEditing ? (
            /* --- PROFILE VIEW MODE CARDS (ALL SECTIONS COVERED) --- */
            <>
              {/* Section 1: Verification Status Card */}
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

              {/* Section 2: Online Profiles & Links */}
              <div className="glass-panel" style={{ padding: '24px', borderRadius: '20px' }}>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <LinkIcon size={20} style={{ color: 'var(--accent-cyan)' }} /> Online Profiles & Links
                </h4>
                {linkedinUrl || additionalLinks.some(l => l.url) ? (
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
                ) : (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No external links added yet. Click 'Edit Profile' to add LinkedIn or Portfolio links.</p>
                )}
              </div>

              {/* Section 3: Work Experience */}
              <div className="glass-panel" style={{ padding: '24px', borderRadius: '20px' }}>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Briefcase size={20} style={{ color: 'var(--accent-cyan)' }} /> Work Experience
                </h4>
                {workExperience.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {workExperience.map((w, i) => (
                      <div key={i} style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
                        <h5 style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff' }}>{w.role || 'Position'}</h5>
                        <p style={{ color: 'var(--accent-cyan)', fontSize: '0.85rem' }}>{w.company} • {w.startDate} - {w.endDate || 'Present'}</p>
                        {w.description && <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>{w.description}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No work experience added yet.</p>
                )}
              </div>

              {/* Section 4: Education & Degrees */}
              <div className="glass-panel" style={{ padding: '24px', borderRadius: '20px' }}>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <GraduationCap size={20} style={{ color: 'var(--accent-cyan)' }} /> Education & Degrees
                </h4>
                {education.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {education.map((e, i) => (
                      <div key={i} style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
                        <h5 style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff' }}>{e.degree}</h5>
                        <p style={{ color: 'var(--accent-cyan)', fontSize: '0.85rem' }}>{e.institution}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No education history added yet.</p>
                )}
              </div>

              {/* Section 5: Skills & Tech Stack */}
              <div className="glass-panel" style={{ padding: '24px', borderRadius: '20px' }}>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Award size={20} style={{ color: 'var(--accent-cyan)' }} /> Skills & Expertise
                </h4>
                {skills.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {skills.map((s, i) => (
                      <span key={i} style={{ background: 'rgba(0, 242, 254, 0.12)', border: '1px solid rgba(0, 242, 254, 0.3)', color: '#00f2fe', padding: '6px 14px', borderRadius: '16px', fontSize: '0.85rem', fontWeight: 600 }}>
                        {s}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No skills listed yet.</p>
                )}
              </div>

              {/* Section 6: Certificates & Credentials */}
              <div className="glass-panel" style={{ padding: '24px', borderRadius: '20px' }}>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Award size={20} style={{ color: 'var(--accent-cyan)' }} /> Certificates & Credentials
                </h4>
                {certificates.length > 0 ? (
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
                ) : (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No certificates uploaded yet.</p>
                )}
              </div>

              {/* Section 7: Business Details */}
              <div className="glass-panel" style={{ padding: '24px', borderRadius: '20px' }}>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Building size={20} style={{ color: 'var(--accent-cyan)' }} /> Business & Startup Details
                </h4>
                {businessDetails.companyName ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Company / Startup</span>
                      <p style={{ fontWeight: 700, color: '#fff' }}>{businessDetails.companyName}</p>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Designation / Title</span>
                      <p style={{ fontWeight: 700, color: '#fff' }}>{businessDetails.designation || 'Founder'}</p>
                    </div>
                    {businessDetails.website && (
                      <div style={{ gridColumn: 'span 2' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Website</span>
                        <p><a href={businessDetails.website} target="_blank" rel="noopener noreferrer" style={{ color: '#00f2fe' }}>{businessDetails.website}</a></p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No business details specified.</p>
                )}
              </div>
            </>
          ) : (
            /* --- PROFILE EDIT MODE FORM (FULL SECTIONS COMPREHENSIVE FORM) --- */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Section 1: Basic Info */}
              <div className="glass-panel" style={{ padding: '24px', borderRadius: '20px' }}>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>1. Basic Info & Category</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label>Full Name *</label>
                    <input type="text" className="form-input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Category Badge *</label>
                    <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                      <option value="enthusiast">Space Enthusiast 🚀</option>
                      <option value="professional">Space Professional 🧑‍🚀</option>
                      <option value="entrepreneur">Space Entrepreneur 💼</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <label>Bio (Max 250 words)</label>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{getBioWordCount(bio)}/250</span>
                    </div>
                    <textarea className="form-textarea" rows={3} value={bio} onChange={handleBioChange} />
                  </div>
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label>Location</label>
                    <input type="text" className="form-input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. New Delhi, India" />
                  </div>
                </div>
              </div>

              {/* Section 2: Verification Docs */}
              <div className="glass-panel" style={{ padding: '24px', borderRadius: '20px' }}>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>2. Govt ID Verification Document</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
                    <label>Legal Full Name *</label>
                    <input type="text" className="form-input" value={legalName} onChange={(e) => setLegalName(e.target.value)} />
                  </div>
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label>Address *</label>
                    <input type="text" className="form-input" value={address} onChange={(e) => setAddress(e.target.value)} />
                  </div>
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label>Govt ID Document Upload</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '6px' }}>
                      <div style={{ border: '1px dashed var(--accent-cyan)', padding: '12px', borderRadius: '10px', textAlign: 'center', position: 'relative' }}>
                        <input type="file" accept="image/*,.pdf" onChange={handleIdFileUpload} disabled={uploadingDoc} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
                        {uploadingDoc ? <span><Loader2 size={16} className="animate-spin" /> Uploading...</span> : <span><Upload size={16} /> Upload File</span>}
                      </div>
                      <input type="text" className="form-input" value={idDocumentUrl} onChange={(e) => setIdDocumentUrl(e.target.value)} placeholder="OR URL..." />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: Online Profiles & Links */}
              <div className="glass-panel" style={{ padding: '24px', borderRadius: '20px' }}>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>3. Online Links & Social Profiles</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div className="form-group">
                    <label>LinkedIn Profile URL</label>
                    <input type="text" className="form-input" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/username" />
                  </div>
                  {additionalLinks.map((l, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: '10px', alignItems: 'center' }}>
                      <input type="text" className="form-input" placeholder="Label (e.g. GitHub)" value={l.label} onChange={(e) => {
                        const updated = [...additionalLinks];
                        updated[idx].label = e.target.value;
                        setAdditionalLinks(updated);
                      }} />
                      <input type="text" className="form-input" placeholder="https://..." value={l.url} onChange={(e) => {
                        const updated = [...additionalLinks];
                        updated[idx].url = e.target.value;
                        setAdditionalLinks(updated);
                      }} />
                      <button type="button" className="btn-secondary" style={{ padding: '8px', color: '#ff4d4d' }} onClick={() => removeLink(idx)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  <button type="button" className="btn-secondary" style={{ alignSelf: 'flex-start', fontSize: '0.85rem' }} onClick={addLink}>
                    <Plus size={14} /> Add Another Link
                  </button>
                </div>
              </div>

              {/* Section 4: Work Experience */}
              <div className="glass-panel" style={{ padding: '24px', borderRadius: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 700 }}>4. Work Experience</h4>
                  <button type="button" className="btn-secondary" style={{ fontSize: '0.85rem' }} onClick={addWorkExp}>
                    <Plus size={14} /> Add Experience
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {workExperience.map((w, idx) => (
                    <div key={idx} style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-glass)', position: 'relative' }}>
                      <button type="button" style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', color: '#ff4d4d', cursor: 'pointer' }} onClick={() => removeWorkExp(idx)}>
                        <Trash2 size={16} />
                      </button>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="form-group">
                          <label>Job Role</label>
                          <input type="text" className="form-input" value={w.role} onChange={(e) => {
                            const updated = [...workExperience];
                            updated[idx].role = e.target.value;
                            setWorkExperience(updated);
                          }} placeholder="e.g. Android Engineer" />
                        </div>
                        <div className="form-group">
                          <label>Company</label>
                          <input type="text" className="form-input" value={w.company} onChange={(e) => {
                            const updated = [...workExperience];
                            updated[idx].company = e.target.value;
                            setWorkExperience(updated);
                          }} placeholder="e.g. ISRO / SpaceX" />
                        </div>
                        <div className="form-group">
                          <label>Start Date</label>
                          <input type="text" className="form-input" value={w.startDate} onChange={(e) => {
                            const updated = [...workExperience];
                            updated[idx].startDate = e.target.value;
                            setWorkExperience(updated);
                          }} placeholder="e.g. Jan 2021" />
                        </div>
                        <div className="form-group">
                          <label>End Date</label>
                          <input type="text" className="form-input" value={w.endDate} onChange={(e) => {
                            const updated = [...workExperience];
                            updated[idx].endDate = e.target.value;
                            setWorkExperience(updated);
                          }} placeholder="e.g. Present" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 5: Education & Degrees */}
              <div className="glass-panel" style={{ padding: '24px', borderRadius: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 700 }}>5. Education & Degrees</h4>
                  <button type="button" className="btn-secondary" style={{ fontSize: '0.85rem' }} onClick={addEdu}>
                    <Plus size={14} /> Add Education
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {education.map((e, idx) => (
                    <div key={idx} style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-glass)', position: 'relative' }}>
                      <button type="button" style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', color: '#ff4d4d', cursor: 'pointer' }} onClick={() => removeEdu(idx)}>
                        <Trash2 size={16} />
                      </button>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="form-group">
                          <label>Degree</label>
                          <input type="text" className="form-input" value={e.degree} onChange={(evt) => {
                            const updated = [...education];
                            updated[idx].degree = evt.target.value;
                            setEducation(updated);
                          }} placeholder="e.g. B.Tech Computer Science" />
                        </div>
                        <div className="form-group">
                          <label>Institution</label>
                          <input type="text" className="form-input" value={e.institution} onChange={(evt) => {
                            const updated = [...education];
                            updated[idx].institution = evt.target.value;
                            setEducation(updated);
                          }} placeholder="e.g. IERT Allahabad" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 6: Skills */}
              <div className="glass-panel" style={{ padding: '24px', borderRadius: '20px' }}>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>6. Skills & Tech Stack</h4>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                  <input type="text" className="form-input" placeholder="Type a skill (e.g. Kotlin, React)" value={skillInput} onChange={(e) => setSkillInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }} />
                  <button type="button" className="btn-primary" onClick={addSkill}>Add</button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {skills.map((s, idx) => (
                    <span key={idx} style={{ background: 'rgba(0, 242, 254, 0.12)', border: '1px solid rgba(0, 242, 254, 0.3)', color: '#00f2fe', padding: '6px 12px', borderRadius: '16px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      {s} <X size={14} style={{ cursor: 'pointer' }} onClick={() => removeSkill(s)} />
                    </span>
                  ))}
                </div>
              </div>

              {/* Section 7: Business Details */}
              <div className="glass-panel" style={{ padding: '24px', borderRadius: '20px' }}>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>7. Business & Startup Details</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label>Company / Startup Name</label>
                    <input type="text" className="form-input" value={businessDetails.companyName} onChange={(e) => setBusinessDetails({ ...businessDetails, companyName: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Designation / Title</label>
                    <input type="text" className="form-input" value={businessDetails.designation} onChange={(e) => setBusinessDetails({ ...businessDetails, designation: e.target.value })} />
                  </div>
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label>Website URL</label>
                    <input type="text" className="form-input" value={businessDetails.website} onChange={(e) => setBusinessDetails({ ...businessDetails, website: e.target.value })} placeholder="https://..." />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '14px', justifyContent: 'flex-end' }}>
                <button className="btn-secondary" onClick={() => setIsEditing(false)}>Cancel</button>
                <button className="btn-secondary" onClick={() => handleSaveProfile(false)} disabled={savingProfile}>Save Draft</button>
                <button className="btn-primary" onClick={() => handleSaveProfile(true)} disabled={savingProfile}>
                  <Shield size={16} /> {savingProfile ? 'Submitting...' : 'Submit Profile for Verification'}
                </button>
              </div>

            </div>
          )}

        </div>

        {/* --- RIGHT COLUMN: CONTACTS LIST (TOP) + CHAT & CALLING (BOTTOM) --- */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* 1. TOP RIGHT BLOCK: CONTACTS LIST (Max 4 contacts visible, scrollable overflow) */}
          <div className="glass-panel" style={{ padding: '20px', borderRadius: '20px' }}>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MessageSquare size={18} style={{ color: 'var(--accent-cyan)' }} /> Contacts & Recent Messages
            </h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '260px', overflowY: 'auto', paddingRight: '4px' }}>
              {conversations.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
                  No contacts yet. Find members in the Directory to start messaging!
                </p>
              ) : (
                conversations.map((contact) => {
                  const isSelected = activeRecipient?._id === contact._id;
                  
                  // Extract full name and avatar cleanly from contact object
                  const contactName = contact.fullName || contact.communityProfile?.fullName || contact.username || 'Space Member';
                  const contactAvatar = contact.avatarUrl || contact.communityProfile?.avatarUrl || '';
                  const initialLetter = contactName ? contactName.charAt(0).toUpperCase() : 'U';

                  return (
                    <div
                      key={contact._id}
                      onClick={() => fetchRecipient(contact._id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '10px 14px',
                        borderRadius: '14px',
                        background: isSelected ? 'rgba(0, 242, 254, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                        border: isSelected ? '1px solid var(--accent-cyan)' : '1px solid var(--border-glass)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '50%',
                        background: contactAvatar ? `url(${contactAvatar}) center/cover` : 'linear-gradient(135deg, #00f2fe, #7928ca)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '1.1rem',
                        color: '#fff',
                        flexShrink: 0
                      }}>
                        {!contactAvatar && initialLetter}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <h5 style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {contactName}
                          </h5>
                          {contact.verificationStatus === 'verified' && (
                            <Shield size={12} style={{ color: '#38ef7d', flexShrink: 0 }} />
                          )}
                        </div>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
                          {typeof contact.lastMessage === 'string' ? contact.lastMessage : contact.lastMessage?.content || `🚀 ${contact.category || 'Member'}`}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 2. BOTTOM RIGHT BLOCK: ACTIVE CHAT & CALLING WINDOW (Full width layout) */}
          <div className="glass-panel" style={{ borderRadius: '20px', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '480px', width: '100%' }}>
            {activeRecipient ? (
              <>
                {/* Chat Top Header: Avatar & Name (No Badge) (Left) + Audio Call 📞 & Video Call 📹 (Right) */}
                <div style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-glass)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: activeRecipient.communityProfile?.avatarUrl ? `url(${activeRecipient.communityProfile.avatarUrl}) center/cover` : 'linear-gradient(135deg, #00f2fe, #7928ca)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '1.1rem',
                      color: '#fff'
                    }}>
                      {!activeRecipient.communityProfile?.avatarUrl && (activeRecipient.communityProfile?.fullName ? activeRecipient.communityProfile.fullName.charAt(0).toUpperCase() : 'U')}
                    </div>
                    <div>
                      <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#fff' }}>
                        {activeRecipient.communityProfile?.fullName || activeRecipient.username}
                      </h4>
                    </div>
                  </div>

                  {/* Audio & Video Call Buttons */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      className="btn-secondary" 
                      style={{ width: '38px', height: '38px', borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
                      onClick={() => startCall('audio')}
                      title="Audio Call"
                    >
                      <PhoneCall size={16} />
                    </button>
                    <button 
                      className="btn-primary" 
                      style={{ width: '38px', height: '38px', borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
                      onClick={() => startCall('video')}
                      title="Video Call"
                    >
                      <Video size={16} />
                    </button>
                  </div>

                </div>

                {chatErrorMsg && (
                  <div style={{ padding: '8px 16px', background: 'rgba(255, 77, 77, 0.15)', color: '#ff4d4d', fontSize: '0.8rem', textAlign: 'center' }}>
                    {chatErrorMsg}
                  </div>
                )}

                {/* Chat Messages Thread (Full width) */}
                <div ref={chatContainerRef} style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
                  {loadingMsgs ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', margin: 'auto' }}>
                      <Loader2 size={20} className="animate-spin" /> Loading messages...
                    </div>
                  ) : messages.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', margin: 'auto', fontSize: '0.85rem' }}>
                      Say hello to start the conversation!
                    </div>
                  ) : (
                    messages.map((msg, i) => {
                      const isMe = msg.sender === currentUser._id || msg.sender?._id === currentUser._id;
                      return (
                        <div key={i} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                          <div style={{
                            padding: '10px 14px',
                            borderRadius: isMe ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                            background: isMe ? 'linear-gradient(135deg, #00f2fe, #007aff)' : 'rgba(255, 255, 255, 0.08)',
                            color: '#fff',
                            fontSize: '0.88rem',
                            lineHeight: 1.4,
                            boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
                          }}>
                            {msg.content}
                          </div>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px', display: 'block', textAlign: isMe ? 'right' : 'left' }}>
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Chat Input Field & Send Button (Full width) */}
                <form onSubmit={handleSendMessage} style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid var(--border-glass)', display: 'flex', gap: '10px', width: '100%', alignItems: 'center' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Type your message..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    style={{ borderRadius: '24px', fontSize: '0.88rem', padding: '10px 18px', flex: 1, width: '100%' }}
                  />
                  <button type="submit" className="btn-primary" style={{ width: '40px', height: '40px', borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Send size={16} />
                  </button>
                </form>
              </>
            ) : (
              <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
                <MessageSquare size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
                <p style={{ fontSize: '0.9rem' }}>Select a contact above to start chatting!</p>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* --- INCOMING CALL NOTIFICATION MODAL --- */}
      {incomingCall && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
          <div className="glass-panel" style={{ padding: '30px', borderRadius: '24px', textAlign: 'center', maxWidth: '360px', width: '90%' }}>
            <PhoneIncoming size={40} className="animate-bounce" style={{ color: '#00f2fe', marginBottom: '16px' }} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>Incoming {incomingCall.callType.toUpperCase()} Call</h3>
            <p style={{ color: 'var(--text-muted)', margin: '8px 0 24px 0' }}>{incomingCall.callerName} is calling you...</p>

            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
              <button className="btn-secondary" style={{ background: '#ff4d4d', color: '#fff', flex: 1 }} onClick={rejectIncomingCall}>
                Decline
              </button>
              <button className="btn-primary" style={{ background: '#38ef7d', color: '#000', flex: 1, fontWeight: 800 }} onClick={acceptIncomingCall}>
                Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- ACTIVE WEBRTC CALL OVERLAY --- */}
      {activeCall && (
        <div style={{ position: 'fixed', inset: 0, background: '#05070f', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 99998 }}>
          
          <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {activeCall.type === 'video' ? (
              <>
                <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <video ref={localVideoRef} autoPlay playsInline muted style={{ position: 'absolute', bottom: '120px', right: '30px', width: '180px', height: '120px', borderRadius: '16px', objectFit: 'cover', border: '2px solid var(--accent-cyan)' }} />
              </>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: '120px', height: '120px', borderRadius: '50%', background: 'linear-gradient(135deg, #00f2fe, #7928ca)', margin: '0 auto 20px auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', fontWeight: 800, color: '#fff' }}>
                  {activeCall.recipient?.fullName?.charAt(0).toUpperCase() || 'U'}
                </div>
                <h3 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff' }}>{activeCall.recipient?.fullName}</h3>
                <p style={{ color: 'var(--accent-cyan)', marginTop: '6px' }}>{activeCall.status === 'connected' ? 'Call in Progress...' : 'Ringing...'}</p>
              </div>
            )}

            {/* Call Action Controls */}
            <div style={{ position: 'absolute', bottom: '40px', display: 'flex', gap: '20px', alignItems: 'center', background: 'rgba(10, 14, 28, 0.85)', backdropFilter: 'blur(20px)', padding: '16px 30px', borderRadius: '40px', border: '1px solid var(--border-glass)' }}>
              <button onClick={toggleMic} style={{ width: '50px', height: '50px', borderRadius: '50%', background: micMuted ? '#ff4d4d' : 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {micMuted ? <MicOff size={22} /> : <Mic size={22} />}
              </button>

              {activeCall.type === 'video' && (
                <button onClick={toggleVideo} style={{ width: '50px', height: '50px', borderRadius: '50%', background: videoMuted ? '#ff4d4d' : 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {videoMuted ? <VideoOff size={22} /> : <Video size={22} />}
                </button>
              )}

              <button onClick={endCall} style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#ff4d4d', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(255,77,77,0.5)' }}>
                <PhoneOff size={26} />
              </button>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
