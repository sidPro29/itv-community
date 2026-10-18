import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, MicOff, Video, VideoOff, PhoneOff, Monitor, MonitorOff, 
  UserPlus, Users, Volume2, ShieldCheck, Maximize2, Minimize2,
  Search, Check, X
} from 'lucide-react';
import { ringback } from '../utils/soundEffects';

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

export default function CallModal({
  isOpen,
  onClose,
  currentUser,
  callRoom,
  socket,
  allMembers = []
}) {
  const [localStream, setLocalStream] = useState(null);
  const [peers, setPeers] = useState({}); // key: socketId -> { socketId, userId, userInfo, stream, isAudioMuted, isVideoOff, isScreenSharing }
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(callRoom?.callType === 'audio');
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [callStatus, setCallStatus] = useState('connecting'); // connecting, ringing, connected
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteSearch, setInviteSearch] = useState('');
  const [invitedMap, setInvitedMap] = useState({});
  const [fullscreenVideoId, setFullscreenVideoId] = useState(null);

  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const peerConnectionsRef = useRef({}); // socketId -> RTCPeerConnection
  const timerRef = useRef(null);

  // Initialize Local Media & Room on Open
  useEffect(() => {
    if (!isOpen || !callRoom?.roomId) return;

    let mounted = true;

    async function initMedia() {
      let stream = null;

      // Smart fallback: try audio+video -> audio only -> video only -> empty stream
      if (callRoom.callType === 'video') {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        } catch (err1) {
          console.warn('Audio+Video failed, trying audio only:', err1);
          try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            setIsVideoOff(true);
          } catch (err2) {
            console.warn('Audio failed, trying video only:', err2);
            try {
              stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
              setIsMicMuted(true);
            } catch (err3) {
              console.warn('No media devices available or blocked:', err3);
              stream = new MediaStream();
              setIsVideoOff(true);
              setIsMicMuted(true);
            }
          }
        }
      } else {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        } catch (errAudio) {
          console.warn('Audio stream acquisition failed:', errAudio);
          stream = new MediaStream();
          setIsMicMuted(true);
        }
      }

      if (!mounted) {
        if (stream) stream.getTracks().forEach(t => t.stop());
        return;
      }

      localStreamRef.current = stream;
      setLocalStream(stream);

      if (localVideoRef.current && stream.getVideoTracks().length > 0) {
        localVideoRef.current.srcObject = stream;
      }

      // Join room on Socket.IO
      socket?.emit('join_call_room', {
        roomId: callRoom.roomId,
        userInfo: {
          userId: currentUser._id,
          fullName: currentUser.communityProfile?.fullName || currentUser.username,
          avatarUrl: currentUser.communityProfile?.avatarUrl,
          category: currentUser.communityProfile?.category
        }
      });

      setCallStatus(callRoom.isInitiator ? 'ringing' : 'connected');
    }

    initMedia();

    // Call timer
    timerRef.current = setInterval(() => {
      setCallDuration(d => d + 1);
    }, 1000);

    return () => {
      mounted = false;
      if (timerRef.current) clearInterval(timerRef.current);
      cleanUpEverything();
    };
  }, [isOpen, callRoom?.roomId]);

  // Outgoing Ringback Sound
  useEffect(() => {
    if (callStatus === 'ringing') {
      ringback.playRingback();
    } else {
      ringback.stop();
    }
    return () => ringback.stop();
  }, [callStatus]);

  // Clean up all tracks and peer connections
  const cleanUpEverything = () => {
    ringback.stop();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }
    Object.values(peerConnectionsRef.current).forEach(pc => {
      try { pc.close(); } catch (e) {}
    });
    peerConnectionsRef.current = {};
    setPeers({});
    setLocalStream(null);
    setIsScreenSharing(false);
  };

  // Setup WebRTC Peer Connection Helper
  const createPeer = (targetSocketId, targetUserInfo) => {
    if (peerConnectionsRef.current[targetSocketId]) {
      return peerConnectionsRef.current[targetSocketId];
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    peerConnectionsRef.current[targetSocketId] = pc;

    // Ensure transceivers exist so screen sharing track addition/replacement always works
    try {
      pc.addTransceiver('audio', { direction: 'sendrecv' });
      pc.addTransceiver('video', { direction: 'sendrecv' });
    } catch (e) {}

    // Add local media tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // Handle incoming remote stream tracks
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      setPeers(prev => ({
        ...prev,
        [targetSocketId]: {
          socketId: targetSocketId,
          userId: targetUserInfo?.userId,
          userInfo: targetUserInfo || prev[targetSocketId]?.userInfo,
          stream: remoteStream,
          isAudioMuted: prev[targetSocketId]?.isAudioMuted || false,
          isVideoOff: prev[targetSocketId]?.isVideoOff || false,
          isScreenSharing: prev[targetSocketId]?.isScreenSharing || false
        }
      }));
      setCallStatus('connected');
    };

    // Send ICE candidates to target
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket?.emit('call_peer_ice', {
          targetSocketId,
          candidate: event.candidate
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        removePeer(targetSocketId);
      }
    };

    return pc;
  };

  const removePeer = (targetSocketId) => {
    if (peerConnectionsRef.current[targetSocketId]) {
      try {
        peerConnectionsRef.current[targetSocketId].close();
      } catch (e) {}
      delete peerConnectionsRef.current[targetSocketId];
    }
    setPeers(prev => {
      const updated = { ...prev };
      delete updated[targetSocketId];
      return updated;
    });
  };

  // Listen to Socket events for WebRTC signaling
  useEffect(() => {
    if (!socket || !isOpen) return;

    // 1. Another user joined room -> Existing participants initiate offer
    const handleUserJoined = async ({ socketId, userId, userInfo }) => {
      console.log('[WebRTC] User joined call room:', userInfo?.fullName, socketId);
      if (socketId === socket.id) return;

      const pc = createPeer(socketId, userInfo);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit('call_peer_offer', {
          targetSocketId: socketId,
          offer,
          senderInfo: {
            userId: currentUser._id,
            fullName: currentUser.communityProfile?.fullName || currentUser.username,
            avatarUrl: currentUser.communityProfile?.avatarUrl
          }
        });
      } catch (err) {
        console.error('[WebRTC] Error creating offer:', err);
      }
    };

    // 2. Received Offer -> Create Answer
    const handlePeerOffer = async ({ senderSocketId, offer, senderInfo }) => {
      console.log('[WebRTC] Received offer from:', senderInfo?.fullName, senderSocketId);
      const pc = createPeer(senderSocketId, senderInfo);

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('call_peer_answer', {
          targetSocketId: senderSocketId,
          answer,
          senderInfo: {
            userId: currentUser._id,
            fullName: currentUser.communityProfile?.fullName || currentUser.username,
            avatarUrl: currentUser.communityProfile?.avatarUrl
          }
        });
      } catch (err) {
        console.error('[WebRTC] Error handling offer:', err);
      }
    };

    // 3. Received Answer -> Set Remote Description
    const handlePeerAnswer = async ({ senderSocketId, answer }) => {
      console.log('[WebRTC] Received answer from:', senderSocketId);
      const pc = peerConnectionsRef.current[senderSocketId];
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          setCallStatus('connected');
        } catch (err) {
          console.error('[WebRTC] Error setting remote description:', err);
        }
      }
    };

    // 4. Received ICE candidate
    const handlePeerIce = async ({ senderSocketId, candidate }) => {
      const pc = peerConnectionsRef.current[senderSocketId];
      if (pc && candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('[WebRTC] Error adding ICE candidate:', err);
        }
      }
    };

    // 5. Remote peer track state changed (mute/unmute, video on/off)
    const handleTrackState = ({ socketId, isAudioMuted, isVideoOff, isScreenSharing }) => {
      setPeers(prev => {
        if (!prev[socketId]) return prev;
        return {
          ...prev,
          [socketId]: {
            ...prev[socketId],
            ...(isAudioMuted !== undefined ? { isAudioMuted } : {}),
            ...(isVideoOff !== undefined ? { isVideoOff } : {}),
            ...(isScreenSharing !== undefined ? { isScreenSharing } : {})
          }
        };
      });
    };

    // 6. User left room
    const handleUserLeft = ({ socketId }) => {
      console.log('[WebRTC] User left room:', socketId);
      removePeer(socketId);
    };

    socket.on('user_joined_call_room', handleUserJoined);
    socket.on('call_peer_offer', handlePeerOffer);
    socket.on('call_peer_answer', handlePeerAnswer);
    socket.on('call_peer_ice', handlePeerIce);
    socket.on('call_peer_track_state', handleTrackState);
    socket.on('user_left_call_room', handleUserLeft);

    return () => {
      socket.off('user_joined_call_room', handleUserJoined);
      socket.off('call_peer_offer', handlePeerOffer);
      socket.off('call_peer_answer', handlePeerAnswer);
      socket.off('call_peer_ice', handlePeerIce);
      socket.off('call_peer_track_state', handleTrackState);
      socket.off('user_left_call_room', handleUserLeft);
    };
  }, [socket, isOpen, currentUser]);

  // Toggle Microphone
  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        const nextState = !audioTrack.enabled;
        setIsMicMuted(nextState);
        socket?.emit('call_peer_track_state', {
          roomId: callRoom?.roomId,
          isAudioMuted: nextState
        });
      }
    }
  };

  // Toggle Video / Camera
  const toggleVideo = async () => {
    if (!localStreamRef.current) return;

    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      const nextState = !videoTrack.enabled;
      setIsVideoOff(nextState);
      socket?.emit('call_peer_track_state', {
        roomId: callRoom?.roomId,
        isVideoOff: nextState
      });
    } else if (isVideoOff) {
      // If started as audio call and enabling camera now
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        const newTrack = stream.getVideoTracks()[0];
        localStreamRef.current.addTrack(newTrack);
        if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
        Object.values(peerConnectionsRef.current).forEach(pc => {
          pc.addTrack(newTrack, localStreamRef.current);
        });
        setIsVideoOff(false);
        socket?.emit('call_peer_track_state', {
          roomId: callRoom?.roomId,
          isVideoOff: false
        });
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Toggle Screen Sharing
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      stopScreenShare();
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' },
          audio: false
        });
        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];

        // Replace outgoing video track on all peer connections
        Object.values(peerConnectionsRef.current).forEach(async pc => {
          const senders = pc.getSenders();
          const videoSender = senders.find(s => s.track && s.track.kind === 'video');
          if (videoSender) {
            videoSender.replaceTrack(screenTrack);
          } else {
            pc.addTrack(screenTrack, screenStream);
            try {
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              const targetSocketId = Object.keys(peerConnectionsRef.current).find(k => peerConnectionsRef.current[k] === pc);
              socket?.emit('call_peer_offer', {
                targetSocketId,
                offer,
                senderInfo: {
                  userId: currentUser._id,
                  fullName: currentUser.communityProfile?.fullName || currentUser.username,
                  avatarUrl: currentUser.communityProfile?.avatarUrl
                }
              });
            } catch (err) {
              console.error('Error renegotiating screen track:', err);
            }
          }
        });

        // Show screen in local preview
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        setIsScreenSharing(true);
        setIsVideoOff(false);
        socket?.emit('call_peer_track_state', {
          roomId: callRoom?.roomId,
          isScreenSharing: true,
          isVideoOff: false
        });

        // Handle user stopping screen share via browser floating bar
        screenTrack.onended = () => {
          stopScreenShare();
        };
      } catch (err) {
        console.log('Screen sharing cancelled or not supported:', err);
      }
    }
  };

  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }

    const cameraTrack = localStreamRef.current?.getVideoTracks()[0];
    const hasActiveCamera = cameraTrack && cameraTrack.enabled;

    if (cameraTrack) {
      Object.values(peerConnectionsRef.current).forEach(pc => {
        const senders = pc.getSenders();
        const videoSender = senders.find(s => s.track && s.track.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(cameraTrack);
        }
      });
      if (localVideoRef.current && localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
    }

    setIsScreenSharing(false);
    setIsVideoOff(!hasActiveCamera);
    socket?.emit('call_peer_track_state', {
      roomId: callRoom?.roomId,
      isScreenSharing: false,
      isVideoOff: !hasActiveCamera
    });
  };

  // Send in-call invite to another person
  const handleInviteUser = (member) => {
    if (!member || !callRoom?.roomId) return;

    socket?.emit('call_room_invite', {
      roomId: callRoom.roomId,
      recipientIds: [member._id],
      callerInfo: {
        userId: currentUser._id,
        fullName: currentUser.communityProfile?.fullName || currentUser.username,
        avatarUrl: currentUser.communityProfile?.avatarUrl
      },
      callType: callRoom.callType
    });

    setInvitedMap(prev => ({ ...prev, [member._id]: true }));
  };

  // Hang up / Leave call
  const handleHangup = () => {
    socket?.emit('leave_call_room', { roomId: callRoom?.roomId });
    cleanUpEverything();
    onClose();
  };

  if (!isOpen) return null;

  const peerList = Object.values(peers);
  const totalCount = peerList.length + 1; // + 1 for local user

  // Format call duration MM:SS
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Filter available members to invite (excluding current user and existing peers)
  const existingUserIds = new Set([
    currentUser._id?.toString(),
    ...peerList.map(p => p.userId?.toString()).filter(Boolean)
  ]);

  const invitableMembers = allMembers.filter(m => 
    !existingUserIds.has(m._id?.toString()) &&
    (m.fullName?.toLowerCase().includes(inviteSearch.toLowerCase()) || 
     m.username?.toLowerCase().includes(inviteSearch.toLowerCase()))
  );

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'radial-gradient(circle at center, #0a0e1e 0%, #030408 100%)',
      zIndex: 99999,
      display: 'flex',
      flexDirection: 'column',
      color: '#fff',
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      {/* --- TOP BAR --- */}
      <div style={{
        padding: '16px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(5, 7, 15, 0.65)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: callStatus === 'connected' ? '#00f2fe' : '#ffd200',
            boxShadow: `0 0 10px ${callStatus === 'connected' ? '#00f2fe' : '#ffd200'}`
          }} />
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
            {callRoom?.callType === 'video' ? 'WebRTC Space Call' : 'Secure Audio Call'}
          </h2>
          <span style={{
            fontSize: '0.8rem',
            padding: '3px 10px',
            borderRadius: '20px',
            background: 'rgba(0, 242, 254, 0.12)',
            color: 'var(--accent-cyan, #00f2fe)',
            border: '1px solid rgba(0, 242, 254, 0.25)',
            fontWeight: 700
          }}>
            {callStatus === 'connected' ? formatDuration(callDuration) : 'Calling / Ringing...'}
          </span>
          <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Users size={14} /> {totalCount} {totalCount === 1 ? 'Participant' : 'Participants'}
          </span>
        </div>

        {/* Invite Button */}
        <button
          onClick={() => setShowInviteModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(255, 255, 255, 0.08)',
            color: '#fff',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            padding: '8px 16px',
            borderRadius: '20px',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 600,
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
        >
          <UserPlus size={16} color="var(--accent-cyan, #00f2fe)" />
          <span>Invite Person</span>
        </button>
      </div>

      {/* --- VIDEO GRID CANVAS --- */}
      <div style={{
        flex: 1,
        position: 'relative',
        padding: '20px',
        overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: totalCount === 1 
          ? '1fr' 
          : totalCount === 2 
            ? '1fr 1fr' 
            : totalCount <= 4 
              ? 'repeat(2, 1fr)' 
              : 'repeat(3, 1fr)',
        gridAutoRows: totalCount <= 2 ? '1fr' : '1fr',
        gap: '16px'
      }}>

        {/* Local Stream Card */}
        <div style={{
          position: 'relative',
          background: '#0d1326',
          borderRadius: '20px',
          overflow: 'hidden',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
        }}>
          {(!isVideoOff || isScreenSharing) ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: isScreenSharing ? 'contain' : 'cover',
                transform: isScreenSharing ? 'none' : 'scaleX(-1)' // Mirror camera
              }}
            />
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '90px',
                height: '90px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
                color: '#000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2.4rem',
                fontWeight: 900,
                margin: '0 auto 12px auto'
              }}>
                {(currentUser.communityProfile?.fullName || currentUser.username || 'Y').charAt(0).toUpperCase()}
              </div>
              <p style={{ fontWeight: 700, margin: 0, fontSize: '1.05rem' }}>You (Camera Off)</p>
            </div>
          )}

          {/* Local Participant Badge */}
          <div style={{
            position: 'absolute',
            bottom: '14px',
            left: '14px',
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(8px)',
            padding: '6px 14px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.85rem',
            fontWeight: 700
          }}>
            <span>You</span>
            {isScreenSharing && (
              <span style={{ color: '#00f2fe', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Monitor size={12} /> Sharing Screen
              </span>
            )}
            {isMicMuted && <MicOff size={14} color="#ff4d4d" />}
          </div>
        </div>

        {/* Remote Peers Cards */}
        {peerList.map(peer => (
          <RemotePeerCard
            key={peer.socketId}
            peer={peer}
            isFullscreen={fullscreenVideoId === peer.socketId}
            onToggleFullscreen={() => {
              setFullscreenVideoId(prev => prev === peer.socketId ? null : peer.socketId);
            }}
          />
        ))}

        {/* Ringing/Waiting Placeholder if alone */}
        {peerList.length === 0 && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            background: 'rgba(7, 10, 20, 0.85)',
            backdropFilter: 'blur(16px)',
            padding: '30px 45px',
            borderRadius: '24px',
            border: '1px solid rgba(0, 242, 254, 0.25)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.6)'
          }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              border: '3px solid rgba(0, 242, 254, 0.3)',
              borderTopColor: '#00f2fe',
              animation: 'spin 1.5s linear infinite',
              margin: '0 auto 16px auto'
            }} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 6px 0' }}>
              Waiting for participants to join...
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', margin: '0 0 16px 0' }}>
              Ringing them now or click Invite to add more people
            </p>
            <button
              onClick={() => setShowInviteModal(true)}
              style={{
                background: 'linear-gradient(135deg, #00f2fe, #4facfe)',
                color: '#000',
                border: 'none',
                padding: '10px 22px',
                borderRadius: '20px',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              + Invite Friends Now
            </button>
          </div>
        )}

      </div>

      {/* --- BOTTOM FLOATING ACTION CONTROLS --- */}
      <div style={{
        padding: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        background: 'rgba(5, 7, 15, 0.85)',
        backdropFilter: 'blur(25px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)'
      }}>

        {/* Mic Toggle */}
        <button
          onClick={toggleMic}
          title={isMicMuted ? 'Unmute Mic' : 'Mute Mic'}
          style={{
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            background: isMicMuted ? '#ff4d4d' : 'rgba(255, 255, 255, 0.1)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: isMicMuted ? '0 0 15px rgba(255,77,77,0.4)' : 'none'
          }}
        >
          {isMicMuted ? <MicOff size={22} /> : <Mic size={22} />}
        </button>

        {/* Video / Camera Toggle */}
        <button
          onClick={toggleVideo}
          title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
          style={{
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            background: isVideoOff ? '#ff4d4d' : 'rgba(255, 255, 255, 0.1)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: isVideoOff ? '0 0 15px rgba(255,77,77,0.4)' : 'none'
          }}
        >
          {isVideoOff ? <VideoOff size={22} /> : <Video size={22} />}
        </button>

        {/* Screen Share Toggle */}
        <button
          onClick={toggleScreenShare}
          title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
          style={{
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            background: isScreenSharing ? '#00f2fe' : 'rgba(255, 255, 255, 0.1)',
            color: isScreenSharing ? '#000' : '#fff',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: isScreenSharing ? '0 0 20px rgba(0,242,254,0.5)' : 'none'
          }}
        >
          {isScreenSharing ? <MonitorOff size={22} /> : <Monitor size={22} />}
        </button>

        {/* Invite Users Button */}
        <button
          onClick={() => setShowInviteModal(true)}
          title="Invite Others to Call"
          style={{
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.1)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          <UserPlus size={22} />
        </button>

        {/* Leave / End Call */}
        <button
          onClick={handleHangup}
          title="End / Leave Call"
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #ff416c, #ff4b2b)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 25px rgba(255, 65, 108, 0.55)',
            transition: 'transform 0.15s ease'
          }}
          onMouseDown={e => e.currentTarget.style.transform = 'scale(0.92)'}
          onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <PhoneOff size={26} />
        </button>

      </div>

      {/* --- IN-CALL INVITE POPUP MODAL --- */}
      {showInviteModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100000
        }}>
          <div style={{
            width: '90%',
            maxWidth: '460px',
            background: '#0d1326',
            borderRadius: '24px',
            border: '1px solid rgba(0, 242, 254, 0.3)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '80vh'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <UserPlus size={20} color="var(--accent-cyan, #00f2fe)" />
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Invite to Call</h3>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Search Input */}
            <div style={{
              position: 'relative',
              marginBottom: '16px'
            }}>
              <Search size={16} color="rgba(255,255,255,0.4)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
              <input
                type="text"
                value={inviteSearch}
                onChange={e => setInviteSearch(e.target.value)}
                placeholder="Search member name..."
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '12px',
                  padding: '10px 12px 10px 38px',
                  color: '#fff',
                  fontSize: '0.9rem',
                  outline: 'none'
                }}
              />
            </div>

            {/* Invitable Members List */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {invitableMembers.length === 0 ? (
                <div style={{ padding: '30px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>
                  No additional members found to invite
                </div>
              ) : (
                invitableMembers.map(member => {
                  const isInvited = invitedMap[member._id];
                  return (
                    <div
                      key={member._id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: '14px',
                        border: '1px solid rgba(255,255,255,0.05)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          background: member.avatarUrl ? `url(${member.avatarUrl}) center/cover` : 'linear-gradient(135deg, #00f2fe, #4facfe)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          color: '#000'
                        }}>
                          {!member.avatarUrl && (member.fullName?.charAt(0) || 'U')}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>
                            {member.fullName || member.username}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', textTransform: 'capitalize' }}>
                            {member.category || 'Member'}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleInviteUser(member)}
                        disabled={isInvited}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '20px',
                          background: isInvited ? 'rgba(56, 239, 125, 0.15)' : 'linear-gradient(135deg, #00f2fe, #4facfe)',
                          color: isInvited ? '#38ef7d' : '#000',
                          border: isInvited ? '1px solid #38ef7d' : 'none',
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          cursor: isInvited ? 'default' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        {isInvited ? (
                          <>
                            <Check size={14} /> Invited
                          </>
                        ) : (
                          'Invite'
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div style={{ marginTop: '16px', textAlign: 'right' }}>
              <button
                onClick={() => setShowInviteModal(false)}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 20px',
                  borderRadius: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global CSS for rotating animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// Sub-component for each Remote Peer Video Card
function RemotePeerCard({ peer, isFullscreen, onToggleFullscreen }) {
  const videoRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && peer.stream) {
      videoRef.current.srcObject = peer.stream;
      videoRef.current.play().catch(e => console.log('Video play error:', e));
    }
    if (audioRef.current && peer.stream) {
      audioRef.current.srcObject = peer.stream;
      audioRef.current.play().catch(e => console.log('Audio play error:', e));
    }
  }, [peer.stream]);

  const name = peer.userInfo?.fullName || 'Remote Participant';
  const initial = name.charAt(0).toUpperCase();
  const shouldShowVideo = Boolean(peer.isScreenSharing || !peer.isVideoOff);

  return (
    <div style={{
      position: 'relative',
      background: '#0d1326',
      borderRadius: '20px',
      overflow: 'hidden',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      ...(isFullscreen ? {
        position: 'fixed',
        inset: '20px',
        zIndex: 100,
        boxShadow: '0 0 60px rgba(0,0,0,0.9)'
      } : {})
    }}>
      {/* Audio element always active so voice is never cut off */}
      <audio ref={audioRef} autoPlay playsInline />

      {/* Video element always mounted */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{
          width: '100%',
          height: '100%',
          objectFit: peer.isScreenSharing ? 'contain' : 'cover',
          display: shouldShowVideo ? 'block' : 'none'
        }}
      />

      {!shouldShowVideo && (
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '90px',
            height: '90px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #7928ca 0%, #ff0080 100%)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2.4rem',
            fontWeight: 900,
            margin: '0 auto 12px auto'
          }}>
            {initial}
          </div>
          <p style={{ fontWeight: 700, margin: 0, fontSize: '1.05rem' }}>{name}</p>
          <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>Camera Off</span>
        </div>
      )}

      {/* Peer Label & Badges */}
      <div style={{
        position: 'absolute',
        bottom: '14px',
        left: '14px',
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(8px)',
        padding: '6px 14px',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '0.85rem',
        fontWeight: 700
      }}>
        <span>{name}</span>
        {peer.isScreenSharing && (
          <span style={{ color: '#00f2fe', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Monitor size={12} /> Presenting Screen
          </span>
        )}
        {peer.isAudioMuted && <MicOff size={14} color="#ff4d4d" />}
      </div>

      {/* Fullscreen Button */}
      <button
        onClick={onToggleFullscreen}
        style={{
          position: 'absolute',
          top: '14px',
          right: '14px',
          background: 'rgba(0,0,0,0.5)',
          color: '#fff',
          border: 'none',
          borderRadius: '50%',
          width: '32px',
          height: '32px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        title="Toggle Fullscreen"
      >
        {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
      </button>
    </div>
  );
}
