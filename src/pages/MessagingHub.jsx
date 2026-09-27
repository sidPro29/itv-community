import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Send, PhoneCall, Video, Mic, MicOff, VideoOff, PhoneOff, ShieldAlert, Sparkles, MessageSquare, User } from 'lucide-react';

export default function MessagingHub() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser, verificationStatus, API_URL } = useAuth();

  const recipientIdFromQuery = searchParams.get('recipient');
  const initialAction = searchParams.get('action');

  const [activeRecipient, setActiveRecipient] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Call Modal States
  const [activeCall, setActiveCall] = useState(null); // null | { type: 'audio'|'video', status: 'ringing'|'connected', duration: 0 }
  const [micMuted, setMicMuted] = useState(false);
  const [videoMuted, setVideoMuted] = useState(false);

  // Fetch recipient member info if query exists
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
          startCall(initialAction);
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

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !activeRecipient) return;

    setErrorMsg('');
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

      setMessages([...messages, data]);
      setInputText('');
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const startCall = (type) => {
    setActiveCall({
      type,
      status: 'ringing',
      duration: 0
    });

    // Simulate connection after 3 seconds
    setTimeout(() => {
      setActiveCall(prev => prev ? { ...prev, status: 'connected' } : null);
    }, 3000);
  };

  const endCall = async () => {
    if (activeCall && activeRecipient) {
      try {
        const token = localStorage.getItem('token');
        await fetch(`${API_URL}/community/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-auth-token': token
          },
          body: JSON.stringify({
            recipientId: activeRecipient._id,
            content: `${activeCall.type === 'audio' ? 'Audio Call' : 'Video Call'} (${activeCall.duration}s)`,
            type: activeCall.type === 'audio' ? 'audio_call' : 'video_call',
            callDurationSeconds: activeCall.duration
          })
        });
        fetchMessages(activeRecipient._id);
      } catch (err) {
        console.error(err);
      }
    }
    setActiveCall(null);
  };

  // Timer for active call duration
  useEffect(() => {
    let interval = null;
    if (activeCall && activeCall.status === 'connected') {
      interval = setInterval(() => {
        setActiveCall(prev => prev ? { ...prev, duration: prev.duration + 1 } : null);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeCall?.status]);

  if (verificationStatus !== 'verified') {
    return (
      <div style={{ maxWidth: '600px', margin: '80px auto', padding: '0 20px', textAlign: 'center' }}>
        <div className="glass-panel" style={{ padding: '40px', borderRadius: '24px' }}>
          <ShieldAlert size={48} style={{ color: '#ff007f', margin: '0 auto 16px auto', display: 'block' }} />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Messaging & Calls Locked</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '8px', lineHeight: 1.6 }}>
            Private messaging, audio calls, and video calls are exclusive to verified community members. Complete your verification profile to gain access.
          </p>
          <button className="btn-primary" style={{ marginTop: '24px' }} onClick={() => navigate('/profile')}>
            Verify Your Profile Now
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '30px auto', padding: '0 20px' }}>
      
      <div className="glass-panel" style={{
        display: 'grid',
        gridTemplateColumns: '280px 1fr',
        height: '75vh',
        borderRadius: '24px',
        overflow: 'hidden'
      }}>
        
        {/* Sidebar: Conversations / Recipient */}
        <div style={{ borderRight: '1px solid var(--border-glass)', padding: '20px', background: 'rgba(5, 7, 15, 0.4)' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MessageSquare size={18} style={{ color: 'var(--accent-cyan)' }} /> Conversations
          </h3>

          {activeRecipient ? (
            <div className="glass-panel" style={{ padding: '14px', borderRadius: '12px', background: 'rgba(0, 242, 254, 0.1)', borderColor: 'var(--accent-cyan)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: activeRecipient.avatarUrl ? `url(${activeRecipient.avatarUrl}) center/cover` : '#00f2fe', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                  {!activeRecipient.avatarUrl && activeRecipient.fullName.charAt(0)}
                </div>
                <div>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>{activeRecipient.fullName}</h4>
                  <span className={`badge-category badge-${activeRecipient.category}`} style={{ fontSize: '0.7rem' }}>
                    {activeRecipient.category}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Select a member from the Directory to start private messaging or calling.
            </p>
          )}
        </div>

        {/* Main Messaging Area */}
        {activeRecipient ? (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            
            {/* Header with Call Controls */}
            <div style={{
              padding: '16px 24px',
              borderBottom: '1px solid var(--border-glass)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(12, 16, 32, 0.8)'
            }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>{activeRecipient.fullName}</h3>
                <span style={{ color: '#38ef7d', fontSize: '0.8rem' }}>● Online & Verified</span>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn-secondary" style={{ padding: '8px 14px' }} onClick={() => startCall('audio')}>
                  <PhoneCall size={16} /> Audio Call
                </button>
                <button className="btn-primary" style={{ padding: '8px 14px' }} onClick={() => startCall('video')}>
                  <Video size={16} /> Video Call
                </button>
              </div>
            </div>

            {/* Message Thread */}
            <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {errorMsg && (
                <div style={{ background: 'rgba(255, 77, 77, 0.15)', color: '#ff4d4d', padding: '10px 14px', borderRadius: '10px', fontSize: '0.85rem' }}>
                  {errorMsg}
                </div>
              )}

              {loadingMsgs ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Loading conversation...</p>
              ) : messages.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', margin: 'auto' }}>
                  <Sparkles size={32} style={{ color: 'var(--accent-cyan)', marginBottom: '8px' }} />
                  <p>Start private conversation with {activeRecipient.fullName}</p>
                </div>
              ) : (
                messages.map((m, i) => {
                  const isMine = m.sender === currentUser._id || m.sender?.toString() === currentUser._id?.toString();
                  return (
                    <div 
                      key={i}
                      style={{
                        alignSelf: isMine ? 'flex-end' : 'flex-start',
                        maxWidth: '70%',
                        background: isMine ? 'linear-gradient(135deg, #00f2fe, #007aff)' : 'rgba(255, 255, 255, 0.08)',
                        color: isMine ? '#fff' : '#e2e8f0',
                        padding: '12px 18px',
                        borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                        fontSize: '0.95rem'
                      }}
                    >
                      {m.content}
                    </div>
                  );
                })
              )}
            </div>

            {/* Input Box */}
            <form onSubmit={handleSendMessage} style={{ padding: '16px 24px', borderTop: '1px solid var(--border-glass)', display: 'flex', gap: '12px' }}>
              <input 
                type="text"
                className="form-input"
                style={{ flex: 1 }}
                placeholder="Type your message..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
              <button type="submit" className="btn-primary" style={{ padding: '12px 20px' }}>
                <Send size={18} />
              </button>
            </form>

          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            Select a member from directory to start chatting
          </div>
        )}

      </div>

      {/* Audio / Video Call Active Modal */}
      {activeCall && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(5, 7, 15, 0.92)',
          backdropFilter: 'blur(20px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div className="glass-panel" style={{ width: '480px', padding: '40px', borderRadius: '28px', textAlign: 'center' }}>
            
            <div style={{
              width: '100px',
              height: '100px',
              margin: '0 auto 20px auto',
              borderRadius: '50%',
              background: activeRecipient?.avatarUrl ? `url(${activeRecipient.avatarUrl}) center/cover` : 'linear-gradient(135deg, #00f2fe, #7928ca)',
              border: '3px solid var(--accent-cyan)',
              boxShadow: '0 0 30px rgba(0, 242, 254, 0.4)'
            }} />

            <h3 style={{ fontSize: '1.6rem', fontWeight: 800 }}>{activeRecipient?.fullName}</h3>
            <p style={{ color: 'var(--accent-cyan)', fontSize: '0.9rem', marginTop: '4px' }}>
              {activeCall.status === 'ringing' ? '🔔 Calling Space Member...' : `Connected (${activeCall.duration}s)`}
            </p>

            {/* Video Placeholder if Video Call */}
            {activeCall.type === 'video' && activeCall.status === 'connected' && (
              <div style={{
                height: '180px',
                background: '#0a0e1c',
                border: '1px solid var(--border-glass)',
                borderRadius: '16px',
                margin: '20px 0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)'
              }}>
                📷 High Definition Space Stream Connected
              </div>
            )}

            {/* Control Buttons */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '30px' }}>
              <button 
                onClick={() => setMicMuted(!micMuted)} 
                style={{ width: '50px', height: '50px', borderRadius: '50%', border: 'none', background: micMuted ? '#ff4d4d' : 'rgba(255, 255, 255, 0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {micMuted ? <MicOff size={22} /> : <Mic size={22} />}
              </button>

              {activeCall.type === 'video' && (
                <button 
                  onClick={() => setVideoMuted(!videoMuted)} 
                  style={{ width: '50px', height: '50px', borderRadius: '50%', border: 'none', background: videoMuted ? '#ff4d4d' : 'rgba(255, 255, 255, 0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {videoMuted ? <VideoOff size={22} /> : <Video size={22} />}
                </button>
              )}

              <button 
                onClick={endCall} 
                style={{ width: '50px', height: '50px', borderRadius: '50%', border: 'none', background: '#ff007f', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(255, 0, 127, 0.5)' }}
              >
                <PhoneOff size={24} />
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
