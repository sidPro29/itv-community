import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, MicOff, Video, VideoOff, Volume2, ShieldCheck, 
  Settings, Check, X, AlertCircle, Sparkles, RefreshCw
} from 'lucide-react';

export default function DeviceSetupModal({
  isOpen,
  onClose,
  callRoom, // { roomId, callType, recipient, callerInfo, isRejoin, isInitiator }
  currentUser,
  onJoinCall // callback({ selectedAudioId, selectedVideoId, isMicMuted, isVideoOff, stream })
}) {
  const [permissionState, setPermissionState] = useState('prompt'); // 'prompt', 'granted', 'denied'
  const [audioInputDevices, setAudioInputDevices] = useState([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState([]);
  const [videoInputDevices, setVideoInputDevices] = useState([]);
  
  const [selectedAudioInput, setSelectedAudioInput] = useState('');
  const [selectedAudioOutput, setSelectedAudioOutput] = useState('');
  const [selectedVideoInput, setSelectedVideoInput] = useState('');
  
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(callRoom?.callType === 'audio');
  const [audioLevel, setAudioLevel] = useState(0); // 0 to 100 for audio visualizer
  const [isTestingSpeaker, setIsTestingSpeaker] = useState(false);
  const [permissionError, setPermissionError] = useState('');

  const videoPreviewRef = useRef(null);
  const currentStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);

  // Stop all test tracks and audio visualizer
  const cleanupMedia = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try { audioContextRef.current.close(); } catch (e) {}
      audioContextRef.current = null;
    }
    if (currentStreamRef.current) {
      currentStreamRef.current.getTracks().forEach(t => t.stop());
      currentStreamRef.current = null;
    }
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }
  };

  // Enumerate available hardware devices
  const updateDeviceList = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(d => d.kind === 'audioinput');
      const audioOutputs = devices.filter(d => d.kind === 'audiooutput');
      const videoInputs = devices.filter(d => d.kind === 'videoinput');

      setAudioInputDevices(audioInputs);
      setAudioOutputDevices(audioOutputs);
      setVideoInputDevices(videoInputs);

      if (audioInputs.length > 0 && !selectedAudioInput) {
        setSelectedAudioInput(audioInputs[0].deviceId);
      }
      if (audioOutputs.length > 0 && !selectedAudioOutput) {
        setSelectedAudioOutput(audioOutputs[0].deviceId);
      }
      if (videoInputs.length > 0 && !selectedVideoInput) {
        setSelectedVideoInput(videoInputs[0].deviceId);
      } else if (videoInputs.length === 0) {
        setIsVideoOff(true);
      }
    } catch (err) {
      console.warn('Error enumerating devices:', err);
    }
  };

  // Request or update media stream based on selected devices
  const startPreviewStream = async (audioId = selectedAudioInput, videoId = selectedVideoInput, forceVideoOff = isVideoOff) => {
    cleanupMedia();
    setPermissionError('');

    const constraints = {
      audio: audioId ? { deviceId: { ideal: audioId } } : true,
      video: !forceVideoOff ? (videoId ? { deviceId: { ideal: videoId }, width: { ideal: 1280 }, height: { ideal: 720 } } : true) : false
    };

    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err1) {
        // Fallback: If video failed (e.g. no camera attached like Mac monitor), try audio only
        console.warn('Requested constraints failed, trying audio fallback:', err1);
        stream = await navigator.mediaDevices.getUserMedia({
          audio: audioId ? { deviceId: { ideal: audioId } } : true,
          video: false
        });
        setIsVideoOff(true);
      }

      currentStreamRef.current = stream;
      setPermissionState('granted');

      // Video Preview
      if (videoPreviewRef.current && stream.getVideoTracks().length > 0) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play().catch(e => console.log('Preview play error:', e));
      }

      // Live Audio Visualizer setup
      if (stream.getAudioTracks().length > 0) {
        try {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          const ctx = new AudioContextClass();
          audioContextRef.current = ctx;

          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          analyserRef.current = analyser;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateMeter = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const average = sum / dataArray.length;
            setAudioLevel(Math.min(100, Math.round(average * 1.6)));
            animFrameRef.current = requestAnimationFrame(updateMeter);
          };
          updateMeter();
        } catch (audioErr) {
          console.warn('Audio analyser error:', audioErr);
        }
      }

      await updateDeviceList();
    } catch (err) {
      console.error('Failed to get media devices:', err);
      setPermissionState('denied');
      setPermissionError(err.message || 'Permission denied or no microphone found. Please allow microphone in browser settings.');
    }
  };

  useEffect(() => {
    if (isOpen) {
      startPreviewStream(selectedAudioInput, selectedVideoInput, isVideoOff);
    } else {
      cleanupMedia();
    }
    return () => cleanupMedia();
  }, [isOpen]);

  // Play test sound on speaker
  const playSpeakerTest = () => {
    try {
      setIsTestingSpeaker(true);
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
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

  const handleMicToggle = () => {
    if (currentStreamRef.current) {
      const audioTrack = currentStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicMuted(!audioTrack.enabled);
      }
    }
  };

  const handleVideoToggle = () => {
    const nextState = !isVideoOff;
    setIsVideoOff(nextState);
    startPreviewStream(selectedAudioInput, selectedVideoInput, nextState);
  };

  const handleAudioDeviceChange = (e) => {
    const newId = e.target.value;
    setSelectedAudioInput(newId);
    startPreviewStream(newId, selectedVideoInput, isVideoOff);
  };

  const handleVideoDeviceChange = (e) => {
    const newId = e.target.value;
    setSelectedVideoInput(newId);
    startPreviewStream(selectedAudioInput, newId, isVideoOff);
  };

  const handleProceed = () => {
    // Safely transfer the live media stream without letting cleanupMedia kill its tracks
    const streamToTransfer = currentStreamRef.current;
    currentStreamRef.current = null; // Detach so onClose -> cleanupMedia doesn't stop the tracks!

    // Apply initial mute/camera state to tracks
    if (streamToTransfer) {
      if (isMicMuted) {
        streamToTransfer.getAudioTracks().forEach(t => { t.enabled = false; });
      }
      if (isVideoOff) {
        streamToTransfer.getVideoTracks().forEach(t => { t.enabled = false; });
      }
    }

    // Stop audio meter loop & audioContext
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try { audioContextRef.current.close(); } catch (e) {}
      audioContextRef.current = null;
    }
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }

    onJoinCall({
      selectedAudioId: selectedAudioInput,
      selectedVideoId: selectedVideoInput,
      selectedAudioOutput: selectedAudioOutput,
      isMicMuted,
      isVideoOff,
      stream: streamToTransfer
    });

    onClose();
  };

  if (!isOpen) return null;

  const targetName = callRoom?.recipient?.communityProfile?.fullName || 
                     callRoom?.recipient?.username || 
                     callRoom?.callerInfo?.fullName || 
                     'Space Call';

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(3, 7, 18, 0.85)',
      backdropFilter: 'blur(16px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 999999,
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      <div style={{
        width: '92%',
        maxWidth: '560px',
        background: '#0d1326',
        borderRadius: '24px',
        border: '1px solid rgba(0, 242, 254, 0.25)',
        boxShadow: '0 24px 60px rgba(0,0,0,0.85)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        color: '#fff'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(255, 255, 255, 0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #00f2fe, #4facfe)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#000'
            }}>
              <Settings size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Audio & Video Setup</h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>
                {callRoom?.isRejoin ? 'Rejoining live call with' : 'Getting ready to call'} <strong style={{ color: '#00f2fe' }}>{targetName}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={() => { cleanupMedia(); onClose(); }}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '70vh', overflowY: 'auto' }}>
          
          {/* Permission Error Banner */}
          {permissionState === 'denied' && (
            <div style={{
              background: 'rgba(255, 77, 77, 0.15)',
              border: '1px solid rgba(255, 77, 77, 0.4)',
              borderRadius: '14px',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px'
            }}>
              <AlertCircle size={20} color="#ff4d4d" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '0.9rem', color: '#ff6b6b', fontWeight: 700 }}>
                  Permissions Needed
                </h4>
                <p style={{ margin: '0 0 8px 0', fontSize: '0.82rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.4 }}>
                  {permissionError || 'Please allow microphone and camera access in your browser to start or join the call.'}
                </p>
                <button
                  onClick={() => startPreviewStream(selectedAudioInput, selectedVideoInput, isVideoOff)}
                  style={{
                    background: '#ff4d4d',
                    border: 'none',
                    color: '#fff',
                    padding: '6px 14px',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <RefreshCw size={12} /> Try Again
                </button>
              </div>
            </div>
          )}

          {/* Video Preview Box */}
          <div style={{
            position: 'relative',
            width: '100%',
            height: '210px',
            background: '#070b18',
            borderRadius: '18px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'inset 0 0 40px rgba(0,0,0,0.6)'
          }}>
            {/* Video element */}
            <video
              ref={videoPreviewRef}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: (!isVideoOff && videoInputDevices.length > 0) ? 'block' : 'none',
                transform: 'scaleX(-1)' // mirror preview
              }}
            />

            {/* Camera Off / No Camera Avatar */}
            {(isVideoOff || videoInputDevices.length === 0) && (
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: '74px',
                  height: '74px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #00f2fe, #7928ca)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2rem',
                  fontWeight: 900,
                  margin: '0 auto 10px auto',
                  color: '#fff',
                  boxShadow: '0 8px 24px rgba(0, 242, 254, 0.3)'
                }}>
                  {currentUser?.communityProfile?.fullName?.charAt(0).toUpperCase() || currentUser?.username?.charAt(0).toUpperCase() || 'U'}
                </div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem' }}>
                  {videoInputDevices.length === 0 ? 'No Camera Detected (Voice Mode)' : 'Camera is Off'}
                </p>
                <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)' }}>
                  Your voice will still be heard clearly
                </span>
              </div>
            )}

            {/* Quick Toggle Controls on Preview */}
            <div style={{
              position: 'absolute',
              bottom: '12px',
              display: 'flex',
              gap: '10px',
              background: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(10px)',
              padding: '6px 14px',
              borderRadius: '24px',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <button
                onClick={handleMicToggle}
                style={{
                  background: isMicMuted ? '#ff4d4d' : 'rgba(255, 255, 255, 0.12)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '38px',
                  height: '38px',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease'
                }}
                title={isMicMuted ? 'Unmute Mic' : 'Mute Mic'}
              >
                {isMicMuted ? <MicOff size={16} /> : <Mic size={16} />}
              </button>

              <button
                onClick={handleVideoToggle}
                disabled={videoInputDevices.length === 0}
                style={{
                  background: isVideoOff ? '#ff4d4d' : 'rgba(255, 255, 255, 0.12)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '38px',
                  height: '38px',
                  color: '#fff',
                  cursor: videoInputDevices.length === 0 ? 'not-allowed' : 'pointer',
                  opacity: videoInputDevices.length === 0 ? 0.4 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease'
                }}
                title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
              >
                {isVideoOff ? <VideoOff size={16} /> : <Video size={16} />}
              </button>
            </div>
          </div>

          {/* Mic Volume Level Visualizer (Discord style) */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '14px',
            padding: '12px 16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Mic size={14} color="#00f2fe" /> Mic Input Test (Speak to test)
              </span>
              <span style={{ fontSize: '0.75rem', color: isMicMuted ? '#ff6b6b' : (audioLevel > 15 ? '#38ef7d' : 'rgba(255,255,255,0.4)') }}>
                {isMicMuted ? 'Mic Muted' : (audioLevel > 15 ? 'Receiving Voice 🟢' : 'Silent')}
              </span>
            </div>

            {/* Animated Volume Meter Bars */}
            <div style={{ display: 'flex', gap: '4px', height: '14px', alignItems: 'center' }}>
              {Array.from({ length: 24 }).map((_, idx) => {
                const threshold = (idx / 24) * 100;
                const isActive = !isMicMuted && audioLevel > threshold;
                return (
                  <div
                    key={idx}
                    style={{
                      flex: 1,
                      height: isActive ? '100%' : '30%',
                      borderRadius: '3px',
                      background: isActive 
                        ? (idx > 18 ? '#ff4d4d' : idx > 12 ? '#ffb900' : '#00f2fe')
                        : 'rgba(255, 255, 255, 0.1)',
                      transition: 'height 0.08s ease, background 0.08s ease'
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* Device Selection Dropdowns (Discord style) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            
            {/* 1. Microphone Selector */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>
                MICROPHONE
              </label>
              <select
                value={selectedAudioInput}
                onChange={handleAudioDeviceChange}
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
                {audioInputDevices.length === 0 ? (
                  <option value="">Default System Microphone</option>
                ) : (
                  audioInputDevices.map((dev, i) => (
                    <option key={dev.deviceId || i} value={dev.deviceId} style={{ background: '#0d1326', color: '#fff' }}>
                      {dev.label || `Microphone ${i + 1}`}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* 2. Audio Output / Speaker Selector */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>
                  AUDIO OUTPUT (SPEAKER)
                </label>
                <button
                  type="button"
                  onClick={playSpeakerTest}
                  style={{
                    background: 'transparent',
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
                value={selectedAudioOutput}
                onChange={e => setSelectedAudioOutput(e.target.value)}
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
                {audioOutputDevices.length === 0 ? (
                  <option value="">Default System Speaker</option>
                ) : (
                  audioOutputDevices.map((dev, i) => (
                    <option key={dev.deviceId || i} value={dev.deviceId} style={{ background: '#0d1326', color: '#fff' }}>
                      {dev.label || `Speaker ${i + 1}`}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* 3. Camera Selector */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>
                CAMERA
              </label>
              <select
                value={selectedVideoInput}
                onChange={handleVideoDeviceChange}
                disabled={videoInputDevices.length === 0}
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  color: '#fff',
                  fontSize: '0.85rem',
                  outline: 'none',
                  cursor: videoInputDevices.length === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                {videoInputDevices.length === 0 ? (
                  <option value="">No Camera Found (Voice Only)</option>
                ) : (
                  videoInputDevices.map((dev, i) => (
                    <option key={dev.deviceId || i} value={dev.deviceId} style={{ background: '#0d1326', color: '#fff' }}>
                      {dev.label || `Camera ${i + 1}`}
                    </option>
                  ))
                )}
              </select>
            </div>

          </div>

        </div>

        {/* Footer Actions */}
        <div style={{
          padding: '18px 24px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
          background: 'rgba(255, 255, 255, 0.02)'
        }}>
          <button
            type="button"
            onClick={() => { cleanupMedia(); onClose(); }}
            style={{
              padding: '10px 18px',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              background: 'transparent',
              color: 'rgba(255, 255, 255, 0.7)',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleProceed}
            style={{
              padding: '10px 24px',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
              color: '#000',
              fontWeight: 800,
              fontSize: '0.92rem',
              cursor: 'pointer',
              boxShadow: '0 4px 18px rgba(0, 242, 254, 0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'transform 0.15s ease'
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            <Sparkles size={16} /> {callRoom?.isRejoin ? 'Rejoin Call' : 'Join Call'}
          </button>
        </div>

      </div>
    </div>
  );
}
