import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { io } from 'socket.io-client';
import { Send, PhoneCall, Video, Mic, MicOff, VideoOff, PhoneOff, ShieldAlert, Sparkles, MessageSquare, User, PhoneIncoming, Check, X } from 'lucide-react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

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
  const [activeCall, setActiveCall] = useState(null); // null | { type: 'audio'|'video', status: 'ringing'|'connected', duration: 0, recipient: object }
  const [incomingCall, setIncomingCall] = useState(null); // null | { callerId, callerName, callerAvatar, offer, callType }
  const [micMuted, setMicMuted] = useState(false);
  const [videoMuted, setVideoMuted] = useState(false);

  // WebRTC & Socket Refs
  const socketRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  // Socket Connection Setup
  useEffect(() => {
    if (!currentUser) return;

    const socketUrl = API_URL.replace(/\/api$/, '');
    socketRef.current = io(socketUrl);

    socketRef.current.emit('register_user', currentUser._id);

    socketRef.current.on('receive_message', (data) => {
      setMessages(prev => [...prev, data]);
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
      setErrorMsg('Call was declined by recipient.');
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
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  // --- WebRTC Call Handlers ---

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
    setErrorMsg('');

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
      setErrorMsg('Microphone or Camera access denied: ' + err.message);
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
      setErrorMsg('Media error: ' + err.message);
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

  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = micMuted;
        setMicMuted(!micMuted);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = videoMuted;
        setVideoMuted(!videoMuted);
      }
    }
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
      
      {/* Hidden local & remote video elements for stream binding */}
      <video ref={localVideoRef} autoPlay muted playsInline style={{ display: 'none' }} />
      <video ref={remoteVideoRef} autoPlay playsInline style={{ display: 'none' }} />

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

      {/* Incoming Call Popup Notification */}
      {incomingCall && (
        <div style={{
          position: 'fixed',
          bottom: '30px',
          right: '30px',
          zIndex: 99999,
          background: 'rgba(12, 16, 32, 0.95)',
          border: '1px solid var(--accent-cyan)',
          boxShadow: '0 0 40px rgba(0, 242, 254, 0.5)',
          borderRadius: '20px',
          padding: '24px',
          width: '360px',
          backdropFilter: 'blur(20px)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
            <div style={{
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              background: incomingCall.callerAvatar ? `url(${incomingCall.callerAvatar}) center/cover` : 'linear-gradient(135deg, #00f2fe, #7928ca)',
              border: '2px solid var(--accent-cyan)'
            }} />
            <div>
              <h4 style={{ fontWeight: 800, fontSize: '1.1rem' }}>{incomingCall.callerName}</h4>
              <span style={{ color: 'var(--accent-cyan)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <PhoneIncoming size={14} /> Incoming {incomingCall.callType === 'video' ? 'Video' : 'Audio'} Call...
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              onClick={rejectIncomingCall}
              style={{ flex: 1, padding: '10px', borderRadius: '12px', border: 'none', background: '#ff4d4d', color: '#fff', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              <X size={18} /> Decline
            </button>
            <button 
              onClick={acceptIncomingCall}
              style={{ flex: 1, padding: '10px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #38ef7d, #11998e)', color: '#fff', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              <Check size={18} /> Accept
            </button>
          </div>
        </div>
      )}

      {/* Audio / Video Active Call Screen Overlay */}
      {activeCall && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(5, 7, 15, 0.94)',
          backdropFilter: 'blur(25px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div className="glass-panel" style={{ width: '640px', padding: '36px', borderRadius: '28px', textAlign: 'center', position: 'relative' }}>
            
            {/* Header info */}
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.6rem', fontWeight: 800 }}>{activeCall.recipient?.fullName}</h3>
              <p style={{ color: 'var(--accent-cyan)', fontSize: '0.9rem', marginTop: '4px' }}>
                {activeCall.status === 'ringing' ? '🔔 Calling Space Member...' : `Live Stream Connected (${activeCall.duration}s)`}
              </p>
            </div>

            {/* Live Video Streams Display */}
            {activeCall.type === 'video' && (
              <div style={{
                position: 'relative',
                width: '100%',
                height: '320px',
                background: '#04060f',
                borderRadius: '20px',
                overflow: 'hidden',
                border: '1px solid var(--border-glass)',
                marginBottom: '24px'
              }}>
                {/* Remote Stream Video */}
                <video 
                  ref={(ref) => {
                    if (ref && remoteVideoRef.current?.srcObject) {
                      ref.srcObject = remoteVideoRef.current.srcObject;
                    }
                  }} 
                  autoPlay 
                  playsInline 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />

                {/* Self/Local Stream Preview PIP */}
                <div style={{
                  position: 'absolute',
                  bottom: '16px',
                  right: '16px',
                  width: '120px',
                  height: '90px',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  border: '2px solid var(--accent-cyan)',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
                  background: '#000'
                }}>
                  <video 
                    ref={(ref) => {
                      if (ref && localVideoRef.current?.srcObject) {
                        ref.srcObject = localVideoRef.current.srcObject;
                      }
                    }} 
                    autoPlay 
                    muted 
                    playsInline 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                  />
                </div>
              </div>
            )}

            {/* Audio Call Avatar Animation */}
            {activeCall.type === 'audio' && (
              <div style={{
                width: '120px',
                height: '120px',
                margin: '20px auto 30px auto',
                borderRadius: '50%',
                background: activeCall.recipient?.avatarUrl ? `url(${activeCall.recipient.avatarUrl}) center/cover` : 'linear-gradient(135deg, #00f2fe, #7928ca)',
                border: '3px solid var(--accent-cyan)',
                boxShadow: activeCall.status === 'connected' ? '0 0 40px rgba(56, 239, 125, 0.6)' : '0 0 30px rgba(0, 242, 254, 0.4)'
              }} />
            )}

            {/* Controls Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px' }}>
              <button 
                onClick={toggleMic} 
                title={micMuted ? "Unmute Mic" : "Mute Mic"}
                style={{ width: '54px', height: '54px', borderRadius: '50%', border: 'none', background: micMuted ? '#ff4d4d' : 'rgba(255, 255, 255, 0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
              >
                {micMuted ? <MicOff size={22} /> : <Mic size={22} />}
              </button>

              {activeCall.type === 'video' && (
                <button 
                  onClick={toggleVideo} 
                  title={videoMuted ? "Turn Camera On" : "Turn Camera Off"}
                  style={{ width: '54px', height: '54px', borderRadius: '50%', border: 'none', background: videoMuted ? '#ff4d4d' : 'rgba(255, 255, 255, 0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                >
                  {videoMuted ? <VideoOff size={22} /> : <Video size={22} />}
                </button>
              )}

              <button 
                onClick={endCall} 
                title="End Call"
                style={{ width: '54px', height: '54px', borderRadius: '50%', border: 'none', background: '#ff007f', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 24px rgba(255, 0, 127, 0.6)', transition: 'all 0.2s' }}
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
