import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { 
  Calendar, Clock, Video, Mic, Plus, Users, Search, 
  Check, X, PhoneCall, Copy, Trash2, Shield, Sparkles, 
  ExternalLink, AlertCircle, Share2
} from 'lucide-react';
import DeviceSetupModal from '../components/DeviceSetupModal';
import CallModal from '../components/CallModal';

export default function ScheduleMeetings() {
  const { currentUser, API_URL } = useAuth();
  const location = useLocation();

  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('upcoming'); // upcoming, my_hosted, past
  const [searchQuery, setSearchQuery] = useState('');

  // Schedule Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [callType, setCallType] = useState('video');
  const [scheduledAt, setScheduledAt] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [allMembers, setAllMembers] = useState([]);
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  // Active WebRTC Call & Setup States
  const [setupModalConfig, setSetupModalConfig] = useState(null);
  const [activeCallRoom, setActiveCallRoom] = useState(null);
  const socketRef = useRef(null);

  const SOCKET_URL = API_URL.replace('/api', '');

  // Initialize Socket.io for in-page WebRTC meetings
  useEffect(() => {
    if (!currentUser?._id) return;

    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 15
    });

    socketRef.current.emit('user_connected', currentUser._id);

    return () => {
      socketRef.current?.disconnect();
    };
  }, [currentUser, SOCKET_URL]);

  // Fetch Scheduled Calls & Members
  useEffect(() => {
    fetchScheduledCalls();
    fetchMembers();
  }, []);

  // Handle URL query to prefill scheduling with a specific member
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const scheduleWith = params.get('scheduleWith');
    if (scheduleWith && allMembers.length > 0) {
      const target = allMembers.find(m => m._id === scheduleWith);
      if (target && !selectedParticipants.includes(target._id)) {
        setSelectedParticipants([target._id]);
        setIsModalOpen(true);
      }
    }
  }, [location.search, allMembers]);

  const fetchScheduledCalls = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/community/scheduled-calls`, {
        headers: { 'x-auth-token': token }
      });
      if (res.ok) {
        const data = await res.json();
        setCalls(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error fetching scheduled calls:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/community/members`, {
        headers: { 'x-auth-token': token }
      });
      if (res.ok) {
        const data = await res.json();
        setAllMembers(Array.isArray(data) ? data.filter(m => m._id !== currentUser._id) : []);
      }
    } catch (err) {
      console.error('Error fetching members:', err);
    }
  };

  const handleOpenScheduleModal = () => {
    // Default scheduled time to 1 hour from now formatted for datetime-local
    const now = new Date();
    now.setHours(now.getHours() + 1);
    now.setMinutes(0);
    const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

    setScheduledAt(localIso);
    setTitle('');
    setDescription('');
    setCallType('video');
    setDurationMinutes(30);
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const toggleParticipant = (memberId) => {
    setSelectedParticipants(prev => 
      prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId]
    );
  };

  const handleCreateSchedule = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Please enter a meeting title.');
      return;
    }
    if (!scheduledAt) {
      setErrorMsg('Please select a date and time.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg('');
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/community/scheduled-calls`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          callType,
          scheduledAt: new Date(scheduledAt).toISOString(),
          durationMinutes: Number(durationMinutes),
          participantIds: selectedParticipants
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.msg || 'Failed to schedule call');
      }

      setIsModalOpen(false);
      fetchScheduledCalls();
    } catch (err) {
      setErrorMsg(err.message || 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelCall = async (callId) => {
    if (!window.confirm('Are you sure you want to cancel this scheduled meeting?')) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/community/scheduled-calls/${callId}`, {
        method: 'DELETE',
        headers: { 'x-auth-token': token }
      });
      if (res.ok) {
        setCalls(prev => prev.map(c => c._id === callId ? { ...c, status: 'cancelled' } : c));
      }
    } catch (err) {
      console.error('Error cancelling call:', err);
    }
  };

  const copyMeetingLink = (call) => {
    const url = `${window.location.origin}/schedule?joinRoom=${call.roomId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(call._id);
      setTimeout(() => setCopiedId(null), 2500);
    });
  };

  // Launch Call via Device Setup
  const handleJoinCall = (call) => {
    const participantIds = (call.participants || []).map(p => (p._id || p).toString());
    const isHost = (call.host?._id || call.host) === currentUser._id;

    setSetupModalConfig({
      roomId: call.roomId,
      callType: call.callType || 'video',
      selectedUserIds: participantIds,
      isInitiator: isHost,
      isRejoin: true,
      title: call.title
    });
  };

  const handleSetupCompleted = ({ selectedAudioId, selectedVideoId, selectedAudioOutput, isMicMuted, isVideoOff, stream }) => {
    if (!setupModalConfig) return;

    setActiveCallRoom({
      roomId: setupModalConfig.roomId,
      callType: setupModalConfig.callType,
      isInitiator: setupModalConfig.isInitiator,
      isRejoin: setupModalConfig.isRejoin,
      selectedUserIds: setupModalConfig.selectedUserIds,
      initialStream: stream,
      initialMicMuted: isMicMuted,
      initialVideoOff: isVideoOff,
      selectedAudioId,
      selectedVideoId,
      selectedAudioOutput
    });

    setSetupModalConfig(null);
  };

  const handleCallModalClose = () => {
    if (activeCallRoom?.initialStream) {
      activeCallRoom.initialStream.getTracks().forEach(t => t.stop());
    }
    setActiveCallRoom(null);
  };

  // Filter Calls
  const now = new Date();
  const filteredCalls = calls.filter(call => {
    const callDate = new Date(call.scheduledAt);
    const isPast = callDate < new Date(now.getTime() - 60 * 60 * 1000) || call.status === 'completed' || call.status === 'cancelled';
    const isMyHosted = (call.host?._id || call.host) === currentUser._id;

    if (activeTab === 'upcoming') {
      if (isPast) return false;
    } else if (activeTab === 'my_hosted') {
      if (!isMyHosted) return false;
    } else if (activeTab === 'past') {
      if (!isPast) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = call.title.toLowerCase().includes(q);
      const matchDesc = (call.description || '').toLowerCase().includes(q);
      const matchHost = (call.host?.communityProfile?.fullName || call.host?.username || '').toLowerCase().includes(q);
      return matchTitle || matchDesc || matchHost;
    }

    return true;
  });

  const filteredMembers = allMembers.filter(m => {
    if (!memberSearch.trim()) return true;
    const name = (m.communityProfile?.fullName || m.username || '').toLowerCase();
    const cat = (m.communityProfile?.category || '').toLowerCase();
    return name.includes(memberSearch.toLowerCase()) || cat.includes(memberSearch.toLowerCase());
  });

  return (
    <div style={{ maxWidth: '1200px', margin: '36px auto', padding: '0 24px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      
      {/* Hero Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '20px',
        marginBottom: '32px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{
              background: 'rgba(0, 242, 254, 0.12)',
              color: '#00f2fe',
              border: '1px solid rgba(0, 242, 254, 0.25)',
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '0.75rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Calendar size={13} /> ITV SPACE MEETINGS
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: '2.2rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>
            Scheduled Calls & Meetings
          </h1>
          <p style={{ margin: '8px 0 0 0', color: 'rgba(255,255,255,0.65)', fontSize: '0.95rem' }}>
            Schedule ahead, invite community members, and join crystal-clear HD audio/video calls.
          </p>
        </div>

        <button
          onClick={handleOpenScheduleModal}
          style={{
            background: 'linear-gradient(135deg, #00f2fe 0%, #007aff 100%)',
            border: 'none',
            borderRadius: '14px',
            padding: '14px 24px',
            color: '#fff',
            fontWeight: 800,
            fontSize: '0.95rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 8px 25px rgba(0, 242, 254, 0.35)',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease'
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <Plus size={18} /> Schedule a Call
        </button>
      </div>

      {/* Tabs & Search Controls */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        background: 'rgba(13, 19, 38, 0.7)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '16px',
        padding: '10px 16px',
        marginBottom: '28px'
      }}>
        {/* Filter Tabs */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {[
            { id: 'upcoming', label: 'Upcoming' },
            { id: 'my_hosted', label: 'Hosted by Me' },
            { id: 'past', label: 'Past & Cancelled' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: activeTab === tab.id ? 'rgba(0, 242, 254, 0.15)' : 'transparent',
                color: activeTab === tab.id ? '#00f2fe' : 'rgba(255,255,255,0.65)',
                border: activeTab === tab.id ? '1px solid rgba(0, 242, 254, 0.3)' : '1px solid transparent',
                borderRadius: '10px',
                padding: '8px 16px',
                fontSize: '0.86rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div style={{
          position: 'relative',
          minWidth: '240px',
          flex: '1',
          maxWidth: '360px'
        }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)' }} />
          <input
            type="text"
            placeholder="Search meetings by title or host..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '10px',
              padding: '8px 12px 8px 36px',
              color: '#fff',
              fontSize: '0.85rem',
              outline: 'none'
            }}
          />
        </div>
      </div>

      {/* Meetings Grid / List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.5)' }}>
          <Clock size={32} style={{ animation: 'spin 2s linear infinite', marginBottom: '12px' }} />
          <p>Loading scheduled meetings...</p>
        </div>
      ) : filteredCalls.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          background: 'rgba(13, 19, 38, 0.4)',
          borderRadius: '20px',
          border: '1px dashed rgba(255,255,255,0.12)'
        }}>
          <Calendar size={48} style={{ color: 'rgba(255,255,255,0.25)', marginBottom: '12px' }} />
          <h3 style={{ margin: '0 0 6px 0', color: '#fff', fontSize: '1.2rem', fontWeight: 700 }}>
            {activeTab === 'upcoming' ? 'No Upcoming Meetings' : activeTab === 'my_hosted' ? 'No Meetings Hosted by You' : 'No Past Meetings'}
          </h3>
          <p style={{ margin: '0 0 20px 0', color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>
            Schedule a meeting in advance to sync with space community members.
          </p>
          <button
            onClick={handleOpenScheduleModal}
            style={{
              background: 'rgba(0, 242, 254, 0.15)',
              color: '#00f2fe',
              border: '1px solid rgba(0, 242, 254, 0.3)',
              borderRadius: '12px',
              padding: '10px 20px',
              fontWeight: 700,
              fontSize: '0.88rem',
              cursor: 'pointer'
            }}
          >
            + Schedule Your First Call
          </button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
          gap: '22px'
        }}>
          {filteredCalls.map(call => {
            const isHost = (call.host?._id || call.host) === currentUser._id;
            const callDate = new Date(call.scheduledAt);
            const isLiveSoon = Math.abs(callDate - new Date()) < 15 * 60 * 1000;
            const isCancelled = call.status === 'cancelled';

            return (
              <div
                key={call._id}
                style={{
                  background: 'rgba(13, 19, 38, 0.85)',
                  border: isLiveSoon && !isCancelled ? '1px solid #00f2fe' : '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '20px',
                  padding: '22px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: isLiveSoon && !isCancelled ? '0 8px 30px rgba(0, 242, 254, 0.2)' : '0 8px 24px rgba(0,0,0,0.4)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {/* Status Badges */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{
                        background: call.callType === 'audio' ? 'rgba(52, 199, 89, 0.15)' : 'rgba(0, 122, 255, 0.15)',
                        color: call.callType === 'audio' ? '#34c759' : '#007aff',
                        border: `1px solid ${call.callType === 'audio' ? 'rgba(52, 199, 89, 0.3)' : 'rgba(0, 122, 255, 0.3)'}`,
                        borderRadius: '20px',
                        padding: '3px 10px',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}>
                        {call.callType === 'audio' ? <Mic size={12} /> : <Video size={12} />}
                        {call.callType === 'audio' ? 'Audio Call' : 'Video Call'}
                      </span>

                      {isLiveSoon && !isCancelled && (
                        <span style={{
                          background: 'rgba(255, 0, 128, 0.2)',
                          color: '#ff0080',
                          border: '1px solid rgba(255, 0, 128, 0.4)',
                          borderRadius: '20px',
                          padding: '3px 10px',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          animation: 'pulse 1.5s infinite'
                        }}>
                          LIVE NOW
                        </span>
                      )}

                      {isCancelled && (
                        <span style={{
                          background: 'rgba(255, 77, 77, 0.15)',
                          color: '#ff4d4d',
                          border: '1px solid rgba(255, 77, 77, 0.3)',
                          borderRadius: '20px',
                          padding: '3px 10px',
                          fontSize: '0.72rem',
                          fontWeight: 800
                        }}>
                          Cancelled
                        </span>
                      )}
                    </div>

                    {isHost && !isCancelled && (
                      <button
                        onClick={() => handleCancelCall(call._id)}
                        title="Cancel Meeting"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'rgba(255,255,255,0.4)',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = '#ff4d4d'}
                        onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>

                  {/* Title & Description */}
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '1.25rem', fontWeight: 800, color: '#fff', lineHeight: 1.3 }}>
                    {call.title}
                  </h3>
                  {call.description && (
                    <p style={{ margin: '0 0 16px 0', color: 'rgba(255,255,255,0.65)', fontSize: '0.85rem', lineHeight: 1.4 }}>
                      {call.description}
                    </p>
                  )}

                  {/* Date & Duration Info */}
                  <div style={{
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: '12px',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '16px',
                    fontSize: '0.84rem',
                    color: 'rgba(255,255,255,0.85)'
                  }}>
                    <Calendar size={15} color="#00f2fe" />
                    <span>
                      {callDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} • {callDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.3)' }}>|</span>
                    <Clock size={14} color="#00f2fe" />
                    <span>{call.durationMinutes || 30} mins</span>
                  </div>

                  {/* Host & Participants Row */}
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>
                      HOST & PARTICIPANTS
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {/* Host Avatar */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '20px', padding: '3px 10px 3px 4px' }}>
                        <div style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #00f2fe, #7928ca)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          color: '#fff'
                        }}>
                          {(call.host?.communityProfile?.fullName || call.host?.username || 'H').charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontSize: '0.8rem', color: '#fff' }}>
                          {isHost ? 'You (Host)' : (call.host?.communityProfile?.fullName || call.host?.username)}
                        </span>
                      </div>

                      {/* Participant Count */}
                      {(call.participants || []).length > 0 && (
                        <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>
                          + {call.participants.length} member{call.participants.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions Bottom Bar */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  {!isCancelled && (
                    <button
                      onClick={() => handleJoinCall(call)}
                      style={{
                        flex: 1,
                        background: 'linear-gradient(135deg, #00f2fe 0%, #007aff 100%)',
                        border: 'none',
                        borderRadius: '12px',
                        padding: '11px 16px',
                        color: '#fff',
                        fontWeight: 800,
                        fontSize: '0.88rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        boxShadow: '0 4px 15px rgba(0, 242, 254, 0.3)'
                      }}
                    >
                      <PhoneCall size={15} /> Join Call Now
                    </button>
                  )}

                  <button
                    onClick={() => copyMeetingLink(call)}
                    title="Copy Meeting Link"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '12px',
                      padding: '11px',
                      color: copiedId === call._id ? '#00f2fe' : '#fff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {copiedId === call._id ? <Check size={16} /> : <Share2 size={16} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* --- SCHEDULE A CALL MODAL --- */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(3, 7, 18, 0.8)',
          backdropFilter: 'blur(14px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '20px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '520px',
            background: '#0d1326',
            borderRadius: '24px',
            border: '1px solid rgba(0, 242, 254, 0.3)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.9)',
            padding: '28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            color: '#fff',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={20} color="#00f2fe" />
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Schedule a Call</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={16} />
              </button>
            </div>

            {errorMsg && (
              <div style={{
                background: 'rgba(255, 77, 77, 0.15)',
                border: '1px solid rgba(255, 77, 77, 0.3)',
                borderRadius: '10px',
                padding: '10px 14px',
                color: '#ff4d4d',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={15} /> {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateSchedule} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Title */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>
                  MEETING TITLE *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Space Tech Sync, Product Demo"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    color: '#fff',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Call Type Selector */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>
                  CALL TYPE
                </label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setCallType('video')}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '10px',
                      background: callType === 'video' ? 'rgba(0, 242, 254, 0.2)' : 'rgba(255,255,255,0.05)',
                      border: callType === 'video' ? '1px solid #00f2fe' : '1px solid rgba(255,255,255,0.1)',
                      color: callType === 'video' ? '#00f2fe' : '#fff',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <Video size={16} /> Video Call
                  </button>
                  <button
                    type="button"
                    onClick={() => setCallType('audio')}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '10px',
                      background: callType === 'audio' ? 'rgba(52, 199, 89, 0.2)' : 'rgba(255,255,255,0.05)',
                      border: callType === 'audio' ? '1px solid #34c759' : '1px solid rgba(255,255,255,0.1)',
                      color: callType === 'audio' ? '#34c759' : '#fff',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <Mic size={16} /> Audio Call
                  </button>
                </div>
              </div>

              {/* Date & Time and Duration */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 2 }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>
                    DATE & TIME *
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={e => setScheduledAt(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '10px',
                      padding: '10px 14px',
                      color: '#fff',
                      fontSize: '0.85rem',
                      outline: 'none',
                      colorScheme: 'dark'
                    }}
                  />
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>
                    DURATION
                  </label>
                  <select
                    value={durationMinutes}
                    onChange={e => setDurationMinutes(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '10px',
                      padding: '10px 12px',
                      color: '#fff',
                      fontSize: '0.85rem',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value={15} style={{ background: '#0d1326' }}>15 mins</option>
                    <option value={30} style={{ background: '#0d1326' }}>30 mins</option>
                    <option value={45} style={{ background: '#0d1326' }}>45 mins</option>
                    <option value={60} style={{ background: '#0d1326' }}>1 hour</option>
                  </select>
                </div>
              </div>

              {/* Description / Agenda */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>
                  AGENDA / DESCRIPTION (OPTIONAL)
                </label>
                <textarea
                  placeholder="Outline the topics you want to cover..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={2}
                  style={{
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    color: '#fff',
                    fontSize: '0.85rem',
                    outline: 'none',
                    resize: 'none'
                  }}
                />
              </div>

              {/* Participant Selection */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>
                  INVITE MEMBERS ({selectedParticipants.length} SELECTED)
                </label>
                
                <div style={{ position: 'relative', marginBottom: '8px' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)' }} />
                  <input
                    type="text"
                    placeholder="Search community members..."
                    value={memberSearch}
                    onChange={e => setMemberSearch(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      padding: '7px 10px 7px 32px',
                      color: '#fff',
                      fontSize: '0.82rem',
                      outline: 'none'
                    }}
                  />
                </div>

                <div style={{
                  maxHeight: '160px',
                  overflowY: 'auto',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '10px',
                  background: 'rgba(0,0,0,0.25)',
                  padding: '6px'
                }}>
                  {filteredMembers.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', padding: '16px', fontSize: '0.82rem' }}>
                      No members found.
                    </div>
                  ) : (
                    filteredMembers.map(member => {
                      const isSelected = selectedParticipants.includes(member._id);
                      const name = member.communityProfile?.fullName || member.username;
                      const initial = name.charAt(0).toUpperCase();

                      return (
                        <div
                          key={member._id}
                          onClick={() => toggleParticipant(member._id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            background: isSelected ? 'rgba(0, 242, 254, 0.12)' : 'transparent',
                            cursor: 'pointer',
                            marginBottom: '4px',
                            transition: 'background 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                              width: '26px',
                              height: '26px',
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, #00f2fe, #7928ca)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              color: '#fff'
                            }}>
                              {initial}
                            </div>
                            <div>
                              <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#fff' }}>{name}</div>
                              {member.communityProfile?.category && (
                                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' }}>
                                  {member.communityProfile.category}
                                </div>
                              )}
                            </div>
                          </div>

                          <div style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '5px',
                            border: isSelected ? '1px solid #00f2fe' : '1px solid rgba(255,255,255,0.3)',
                            background: isSelected ? '#00f2fe' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            {isSelected && <Check size={12} color="#000" />}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  marginTop: '8px',
                  background: 'linear-gradient(135deg, #00f2fe 0%, #007aff 100%)',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '12px',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: '0.92rem',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  opacity: isSubmitting ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 20px rgba(0, 242, 254, 0.35)'
                }}
              >
                <Calendar size={16} />
                {isSubmitting ? 'Scheduling...' : 'Schedule Call & Send Invites'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- IN-PAGE WEBRTC CALL & DEVICE SETUP MODALS --- */}
      <DeviceSetupModal
        isOpen={Boolean(setupModalConfig)}
        onClose={() => setSetupModalConfig(null)}
        callRoom={setupModalConfig}
        onJoinCall={handleSetupCompleted}
      />

      <CallModal
        isOpen={Boolean(activeCallRoom)}
        onClose={handleCallModalClose}
        currentUser={currentUser}
        callRoom={activeCallRoom}
        socket={socketRef.current}
        allMembers={allMembers}
      />

    </div>
  );
}
