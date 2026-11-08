import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { 
  MessageSquare, 
  X, 
  Send, 
  Headphones, 
  Radio, 
  RotateCcw,
  Sparkles
} from 'lucide-react';
import './SupportChatWidget.css';

const API_BASE = import.meta.env.VITE_API_URL 
  ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '') 
  : 'https://api.interplanetary.tv';

const SOCKET_URL = API_BASE;
const API_URL = `${API_BASE}/api`;

export default function SupportChatWidget({ platform = 'web' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      sender: 'support',
      senderName: 'iTV Support',
      text: '👋 Welcome to Interplanetary Support! Send us your message or question here — our team is synced via Telegram and will reply in real time.',
      timestamp: new Date().toISOString()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [ticket, setTicket] = useState(null);
  
  // Guest details state
  const [guestName, setGuestName] = useState(localStorage.getItem('itv_support_guest_name') || '');
  const [guestEmail, setGuestEmail] = useState(localStorage.getItem('itv_support_guest_email') || '');
  const [showIdentityInputs, setShowIdentityInputs] = useState(false);

  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);

  // Play gentle notification chime
  const playChime = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } catch (e) {}
  };

  // Get or initialize guest session ID
  const getGuestSessionId = () => {
    let sid = localStorage.getItem('itv_guest_session_id');
    if (!sid) {
      sid = 'guest_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
      localStorage.setItem('itv_guest_session_id', sid);
    }
    return sid;
  };

  // Load existing ticket from local storage or backend
  useEffect(() => {
    const savedTicket = localStorage.getItem('itv_active_ticket');
    if (savedTicket) {
      try {
        const parsed = JSON.parse(savedTicket);
        setTicket(parsed);
        if (parsed.messages && parsed.messages.length > 0) {
          setMessages(parsed.messages);
        }
      } catch (e) {}
    }

    // Try fetching active ticket from backend
    const checkActiveTicket = async () => {
      try {
        const token = localStorage.getItem('token');
        const sid = getGuestSessionId();
        const headers = {};
        if (token) headers['x-auth-token'] = token;

        const res = await fetch(`${API_URL}/support/my-active?guestSessionId=${sid}`, { headers });
        if (res.ok) {
          const data = await res.json();
          if (data && data.ticket) {
            setTicket(data.ticket);
            if (data.ticket.messages && data.ticket.messages.length > 0) {
              setMessages(data.ticket.messages);
              localStorage.setItem('itv_active_ticket', JSON.stringify(data.ticket));
            }
          }
        }
      } catch (err) {
        // Silently catch
      }
    };

    checkActiveTicket();
  }, []);

  // Setup Socket.io connection
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      if (ticket?._id) {
        socket.emit('join_support_ticket', { ticketId: ticket._id });
      }
      const sid = getGuestSessionId();
      socket.emit('join_support_ticket', { guestSessionId: sid });
    });

    socket.on('support_reply', (payload) => {
      if (payload && payload.message) {
        setMessages((prev) => {
          // Prevent duplicates
          const exists = prev.some(
            m => m.text === payload.message.text && 
                 Math.abs(new Date(m.timestamp) - new Date(payload.message.timestamp)) < 2000
          );
          if (exists) return prev;
          return [...prev, payload.message];
        });

        playChime();

        if (!isOpen) {
          setUnreadCount((c) => c + 1);
        }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [ticket?._id, isOpen]);

  // Polling fallback when widget is open
  useEffect(() => {
    if (!isOpen || !ticket?._id) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/support/ticket/${ticket._id}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.messages && data.messages.length > messages.length) {
            setMessages(data.messages);
            localStorage.setItem('itv_active_ticket', JSON.stringify(data));
          }
        }
      } catch (e) {}
    }, 7000);

    return () => clearInterval(interval);
  }, [isOpen, ticket?._id, messages.length]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleOpen = () => {
    setIsOpen(true);
    setUnreadCount(0);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleStartNewTicket = () => {
    if (window.confirm('Start a new support conversation?')) {
      localStorage.removeItem('itv_active_ticket');
      setTicket(null);
      setMessages([
        {
          sender: 'support',
          senderName: 'iTV Support',
          text: '👋 New conversation started. How can we help you?',
          timestamp: new Date().toISOString()
        }
      ]);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const textToSend = inputText.trim();
    if (!textToSend || sending) return;

    // Check user info
    let authUser = null;
    try {
      const stored = localStorage.getItem('user');
      if (stored) authUser = JSON.parse(stored);
    } catch (e) {}

    const resolvedName = authUser?.communityProfile?.fullName || 
                         authUser?.name || 
                         authUser?.username || 
                         guestName.trim() || 
                         'Community Member';

    const resolvedEmail = authUser?.email || guestEmail.trim() || '';

    // If guest and never provided name, prompt once
    if (!authUser && !guestName && !showIdentityInputs) {
      setShowIdentityInputs(true);
      return;
    }

    if (guestName) localStorage.setItem('itv_support_guest_name', guestName);
    if (guestEmail) localStorage.setItem('itv_support_guest_email', guestEmail);

    const optimisticMessage = {
      sender: 'user',
      senderName: resolvedName,
      text: textToSend,
      timestamp: new Date().toISOString()
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setInputText('');
    setSending(true);

    try {
      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['x-auth-token'] = token;

      const body = {
        ticketId: ticket?._id || undefined,
        guestSessionId: getGuestSessionId(),
        text: textToSend,
        userName: resolvedName,
        userEmail: resolvedEmail,
        userPlatform: platform
      };

      const res = await fetch(`${API_URL}/support/message`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      if (res.ok) {
        const data = await res.json();
        if (data.ticket) {
          setTicket(data.ticket);
          setMessages(data.ticket.messages);
          localStorage.setItem('itv_active_ticket', JSON.stringify(data.ticket));

          // Join ticket socket room
          if (socketRef.current && data.ticket._id) {
            socketRef.current.emit('join_support_ticket', { ticketId: data.ticket._id });
          }
        }
      }
    } catch (err) {
      console.error('Error dispatching support message:', err);
    } finally {
      setSending(false);
      setShowIdentityInputs(false);
    }
  };

  return (
    <div className="itv-support-widget-container">
      {/* Floating Launcher Button */}
      {!isOpen && (
        <button 
          className="itv-support-launcher" 
          onClick={handleOpen}
          aria-label="Open iTV Support Chat"
        >
          <span className="itv-support-launcher-icon">
            <Headphones size={20} />
          </span>
          <span>Support</span>
          {unreadCount > 0 && (
            <span className="itv-support-unread-badge">{unreadCount}</span>
          )}
        </button>
      )}

      {/* Support Chat Window */}
      {isOpen && (
        <div className="itv-support-window">
          {/* Header */}
          <div className="itv-support-header">
            <div className="itv-support-header-info">
              <div className="itv-support-avatar">
                <Radio size={20} />
              </div>
              <div>
                <h4 className="itv-support-header-title">
                  Interplanetary Support
                </h4>
                <div className="itv-support-status">
                  <span className="itv-support-status-dot"></span>
                  <span>Telegram Live Sync • Online</span>
                </div>
              </div>
            </div>
            <button 
              className="itv-support-close-btn" 
              onClick={handleClose} 
              title="Close Chat"
            >
              <X size={18} />
            </button>
          </div>

          {/* Ticket Bar */}
          {ticket && (
            <div className="itv-support-ticket-bar">
              <span>Ticket: <b>#{ticket.ticketNumber}</b></span>
              <button 
                className="itv-support-reset-btn" 
                onClick={handleStartNewTicket} 
                title="Start a new ticket"
              >
                New Ticket
              </button>
            </div>
          )}

          {/* Messages Body */}
          <div className="itv-support-messages">
            {messages.map((msg, index) => {
              const isUser = msg.sender === 'user';
              const timeString = msg.timestamp 
                ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                : '';

              return (
                <div 
                  key={msg._id || index} 
                  className={`itv-msg-row ${isUser ? 'user' : 'support'}`}
                >
                  <div className="itv-msg-bubble">
                    {msg.text}
                  </div>
                  <div className="itv-msg-meta">
                    {isUser ? 'You' : (msg.senderName || 'iTV Team')} • {timeString}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Identity prompt for guests on first message */}
          {showIdentityInputs && (
            <div className="itv-support-auth-prompt">
              <p>Please enter your name & email so our team knows who to address:</p>
              <div className="itv-support-auth-inputs">
                <input 
                  type="text" 
                  placeholder="Your Name *" 
                  value={guestName} 
                  onChange={(e) => setGuestName(e.target.value)} 
                  autoFocus
                />
                <input 
                  type="email" 
                  placeholder="Your Email" 
                  value={guestEmail} 
                  onChange={(e) => setGuestEmail(e.target.value)} 
                />
              </div>
            </div>
          )}

          {/* Footer Input */}
          <form className="itv-support-footer" onSubmit={handleSendMessage}>
            <div className="itv-support-input-row">
              <input 
                type="text" 
                className="itv-support-input"
                placeholder={showIdentityInputs ? "Now click send to submit..." : "Ask a question or report an issue..."}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
              <button 
                type="submit" 
                className="itv-support-send-btn"
                disabled={sending || !inputText.trim()}
                title="Send Message"
              >
                <Send size={16} />
              </button>
            </div>
            <div className="itv-support-hint">
              <Sparkles size={11} color="#00c6ff" />
              <span>Replies from our Telegram team appear instantly</span>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
