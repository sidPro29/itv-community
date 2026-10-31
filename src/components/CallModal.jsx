import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, MicOff, Video, VideoOff, PhoneOff, Monitor, MonitorOff, 
  UserPlus, Users, Volume2, ShieldCheck, Maximize2, Minimize2,
  Search, Check, X, Settings
} from 'lucide-react';
import { ringback } from '../utils/soundEffects';
import { RTC_CONFIG } from '../utils/webrtcConfig';

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
  const [showInCallSettings, setShowInCallSettings] = useState(false);
  const [availableAudioDevices, setAvailableAudioDevices] = useState([]);
  const [availableVideoDevices, setAvailableVideoDevices] = useState([]);
  const [availableOutputDevices, setAvailableOutputDevices] = useState([]);
  const [activeAudioInput, setActiveAudioInput] = useState('');
  const [activeVideoInput, setActiveVideoInput] = useState('');
  const [activeAudioOutput, setActiveAudioOutput] = useState(callRoom?.selectedAudioOutput || '');
  const [isTestingSpeaker, setIsTestingSpeaker] = useState(false);

  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const peerConnectionsRef = useRef({}); // socketId -> RTCPeerConnection
  const iceCandidateQueues = useRef({}); // socketId -> Array of queued ICE candidates
  const timerRef = useRef(null);

  // Initialize Local Media & Room on Open
  useEffect(() => {
    if (!isOpen || !callRoom?.roomId) return;

    let mounted = true;

    async function initMedia() {
      let stream = callRoom?.initialStream || null;

      // Ensure stream has live tracks, otherwise acquire fresh media devices
      const isStreamLive = Boolean(
        stream && 
        stream.getTracks().length > 0 && 
        stream.getTracks().some(t => t.readyState === 'live')
      );

      if (!isStreamLive) {
        if (stream) {
          try { stream.getTracks().forEach(t => t.stop()); } catch (e) {}
        }

        const audioConstraints = callRoom?.selectedAudioId ? { deviceId: { ideal: callRoom.selectedAudioId } } : true;
        const videoConstraints = callRoom?.selectedVideoId ? { deviceId: { ideal: callRoom.selectedVideoId } } : true;

        if (callRoom?.callType === 'video' && !callRoom?.initialVideoOff) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints, video: videoConstraints });
          } catch (err1) {
            console.warn('Audio+Video failed, trying audio only:', err1);
            try {
              stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints, video: false });
              setIsVideoOff(true);
            } catch (err2) {
              console.warn('Audio failed, trying video only:', err2);
              try {
                stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: videoConstraints });
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
            stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints, video: false });
          } catch (errAudio) {
            console.warn('Audio stream acquisition failed:', errAudio);
            stream = new MediaStream();
            setIsMicMuted(true);
          }
        }
      }

      if (!mounted) {
        if (stream) stream.getTracks().forEach(t => t.stop());
        return;
      }

      localStreamRef.current = stream;
      setLocalStream(stream);

      const hasVideo = stream.getVideoTracks().length > 0;
      const initialVideoOff = callRoom?.initialVideoOff !== undefined ? callRoom.initialVideoOff : (!hasVideo || callRoom?.callType === 'audio');
      setIsVideoOff(initialVideoOff);

      const initialMicMuted = callRoom?.initialMicMuted !== undefined ? callRoom.initialMicMuted : false;
      setIsMicMuted(initialMicMuted);
      if (initialMicMuted && stream.getAudioTracks()[0]) {
        stream.getAudioTracks()[0].enabled = false;
      }

      if (localVideoRef.current && hasVideo && !initialVideoOff) {
        localVideoRef.current.srcObject = stream;
      }

      // Join room on Socket.IO
      socket?.emit('join_call_room', {
        roomId: callRoom.roomId,
        userInfo: {
          userId: currentUser._id,
          fullName: currentUser.communityProfile?.fullName || currentUser.username,
          avatarUrl: currentUser.communityProfile?.avatarUrl,
          category: currentUser.communityProfile?.category,
          isVideoOff: initialVideoOff,
          isAudioMuted: initialMicMuted
        }
      });

      setCallStatus(callRoom.isInitiator && !callRoom.isRejoin ? 'ringing' : 'connected');
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

  // Keep local video element in sync with active camera or screen stream
  useEffect(() => {
    if (localVideoRef.current) {
      if (isScreenSharing && screenStreamRef.current) {
        localVideoRef.current.srcObject = screenStreamRef.current;
        localVideoRef.current.play().catch(() => {});
      } else if (localStreamRef.current && !isVideoOff) {
        localVideoRef.current.srcObject = localStreamRef.current;
        localVideoRef.current.play().catch(() => {});
      }
    }
  }, [localStream, isVideoOff, isScreenSharing]);

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
    // Immediately register peer in UI state so the participant card appears instantly
    setPeers(prev => ({
      ...prev,
      [targetSocketId]: {
        socketId: targetSocketId,
        userId: targetUserInfo?.userId,
        userInfo: targetUserInfo || prev[targetSocketId]?.userInfo,
        stream: prev[targetSocketId]?.stream || null,
        isAudioMuted: prev[targetSocketId]?.isAudioMuted || false,
        isVideoOff: prev[targetSocketId]?.isVideoOff || false,
        isScreenSharing: prev[targetSocketId]?.isScreenSharing || false
      }
    }));
    setCallStatus('connected');

    if (peerConnectionsRef.current[targetSocketId]) {
      return peerConnectionsRef.current[targetSocketId];
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    peerConnectionsRef.current[targetSocketId] = pc;

    // Add local media tracks
    const addedTracks = new Set();

    // 1. Audio track
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks().find(t => t.readyState === 'live');
      if (audioTrack) {
        try {
          pc.addTrack(audioTrack, localStreamRef.current);
          addedTracks.add('audio');
        } catch (e) {
          console.warn('add audio track error:', e);
        }
      }
    }

    // 2. Video track: If sharing screen, send the active screen track! Otherwise send live camera track
    let outgoingVideoTrack = null;
    let outgoingVideoStream = null;

    if (isScreenSharing && screenStreamRef.current) {
      outgoingVideoTrack = screenStreamRef.current.getVideoTracks().find(t => t.readyState === 'live');
      outgoingVideoStream = screenStreamRef.current;
    } else if (localStreamRef.current && !isVideoOff) {
      outgoingVideoTrack = localStreamRef.current.getVideoTracks().find(t => t.readyState === 'live');
      outgoingVideoStream = localStreamRef.current;
    }

    if (outgoingVideoTrack && outgoingVideoStream) {
      try {
        pc.addTrack(outgoingVideoTrack, outgoingVideoStream);
        addedTracks.add('video');
      } catch (e) {
        console.warn('add video track error:', e);
      }
    }

    // Ensure audio and video transceivers exist in sendrecv mode
    // Allows receiving remote video/audio even if local device starts without webcam,
    // and instantly sending video/audio when toggled on without SDP renegotiation failures
    if (!addedTracks.has('audio')) {
      try { pc.addTransceiver('audio', { direction: 'sendrecv' }); } catch (e) {}
    }
    if (!addedTracks.has('video')) {
      try { pc.addTransceiver('video', { direction: 'sendrecv' }); } catch (e) {}
    }

    // Handle incoming remote stream tracks
    pc.ontrack = (event) => {
      console.log('[WebRTC] ontrack received:', event.track.kind, event.streams);

      const updatePeerStream = () => {
        setPeers(prev => {
          const existing = prev[targetSocketId];
          const prevStream = existing?.stream;
          let combinedTracks = [];

          if (prevStream) {
            combinedTracks = [...prevStream.getTracks()];
          }
          if (event.streams && event.streams[0]) {
            event.streams[0].getTracks().forEach(t => {
              if (!combinedTracks.some(ct => ct.id === t.id)) {
                combinedTracks.push(t);
              }
            });
          } else if (event.track) {
            if (!combinedTracks.some(ct => ct.id === event.track.id)) {
              combinedTracks.push(event.track);
            }
          }

          return {
            ...prev,
            [targetSocketId]: {
              ...existing,
              stream: new MediaStream(combinedTracks)
            }
          };
        });
        setCallStatus('connected');
      };

      updatePeerStream();

      // Listen for unmuting when media packets actually start flowing over UDP
      event.track.onunmute = () => {
        console.log('[WebRTC] Track unmuted:', event.track.kind);
        updatePeerStream();
      };
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
    delete iceCandidateQueues.current[targetSocketId];
    setPeers(prev => {
      const updated = { ...prev };
      delete updated[targetSocketId];
      return updated;
    });
  };

  // Listen to Socket events for WebRTC signaling
  useEffect(() => {
    if (!socket || !isOpen) return;

    // 0. Existing room peers upon joining -> Immediately display their cards & prepare WebRTC
    const handleExistingPeers = ({ peers: existingList }) => {
      console.log('[WebRTC] Received existing room peers:', existingList);
      if (!Array.isArray(existingList)) return;
      existingList.forEach(p => {
        if (p.socketId && p.socketId !== socket.id) {
          createPeer(p.socketId, p);
        }
      });
      setCallStatus('connected');
    };

    // 1. Another user joined room -> Existing participants initiate offer
    const handleUserJoined = async ({ socketId, userId, userInfo }) => {
      console.log('[WebRTC] User joined call room:', userInfo?.fullName, socketId);
      if (socketId === socket.id) return;

      const pc = createPeer(socketId, userInfo);
      try {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        });
        await pc.setLocalDescription(offer);

        socket.emit('call_peer_offer', {
          targetSocketId: socketId,
          offer,
          senderInfo: {
            userId: currentUser._id,
            fullName: currentUser.communityProfile?.fullName || currentUser.username,
            avatarUrl: currentUser.communityProfile?.avatarUrl,
            isVideoOff: isScreenSharing ? false : isVideoOff,
            isAudioMuted: isMicMuted,
            isScreenSharing: isScreenSharing
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
        
        // Flush any queued ICE candidates
        const queue = iceCandidateQueues.current[senderSocketId] || [];
        while (queue.length > 0) {
          const cand = queue.shift();
          try { await pc.addIceCandidate(new RTCIceCandidate(cand)); } catch (e) {}
        }

        const answer = await pc.createAnswer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        });
        await pc.setLocalDescription(answer);

        socket.emit('call_peer_answer', {
          targetSocketId: senderSocketId,
          answer,
          senderInfo: {
            userId: currentUser._id,
            fullName: currentUser.communityProfile?.fullName || currentUser.username,
            avatarUrl: currentUser.communityProfile?.avatarUrl,
            isVideoOff: isScreenSharing ? false : isVideoOff,
            isAudioMuted: isMicMuted,
            isScreenSharing: isScreenSharing
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
          
          // Flush any queued ICE candidates
          const queue = iceCandidateQueues.current[senderSocketId] || [];
          while (queue.length > 0) {
            const cand = queue.shift();
            try { await pc.addIceCandidate(new RTCIceCandidate(cand)); } catch (e) {}
          }

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
          if (pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } else {
            if (!iceCandidateQueues.current[senderSocketId]) {
              iceCandidateQueues.current[senderSocketId] = [];
            }
            iceCandidateQueues.current[senderSocketId].push(candidate);
          }
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
            ...(isVideoOff !== undefined ? { isVideoOff: isScreenSharing ? false : isVideoOff } : {}),
            ...(isScreenSharing !== undefined ? { isScreenSharing, isVideoOff: isScreenSharing ? false : prev[socketId]?.isVideoOff } : {})
          }
        };
      });
    };

    // 6. User left room
    const handleUserLeft = ({ socketId }) => {
      console.log('[WebRTC] User left room:', socketId);
      removePeer(socketId);
    };

    socket.on('call_room_existing_peers', handleExistingPeers);
    socket.on('user_joined_call_room', handleUserJoined);
    socket.on('call_peer_offer', handlePeerOffer);
    socket.on('call_peer_answer', handlePeerAnswer);
    socket.on('call_peer_ice', handlePeerIce);
    socket.on('call_peer_track_state', handleTrackState);
    socket.on('user_left_call_room', handleUserLeft);

    return () => {
      socket.off('call_room_existing_peers', handleExistingPeers);
      socket.off('user_joined_call_room', handleUserJoined);
      socket.off('call_peer_offer', handlePeerOffer);
      socket.off('call_peer_answer', handlePeerAnswer);
      socket.off('call_peer_ice', handlePeerIce);
      socket.off('call_peer_track_state', handleTrackState);
      socket.off('user_left_call_room', handleUserLeft);
    };
  }, [socket, isOpen, currentUser]);

  // Toggle Microphone
  const toggleMic = async () => {
    if (!localStreamRef.current) {
      localStreamRef.current = new MediaStream();
    }

    let audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack && audioTrack.readyState === 'live') {
      audioTrack.enabled = !audioTrack.enabled;
      const nextState = !audioTrack.enabled;
      setIsMicMuted(nextState);
      socket?.emit('call_peer_track_state', {
        roomId: callRoom?.roomId,
        isAudioMuted: nextState
      });
    } else {
      // Re-acquire mic if not present or track ended
      try {
        const audioConstraints = callRoom?.selectedAudioId ? { deviceId: { ideal: callRoom.selectedAudioId } } : true;
        const freshStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints, video: false });
        const newAudioTrack = freshStream.getAudioTracks()[0];
        if (newAudioTrack) {
          localStreamRef.current.getAudioTracks().forEach(t => {
            localStreamRef.current.removeTrack(t);
            try { t.stop(); } catch (e) {}
          });
          localStreamRef.current.addTrack(newAudioTrack);

          Object.values(peerConnectionsRef.current).forEach(async (pc) => {
            const senders = pc.getSenders();
            const audioSender = senders.find(s => s.track?.kind === 'audio' || (!s.track && (s.dtlsTransport || true)));
            if (audioSender) {
              try { await audioSender.replaceTrack(newAudioTrack); } catch (e) {}
            } else {
              try { pc.addTrack(newAudioTrack, localStreamRef.current); } catch (e) {}
            }
          });

          setIsMicMuted(false);
          setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
          socket?.emit('call_peer_track_state', {
            roomId: callRoom?.roomId,
            isAudioMuted: false
          });
        }
      } catch (err) {
        console.error('Failed to acquire mic:', err);
      }
    }
  };

  // Toggle Video / Camera
  const toggleVideo = async () => {
    if (!localStreamRef.current) {
      localStreamRef.current = new MediaStream();
    }

    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (videoTrack && videoTrack.readyState === 'live') {
      videoTrack.enabled = !videoTrack.enabled;
      const nextState = !videoTrack.enabled;
      setIsVideoOff(nextState);
      socket?.emit('call_peer_track_state', {
        roomId: callRoom?.roomId,
        isVideoOff: nextState
      });
    } else {
      // Acquire camera stream if track missing or ended
      try {
        const videoConstraints = callRoom?.selectedVideoId ? { deviceId: { ideal: callRoom.selectedVideoId } } : true;
        const freshStream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
        const newTrack = freshStream.getVideoTracks()[0];
        if (newTrack) {
          localStreamRef.current.getVideoTracks().forEach(t => {
            localStreamRef.current.removeTrack(t);
            try { t.stop(); } catch (e) {}
          });
          localStreamRef.current.addTrack(newTrack);

          Object.values(peerConnectionsRef.current).forEach(async (pc) => {
            const senders = pc.getSenders();
            const videoSender = senders.find(s => s.track?.kind === 'video' || (!s.track && (s.dtlsTransport || true)));
            if (videoSender) {
              try {
                await videoSender.replaceTrack(newTrack);
              } catch (e) {
                console.warn('replaceTrack error, addTrack fallback:', e);
                try { pc.addTrack(newTrack, localStreamRef.current); } catch (err2) {}
              }
            } else {
              try { pc.addTrack(newTrack, localStreamRef.current); } catch (err3) {}
            }
          });

          setIsVideoOff(false);
          setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
          socket?.emit('call_peer_track_state', {
            roomId: callRoom?.roomId,
            isVideoOff: false
          });
        }
      } catch (e) {
        console.error('Failed to acquire camera:', e);
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
          const videoSender = senders.find(s => s.track?.kind === 'video' || (!s.track && (s.dtlsTransport || true)));
          if (videoSender) {
            try {
              await videoSender.replaceTrack(screenTrack);
            } catch (e) {
              console.warn('replaceTrack failed for screen share:', e);
              try { pc.addTrack(screenTrack, screenStream); } catch (err2) {}
            }
          } else {
            try { pc.addTrack(screenTrack, screenStream); } catch (err3) {}
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

    const cameraTrack = (localStreamRef.current && !isVideoOff) ? localStreamRef.current.getVideoTracks().find(t => t.readyState === 'live') : null;

    Object.values(peerConnectionsRef.current).forEach(async pc => {
      const senders = pc.getSenders();
      const videoSender = senders.find(s => s.track?.kind === 'video' || (!s.track && (s.dtlsTransport || true)));
      if (videoSender) {
        try {
          await videoSender.replaceTrack(cameraTrack || null);
        } catch (e) {
          console.warn('Error reverting video track after screen share:', e);
        }
      }
    });

    setIsScreenSharing(false);
    setIsVideoOff(!cameraTrack);
    socket?.emit('call_peer_track_state', {
      roomId: callRoom?.roomId,
      isScreenSharing: false,
      isVideoOff: !cameraTrack
    });
  };

  // Switch microphone mid-call
  const switchAudioInput = async (deviceId) => {
    setActiveAudioInput(deviceId);
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } }
      });
      const newTrack = newStream.getAudioTracks()[0];
      if (localStreamRef.current) {
        const oldTrack = localStreamRef.current.getAudioTracks()[0];
        if (oldTrack) {
          localStreamRef.current.removeTrack(oldTrack);
          oldTrack.stop();
        }
        localStreamRef.current.addTrack(newTrack);
        newTrack.enabled = !isMicMuted;
      }
      Object.values(peerConnectionsRef.current).forEach(pc => {
        const senders = pc.getSenders();
        const audioSender = senders.find(s => s.track && s.track.kind === 'audio');
        if (audioSender) {
          audioSender.replaceTrack(newTrack);
        }
      });
    } catch (e) {
      console.warn('Error switching mic:', e);
    }
  };

  // Switch camera mid-call
  const switchVideoInput = async (deviceId) => {
    setActiveVideoInput(deviceId);
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } }
      });
      const newTrack = newStream.getVideoTracks()[0];
      if (localStreamRef.current) {
        const oldTrack = localStreamRef.current.getVideoTracks()[0];
        if (oldTrack) {
          localStreamRef.current.removeTrack(oldTrack);
          oldTrack.stop();
        }
        localStreamRef.current.addTrack(newTrack);
        newTrack.enabled = !isVideoOff;
      }
      if (localVideoRef.current && localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      Object.values(peerConnectionsRef.current).forEach(pc => {
        const senders = pc.getSenders();
        const videoSender = senders.find(s => s.track && s.track.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(newTrack);
        }
      });
    } catch (e) {
      console.warn('Error switching camera:', e);
    }
  };

  // Switch speaker/audio output mid-call
  const switchAudioOutput = async (deviceId) => {
    setActiveAudioOutput(deviceId);
    document.querySelectorAll('audio').forEach(audioEl => {
      if (typeof audioEl.setSinkId === 'function') {
        audioEl.setSinkId(deviceId).catch(e => console.warn('audio setSinkId error:', e));
      }
    });
  };

  // Play test chime on speaker
  const playSpeakerTest = () => {
    try {
      setIsTestingSpeaker(true);
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      if (typeof ctx.setSinkId === 'function' && activeAudioOutput) {
        ctx.setSinkId(activeAudioOutput).catch(console.warn);
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5

      gain.gain.setValueAtTime(0.01, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.45);

      setTimeout(() => {
        setIsTestingSpeaker(false);
        try { ctx.close(); } catch (e) {}
      }, 500);
    } catch (e) {
      setIsTestingSpeaker(false);
    }
  };

  useEffect(() => {
    if (showInCallSettings) {
      navigator.mediaDevices.enumerateDevices().then(devices => {
        setAvailableAudioDevices(devices.filter(d => d.kind === 'audioinput'));
        setAvailableVideoDevices(devices.filter(d => d.kind === 'videoinput'));
        const outputDevs = devices.filter(d => d.kind === 'audiooutput');
        setAvailableOutputDevices(outputDevs);
        if (outputDevs.length > 0 && !activeAudioOutput) {
          setActiveAudioOutput(outputDevs[0].deviceId);
        }
      }).catch(console.warn);
    }
  }, [showInCallSettings]);

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

    setInvitedMap(prev => ({ ...prev, [member._id]: 'calling' }));
    setTimeout(() => {
      setInvitedMap(prev => ({ ...prev, [member._id]: 'invited' }));
    }, 2500);
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
            {callRoom?.title || (callRoom?.callType === 'video' ? 'WebRTC Space Call' : 'Secure Audio Call')}
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
            audioOutputDeviceId={activeAudioOutput}
            isFullscreen={fullscreenVideoId === peer.socketId}
            onToggleFullscreen={() => {
              setFullscreenVideoId(prev => prev === peer.socketId ? null : peer.socketId);
            }}
          />
        ))}

        {/* Slack-style Non-Intrusive Status Banner when alone in room */}
        {peerList.length === 0 && (
          <div style={{
            position: 'absolute',
            top: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 30,
            background: 'rgba(13, 19, 38, 0.88)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(0, 242, 254, 0.35)',
            borderRadius: '30px',
            padding: '10px 22px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            color: '#fff',
            pointerEvents: 'auto'
          }}>
            <div style={{
              width: '9px',
              height: '9px',
              borderRadius: '50%',
              background: '#38ef7d',
              boxShadow: '0 0 10px #38ef7d'
            }} />
            <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>
              {callStatus === 'ringing' 
                ? 'Ringing participant... Call room is active.' 
                : "You're the only one here • Room remains open so others can rejoin anytime"}
            </span>
            <button
              onClick={() => setShowInviteModal(true)}
              style={{
                background: 'linear-gradient(135deg, #00f2fe, #4facfe)',
                color: '#000',
                border: 'none',
                padding: '5px 14px',
                borderRadius: '16px',
                fontSize: '0.78rem',
                fontWeight: 800,
                cursor: 'pointer',
                marginLeft: '6px'
              }}
            >
              + Invite
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

        {/* Device Settings Button */}
        <button
          onClick={() => setShowInCallSettings(true)}
          title="Audio & Video Settings"
          style={{
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            background: showInCallSettings ? 'rgba(0, 242, 254, 0.25)' : 'rgba(255, 255, 255, 0.1)',
            color: showInCallSettings ? '#00f2fe' : '#fff',
            border: showInCallSettings ? '1px solid #00f2fe' : 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          <Settings size={22} />
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
                        style={{
                          padding: '6px 14px',
                          borderRadius: '20px',
                          background: invitedMap[member._id] === 'calling'
                            ? 'rgba(0, 242, 254, 0.25)'
                            : invitedMap[member._id] === 'invited'
                              ? 'rgba(56, 239, 125, 0.2)'
                              : 'linear-gradient(135deg, #00f2fe, #4facfe)',
                          color: invitedMap[member._id] === 'calling' ? '#00f2fe' : invitedMap[member._id] === 'invited' ? '#38ef7d' : '#000',
                          border: invitedMap[member._id] === 'calling'
                            ? '1px solid #00f2fe'
                            : invitedMap[member._id] === 'invited'
                              ? '1px solid #38ef7d'
                              : 'none',
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 10px rgba(0, 242, 254, 0.2)'
                        }}
                      >
                        {invitedMap[member._id] === 'calling' ? (
                          <>Ringing...</>
                        ) : invitedMap[member._id] === 'invited' ? (
                          <>
                            <Check size={14} /> Ring Again
                          </>
                        ) : (
                          '+ Invite'
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

      {/* --- IN-CALL DEVICE SETTINGS MODAL --- */}
      {showInCallSettings && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(3, 7, 18, 0.75)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999,
          fontFamily: 'Inter, system-ui, sans-serif'
        }}>
          <div style={{
            width: '90%',
            maxWidth: '460px',
            background: '#0d1326',
            borderRadius: '20px',
            border: '1px solid rgba(0, 242, 254, 0.3)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.85)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            color: '#fff'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Settings size={18} color="#00f2fe" /> Call Device Settings
              </h3>
              <button
                onClick={() => setShowInCallSettings(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '30px',
                  height: '30px',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={15} />
              </button>
            </div>

            {/* Microphone Dropdown */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>
                MICROPHONE (INPUT)
              </label>
              <select
                value={activeAudioInput}
                onChange={e => switchAudioInput(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '10px',
                  padding: '9px 12px',
                  color: '#fff',
                  fontSize: '0.85rem',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                {availableAudioDevices.length === 0 ? (
                  <option value="">Default Microphone</option>
                ) : (
                  availableAudioDevices.map((d, i) => (
                    <option key={d.deviceId || i} value={d.deviceId} style={{ background: '#0d1326', color: '#fff' }}>
                      {d.label || `Microphone ${i + 1}`}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Speaker (Audio Output) Dropdown */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>
                  AUDIO OUTPUT (SPEAKER)
                </label>
                <button
                  type="button"
                  onClick={playSpeakerTest}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#00f2fe',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: 0
                  }}
                >
                  <Volume2 size={13} /> {isTestingSpeaker ? 'Playing Sound...' : 'Test Speaker'}
                </button>
              </div>
              <select
                value={activeAudioOutput}
                onChange={e => switchAudioOutput(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '10px',
                  padding: '9px 12px',
                  color: '#fff',
                  fontSize: '0.85rem',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                {availableOutputDevices.length === 0 ? (
                  <option value="">Default System Speaker</option>
                ) : (
                  availableOutputDevices.map((d, i) => (
                    <option key={d.deviceId || i} value={d.deviceId} style={{ background: '#0d1326', color: '#fff' }}>
                      {d.label || `Speaker ${i + 1}`}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Camera Dropdown */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>
                CAMERA (VIDEO)
              </label>
              <select
                value={activeVideoInput}
                onChange={e => switchVideoInput(e.target.value)}
                disabled={availableVideoDevices.length === 0}
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '10px',
                  padding: '9px 12px',
                  color: '#fff',
                  fontSize: '0.85rem',
                  outline: 'none',
                  cursor: availableVideoDevices.length === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                {availableVideoDevices.length === 0 ? (
                  <option value="">No Camera Found (Voice Only)</option>
                ) : (
                  availableVideoDevices.map((d, i) => (
                    <option key={d.deviceId || i} value={d.deviceId} style={{ background: '#0d1326', color: '#fff' }}>
                      {d.label || `Camera ${i + 1}`}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
              <button
                onClick={() => setShowInCallSettings(false)}
                style={{
                  background: 'linear-gradient(135deg, #00f2fe, #4facfe)',
                  color: '#000',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  padding: '9px 20px',
                  borderRadius: '10px',
                  border: 'none',
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
function RemotePeerCard({ peer, isFullscreen, onToggleFullscreen, audioOutputDeviceId }) {
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);

  // Apply audio output sink id whenever audioOutputDeviceId updates
  useEffect(() => {
    if (audioRef.current && typeof audioRef.current.setSinkId === 'function' && audioOutputDeviceId) {
      audioRef.current.setSinkId(audioOutputDeviceId).catch(e => console.warn('Remote peer setSinkId error:', e));
    }
  }, [audioOutputDeviceId, peer.stream]);

  // Attach and play audio & video whenever stream or its tracks update
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!peer.stream) return;

    const attachMedia = () => {
      if (video && video.srcObject !== peer.stream) {
        video.srcObject = peer.stream;
      }
      if (video) {
        video.play().catch(e => console.log('Video play handled:', e));
      }
      if (audio && audio.srcObject !== peer.stream) {
        audio.srcObject = peer.stream;
      }
      if (audio) {
        if (typeof audio.setSinkId === 'function' && audioOutputDeviceId) {
          audio.setSinkId(audioOutputDeviceId).catch(e => console.warn('Remote peer attach setSinkId error:', e));
        }
        audio.play().catch(e => console.log('Audio play handled:', e));
      }
    };

    attachMedia();
    peer.stream.addEventListener('addtrack', attachMedia);
    peer.stream.addEventListener('removetrack', attachMedia);

    return () => {
      peer.stream?.removeEventListener('addtrack', attachMedia);
      peer.stream?.removeEventListener('removetrack', attachMedia);
    };
  }, [peer.stream]);

  // Speaking / Voice Activity Detection (Web Audio API)
  useEffect(() => {
    if (!peer.stream || peer.stream.getAudioTracks().length === 0) return;
    let ctx;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(peer.stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const checkVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;
        setIsSpeaking(avg > 14);
        animFrameRef.current = requestAnimationFrame(checkVolume);
      };
      checkVolume();
    } catch (e) {
      console.warn('Speaking detector error:', e);
    }

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (ctx && ctx.state !== 'closed') {
        try { ctx.close(); } catch (e) {}
      }
    };
  }, [peer.stream]);

  const name = peer.userInfo?.fullName || 'Remote Participant';
  const initial = name.charAt(0).toUpperCase();

  // Check if peer has a live video track
  const hasLiveVideo = Boolean(
    peer.stream && 
    peer.stream.getVideoTracks().length > 0 && 
    peer.stream.getVideoTracks().some(t => t.readyState === 'live')
  );

  const shouldShowVideo = Boolean(peer.isScreenSharing || (!peer.isVideoOff && hasLiveVideo));

  // Trigger video play whenever shouldShowVideo becomes true
  useEffect(() => {
    if (shouldShowVideo && videoRef.current) {
      videoRef.current.play().catch(e => console.log('Video play error handled:', e));
    }
  }, [shouldShowVideo]);

  return (
    <div style={{
      position: 'relative',
      background: '#0d1326',
      borderRadius: '20px',
      overflow: 'hidden',
      border: isSpeaking ? '2px solid #00f2fe' : '1px solid rgba(255, 255, 255, 0.1)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: isSpeaking ? '0 0 35px rgba(0, 242, 254, 0.45)' : '0 8px 32px rgba(0,0,0,0.4)',
      transition: 'border 0.15s ease, box-shadow 0.15s ease',
      ...(isFullscreen ? {
        position: 'fixed',
        inset: '20px',
        zIndex: 100,
        boxShadow: '0 0 60px rgba(0,0,0,0.9)'
      } : {})
    }}>
      {/* Audio element always active so voice is never cut off */}
      <audio ref={audioRef} autoPlay playsInline />

      {/* Video element always mounted, MUTED to prevent browser autoplay blocks & audio loop */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        onLoadedMetadata={() => {
          videoRef.current?.play().catch(e => console.log('Video play metadata handled:', e));
        }}
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
            background: isSpeaking ? 'linear-gradient(135deg, #00f2fe 0%, #7928ca 100%)' : 'linear-gradient(135deg, #7928ca 0%, #ff0080 100%)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2.4rem',
            fontWeight: 900,
            margin: '0 auto 12px auto',
            boxShadow: isSpeaking ? '0 0 25px rgba(0, 242, 254, 0.6)' : 'none',
            transition: 'all 0.2s ease'
          }}>
            {initial}
          </div>
          <p style={{ fontWeight: 700, margin: 0, fontSize: '1.05rem' }}>{name}</p>
          <span style={{ fontSize: '0.8rem', color: isSpeaking ? '#00f2fe' : 'rgba(255,255,255,0.5)' }}>
            {isSpeaking ? 'Speaking...' : (peer.isVideoOff ? 'Camera Off' : 'Connecting Video...')}
          </span>
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
        {isSpeaking && (
          <span style={{ color: '#00f2fe', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Volume2 size={12} /> Speaking
          </span>
        )}
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
