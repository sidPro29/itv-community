import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { 
  Calendar as CalendarIcon, Clock, Video, Mic, Plus, Users, Search, 
  Check, X, PhoneCall, Copy, Trash2, Shield, Sparkles, 
  ExternalLink, AlertCircle, Share2, ChevronLeft, ChevronRight, 
  ChevronDown, Bell, Link as LinkIcon, Radio, Edit2
} from 'lucide-react';
import DeviceSetupModal from '../components/DeviceSetupModal';
import CallModal from '../components/CallModal';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June', 
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const MEETING_TYPES = [
  { id: 'important', label: 'Important', color: '#f97316' }, // Orange
  { id: 'sync', label: 'Team Sync', color: '#007aff' },      // Bright Blue
  { id: 'interview', label: 'Interview', color: '#84cc16' }, // Neon Lime
  { id: 'standup', label: 'Stand-up', color: '#eab308' },    // Yellow
  { id: 'discussion', label: 'Discussion', color: '#a855f7' },// Purple
  { id: 'casual', label: 'Quick Chat', color: '#00f2fe' }    // Cyan
];

export default function ScheduleMeetings() {
  const { currentUser, API_URL } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Calendar Date Navigation
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  // Filter Tab on Scheduled Panel: 'upcoming' | 'past' | 'all'
  const [scheduledFilter, setScheduledFilter] = useState('upcoming');

  // Real-time Room Participant Counts: { [roomId]: number }
  const [roomParticipantsMap, setRoomParticipantsMap] = useState({});

  // Schedule Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCallId, setEditingCallId] = useState(null);
  const [modalTitle, setModalTitle] = useState('Brainstorm Session');
  const [modalDate, setModalDate] = useState('');
  const [modalType, setModalType] = useState('important');
  const [modalCallType, setModalCallType] = useState('video'); // 'video' | 'audio'
  const [modalStartTime, setModalStartTime] = useState('11:30');
  const [modalEndTime, setModalEndTime] = useState('13:00');
  const [modalNote, setModalNote] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [busyUserIds, setBusyUserIds] = useState([]);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [showStartTimeDropdown, setShowStartTimeDropdown] = useState(false);
  const [showEndTimeDropdown, setShowEndTimeDropdown] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [allMembers, setAllMembers] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  // Active WebRTC Call & Setup States
  const [setupModalConfig, setSetupModalConfig] = useState(null);
  const [activeCallRoom, setActiveCallRoom] = useState(null);
  const socketRef = useRef(null);

  const SOCKET_URL = API_URL.replace('/api', '');

  // Initialize Socket.io for live updates & call rooms
  useEffect(() => {
    if (!currentUser?._id) return;

    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 15
    });

    socketRef.current.emit('user_connected', currentUser._id);

    // Initial query of live participant counts
    socketRef.current.emit('get_live_room_counts', (counts) => {
      if (counts && typeof counts === 'object') {
        setRoomParticipantsMap(counts);
      }
    });

    // Real-time listener for participant changes in any room
    socketRef.current.on('call_room_participant_update', ({ roomId, participantCount }) => {
      if (roomId) {
        setRoomParticipantsMap(prev => ({
          ...prev,
          [roomId]: participantCount || 0
        }));
      }
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [currentUser, SOCKET_URL]);

  // Fetch Scheduled Calls & Members
  useEffect(() => {
    fetchScheduledCalls();
    fetchMembers();
  }, []);

  // Handle direct join link: e.g. /schedule?joinRoom=sched_...
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const joinRoomId = params.get('joinRoom');
    if (joinRoomId && calls.length > 0) {
      const targetCall = calls.find(c => c.roomId === joinRoomId);
      if (targetCall) {
        handleJoinCall(targetCall);
      } else {
        // Unknown or custom link room - join as persistent meeting room
        setSetupModalConfig({
          roomId: joinRoomId,
          callType: 'video',
          isInitiator: false,
          isRejoin: true,
          title: 'Google Meet Style Room'
        });
      }
    }
  }, [location.search, calls]);

  // Handle URL query to prefill scheduling with a specific member
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const scheduleWith = params.get('scheduleWith');
    if (scheduleWith && allMembers.length > 0) {
      const target = allMembers.find(m => m._id === scheduleWith);
      if (target && !selectedParticipants.includes(target._id)) {
        setSelectedParticipants([target._id]);
        openScheduleModal(new Date());
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
        // Populate initial live counts
        const initialMap = {};
        data.forEach(c => {
          if (c.roomId && c.liveParticipantCount !== undefined) {
            initialMap[c.roomId] = c.liveParticipantCount;
          }
        });
        setRoomParticipantsMap(prev => ({ ...prev, ...initialMap }));
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

  // Calendar Calculations
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sun
    const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const days = [];

    // Prev month overflow days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      days.push({
        dayNumber: daysInPrevMonth - i,
        month: currentMonth - 1,
        year: currentMonth === 0 ? currentYear - 1 : currentYear,
        isCurrentMonth: false
      });
    }

    // Current month days
    for (let i = 1; i <= daysInCurrentMonth; i++) {
      days.push({
        dayNumber: i,
        month: currentMonth,
        year: currentYear,
        isCurrentMonth: true
      });
    }

    // Next month overflow days to make complete 35 or 42 grid
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        dayNumber: i,
        month: currentMonth + 1,
        year: currentMonth === 11 ? currentYear + 1 : currentYear,
        isCurrentMonth: false
      });
    }

    return days;
  }, [currentYear, currentMonth]);

  // Previous & Next Month
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  // Handle Calendar Day Selection with intelligent tab switching
  const handleSelectCalendarDay = (cellDate) => {
    setSelectedDate(cellDate);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const cellStart = new Date(cellDate.getFullYear(), cellDate.getMonth(), cellDate.getDate());

    // Find all calls on this cellDate
    const dayCalls = calls.filter(c => isSameDay(new Date(c.scheduledAt), cellDate));

    const hasCancelled = dayCalls.some(c => c.status === 'cancelled');
    const hasPast = dayCalls.some(c => {
      const end = new Date(new Date(c.scheduledAt).getTime() + (c.durationMinutes || 30) * 60000);
      return end < now || c.status === 'completed';
    });
    const hasUpcoming = dayCalls.some(c => {
      const end = new Date(new Date(c.scheduledAt).getTime() + (c.durationMinutes || 30) * 60000);
      return end >= now && c.status !== 'cancelled';
    });

    // If day has cancelled meeting OR has multiple types of meetings (both upcoming & past):
    if (hasCancelled || (hasPast && hasUpcoming)) {
      setScheduledFilter('all');
    } else if (cellStart < todayStart || (hasPast && !hasUpcoming)) {
      setScheduledFilter('past');
    } else {
      setScheduledFilter('upcoming');
    }
  };

  // Next / Prev Day on Scheduled Agenda
  const handlePrevDay = () => {
    const prev = new Date(selectedDate);
    prev.setDate(prev.getDate() - 1);
    handleSelectCalendarDay(prev);
  };

  const handleNextDay = () => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 1);
    handleSelectCalendarDay(next);
  };

  // Check if two dates are same day
  const isSameDay = (d1, d2) => {
    if (!d1 || !d2) return false;
    const a = new Date(d1);
    const b = new Date(d2);
    return a.getFullYear() === b.getFullYear() && 
           a.getMonth() === b.getMonth() && 
           a.getDate() === b.getDate();
  };

  // Get events on a specific date
  const getEventsForDay = (year, month, day) => {
    return calls.filter(call => {
      const d = new Date(call.scheduledAt);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });
  };

  // Open Schedule Modal for a given date (New Meeting)
  const openScheduleModal = (dateToUse = selectedDate) => {
    setEditingCallId(null);
    const now = new Date();
    let targetDate = dateToUse instanceof Date ? new Date(dateToUse.getTime()) : new Date(dateToUse);

    // If selected date is in the past, reset to today
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetDateStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    if (targetDateStart < todayStart) {
      targetDate = new Date();
    }

    const y = targetDate.getFullYear();
    const m = String(targetDate.getMonth() + 1).padStart(2, '0');
    const d = String(targetDate.getDate()).padStart(2, '0');
    setModalDate(`${y}-${m}-${d}`);

    // If target date is today, start time must be in future (next 15-min interval)
    let startHour = 11;
    let startMin = 0;
    if (targetDateStart.getTime() <= todayStart.getTime()) {
      const nextQuarter = new Date(Math.ceil(now.getTime() / (15 * 60 * 1000)) * (15 * 60 * 1000) + 15 * 60 * 1000);
      startHour = nextQuarter.getHours();
      startMin = nextQuarter.getMinutes();
    }
    const startHStr = String(startHour).padStart(2, '0');
    const startMStr = String(startMin).padStart(2, '0');
    setModalStartTime(`${startHStr}:${startMStr}`);

    const endQuarter = new Date(new Date().setHours(startHour, startMin + 30, 0, 0));
    const endHStr = String(endQuarter.getHours()).padStart(2, '0');
    const endMStr = String(endQuarter.getMinutes()).padStart(2, '0');
    setModalEndTime(`${endHStr}:${endMStr}`);

    setModalTitle('Brainstorm Session');
    setModalType('important');
    setModalCallType('video');
    setModalNote('');
    setErrorMsg('');
    setShowMemberPicker(false);
    setShowStartTimeDropdown(false);
    setShowEndTimeDropdown(false);
    setIsModalOpen(true);
  };

  // Open Schedule Modal to Edit existing meeting (Host only)
  const openEditModal = (call) => {
    setEditingCallId(call._id);
    const callDate = new Date(call.scheduledAt);
    const y = callDate.getFullYear();
    const m = String(callDate.getMonth() + 1).padStart(2, '0');
    const d = String(callDate.getDate()).padStart(2, '0');
    setModalDate(`${y}-${m}-${d}`);

    const startH = String(callDate.getHours()).padStart(2, '0');
    const startM = String(callDate.getMinutes()).padStart(2, '0');
    setModalStartTime(`${startH}:${startM}`);

    const endDate = new Date(callDate.getTime() + (call.durationMinutes || 30) * 60000);
    const endH = String(endDate.getHours()).padStart(2, '0');
    const endM = String(endDate.getMinutes()).padStart(2, '0');
    setModalEndTime(`${endH}:${endM}`);

    setModalTitle(call.title || 'Meeting');
    setModalNote(call.description || '');
    setModalCallType(call.callType || 'video');

    const participantIds = Array.isArray(call.participants)
      ? call.participants.map(p => (typeof p === 'object' ? p._id : p)).filter(Boolean)
      : [];
    setSelectedParticipants(participantIds);

    setErrorMsg('');
    setShowMemberPicker(false);
    setShowStartTimeDropdown(false);
    setShowEndTimeDropdown(false);
    setIsModalOpen(true);
  };

  // Check availability of community members for the selected date/time window
  useEffect(() => {
    if (!isModalOpen || !modalDate || !modalStartTime) return;

    const timer = setTimeout(async () => {
      try {
        setCheckingAvailability(true);
        const start = new Date(`${modalDate}T${modalStartTime}:00`).toISOString();
        const end = new Date(`${modalDate}T${modalEndTime || '23:59'}:00`).toISOString();

        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/community/check-availability`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-auth-token': token
          },
          body: JSON.stringify({ start, end, excludeCallId: editingCallId })
        });

        if (res.ok) {
          const data = await res.json();
          const busyList = Array.isArray(data.busyUserIds) ? data.busyUserIds : [];
          setBusyUserIds(busyList);

          // Auto-remove any selected participant who is now busy/collided
          setSelectedParticipants(prev => prev.filter(id => !busyList.includes(id)));
        }
      } catch (err) {
        console.warn('Availability check failed:', err);
      } finally {
        setCheckingAvailability(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [isModalOpen, modalDate, modalStartTime, modalEndTime, editingCallId, API_URL]);

  const handleToggleMember = (memberId) => {
    // If user is busy/collided at this time, cannot invite them
    if (busyUserIds.includes(memberId)) return;

    setSelectedParticipants(prev => 
      prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId]
    );
  };

  // Time stepper helpers (< 11:30 AM >)
  const format24To12 = (time24) => {
    if (!time24) return '';
    const [h, m] = time24.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
  };

  const adjustTime = (timeStr, deltaMinutes) => {
    const [h, m] = (timeStr || '12:00').split(':').map(Number);
    const date = new Date();
    date.setHours(h, m + deltaMinutes, 0, 0);
    const newH = String(date.getHours()).padStart(2, '0');
    const newM = String(date.getMinutes()).padStart(2, '0');
    return `${newH}:${newM}`;
  };

  // Pre-generate 15-minute time slots for dropdown
  const TIME_SLOTS = useMemo(() => {
    const slots = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 15) {
        const hStr = String(h).padStart(2, '0');
        const mStr = String(m).padStart(2, '0');
        const time24 = `${hStr}:${mStr}`;
        const period = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        const label = `${String(h12).padStart(2, '0')}:${mStr} ${period}`;
        slots.push({ value: time24, label, minutes: h * 60 + m });
      }
    }
    return slots;
  }, []);

  const handleSelectStartTime = (timeVal) => {
    setModalStartTime(timeVal);
    setShowStartTimeDropdown(false);

    const [sh, sm] = timeVal.split(':').map(Number);
    const [eh, em] = (modalEndTime || '12:00').split(':').map(Number);
    if (eh * 60 + em <= sh * 60 + sm) {
      setModalEndTime(adjustTime(timeVal, 30));
    }
  };

  const handleSelectEndTime = (timeVal) => {
    setModalEndTime(timeVal);
    setShowEndTimeDropdown(false);
  };

  const handleStepStartTime = (delta) => {
    setModalStartTime(prev => {
      const updated = adjustTime(prev, delta);
      const [uh, um] = updated.split(':').map(Number);
      const [eh, em] = modalEndTime.split(':').map(Number);
      if (eh * 60 + em <= uh * 60 + um) {
        setModalEndTime(adjustTime(updated, 30));
      }
      return updated;
    });
  };

  const handleStepEndTime = (delta) => {
    setModalEndTime(prev => {
      const updated = adjustTime(prev, delta);
      const [sh, sm] = modalStartTime.split(':').map(Number);
      const [uh, um] = updated.split(':').map(Number);
      if (uh * 60 + um <= sh * 60 + sm) {
        return prev; // Do not allow end time to be before start time
      }
      return updated;
    });
  };

  // Save (Create or Update) Scheduled Call
  const handleSaveMeeting = async (e) => {
    e.preventDefault();
    if (!modalTitle.trim()) {
      setErrorMsg('Please enter a meeting title.');
      return;
    }
    if (!modalDate || !modalStartTime) {
      setErrorMsg('Please select date and start time.');
      return;
    }

    const scheduledDateTime = new Date(`${modalDate}T${modalStartTime}:00`);
    if (isNaN(scheduledDateTime.getTime())) {
      setErrorMsg('Please select a valid date and time.');
      return;
    }

    // Meeting must be in future (allow 60s leeway)
    if (scheduledDateTime.getTime() <= Date.now() - 60000) {
      setErrorMsg('Meetings can only be scheduled for a future date and time.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg('');

      // Parse start and end time to calculate duration
      const [startH, startM] = modalStartTime.split(':').map(Number);
      const [endH, endM] = (modalEndTime || '12:00').split(':').map(Number);
      
      let duration = (endH * 60 + endM) - (startH * 60 + startM);
      if (duration <= 0) duration = 30;

      const token = localStorage.getItem('token');
      const isEditing = Boolean(editingCallId);
      const endpoint = isEditing 
        ? `${API_URL}/community/scheduled-calls/${editingCallId}`
        : `${API_URL}/community/scheduled-calls`;
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        },
        body: JSON.stringify({
          title: modalTitle.trim(),
          description: modalNote.trim(),
          callType: modalCallType,
          scheduledAt: scheduledDateTime.toISOString(),
          durationMinutes: duration,
          participantIds: selectedParticipants
        })
      });

      const text = await res.text();
      let data = {};
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        data = { msg: text || 'Server response error' };
      }

      if (!res.ok) {
        throw new Error(data.msg || `Failed to ${isEditing ? 'update' : 'create'} meeting`);
      }

      setIsModalOpen(false);
      setEditingCallId(null);
      fetchScheduledCalls();
    } catch (err) {
      setErrorMsg(err.message || 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cancel Call (marks status as 'cancelled')
  const handleCancelCall = async (callId) => {
    if (!window.confirm('Are you sure you want to cancel this meeting? Once cancelled, you will be able to delete it permanently.')) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/community/scheduled-calls/${callId}/cancel`, {
        method: 'PUT',
        headers: { 'x-auth-token': token }
      });
      const text = await res.text();
      let data = {};
      try { data = JSON.parse(text); } catch { data = { msg: text }; }
      if (!res.ok) {
        alert(data.msg || 'Failed to cancel call');
        return;
      }
      setCalls(prev => prev.map(c => c._id === callId ? { ...c, status: 'cancelled' } : c));
    } catch (err) {
      console.error('Error cancelling call:', err);
      alert(err.message || 'Error cancelling call');
    }
  };

  // Permanently Delete Call from Database
  const handleDeleteCall = async (callId) => {
    if (!window.confirm('Are you sure you want to permanently delete this meeting from the database? This cannot be undone.')) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/community/scheduled-calls/${callId}`, {
        method: 'DELETE',
        headers: { 'x-auth-token': token }
      });
      const text = await res.text();
      let data = {};
      try { data = JSON.parse(text); } catch { data = { msg: text }; }
      if (!res.ok) {
        alert(data.msg || 'Failed to delete meeting');
        return;
      }
      setCalls(prev => prev.filter(c => c._id !== callId));
    } catch (err) {
      console.error('Error deleting call from database:', err);
      alert(err.message || 'Error deleting meeting');
    }
  };

  // Copy Meeting Link (Google Meet shareable link)
  const copyMeetingLink = (call) => {
    const url = `${window.location.origin}/schedule?joinRoom=${call.roomId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(call._id);
      setTimeout(() => setCopiedId(null), 2500);
    });
  };

  // Launch Live WebRTC Call Room
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

  // Helper to determine status badge for card (Upcoming, Past, Cancelled, Live Now)
  const getCallStatusBadge = (call) => {
    const now = new Date();
    const callDate = new Date(call.scheduledAt);
    const callEndDate = new Date(callDate.getTime() + (call.durationMinutes || 30) * 60000);
    const liveCount = roomParticipantsMap[call.roomId] || call.liveParticipantCount || 0;

    if (call.status === 'cancelled') {
      return {
        label: 'Cancelled',
        color: '#ff6b6b',
        bg: 'rgba(255, 107, 107, 0.14)',
        border: '1px solid rgba(255, 107, 107, 0.35)'
      };
    }
    if (liveCount > 0) {
      return {
        label: '● Live Now',
        color: '#00f2fe',
        bg: 'rgba(0, 242, 254, 0.15)',
        border: '1px solid #00f2fe'
      };
    }
    if (callEndDate < now || call.status === 'completed') {
      return {
        label: 'Past',
        color: 'rgba(255, 255, 255, 0.55)',
        bg: 'rgba(255, 255, 255, 0.08)',
        border: '1px solid rgba(255, 255, 255, 0.15)'
      };
    }
    return {
      label: 'Upcoming',
      color: '#10b981',
      bg: 'rgba(16, 185, 129, 0.15)',
      border: '1px solid rgba(16, 185, 129, 0.3)'
    };
  };

  // Filter scheduled calls for the Right Panel
  const filteredScheduledCalls = useMemo(() => {
    const now = new Date();
    return calls.filter(call => {
      const callDate = new Date(call.scheduledAt);
      const callEndDate = new Date(callDate.getTime() + (call.durationMinutes || 30) * 60000);

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (call.title || '').toLowerCase().includes(q);
        const matchDesc = (call.description || '').toLowerCase().includes(q);
        const matchHost = (call.host?.communityProfile?.fullName || call.host?.username || '').toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchHost) return false;
      }

      // Filter by selected day
      if (!isSameDay(callDate, selectedDate)) return false;

      if (scheduledFilter === 'upcoming') {
        return call.status !== 'cancelled' && callEndDate >= now;
      } else if (scheduledFilter === 'past') {
        return call.status !== 'cancelled' && (callEndDate < now || call.status === 'completed');
      } else if (scheduledFilter === 'all') {
        return true;
      }
      return true;
    }).sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
  }, [calls, selectedDate, scheduledFilter, searchQuery]);

  // Greeting based on time of day
  const greetingText = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Morning';
    if (h < 17) return 'Afternoon';
    return 'Evening';
  }, []);

  const userName = currentUser?.communityProfile?.fullName || currentUser?.username || 'Astronaut';
  const firstName = userName.split(' ')[0];

  // Helper color tag for meeting cards
  const getTypeColor = (index, type) => {
    const colors = ['#f97316', '#84cc16', '#007aff', '#00f2fe', '#a855f7', '#eab308'];
    return colors[index % colors.length];
  };

  return (
    <div style={{
      maxWidth: '1440px',
      margin: '0 auto',
      padding: '24px 28px',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      color: '#fff',
      minHeight: 'calc(100vh - 80px)'
    }}>

      {/* TOP HEADER: Greeting, Search & Action Button */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '20px',
        marginBottom: '26px'
      }}>
        {/* Left: Greeting */}
        <div>
          <h1 style={{
            margin: 0,
            fontSize: '1.95rem',
            fontWeight: 800,
            color: '#fff',
            letterSpacing: '-0.02em',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            {greetingText}, {firstName}!
          </h1>
          <p style={{
            margin: '5px 0 0 0',
            color: 'rgba(255, 255, 255, 0.55)',
            fontSize: '0.92rem'
          }}>
            Here's what's on your agenda today.
          </p>
        </div>

        {/* Right: Search Bar & Schedule Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            position: 'relative',
            width: '280px'
          }}>
            <Search size={16} style={{
              position: 'absolute',
              left: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'rgba(255, 255, 255, 0.4)'
            }} />
            <input
              type="text"
              placeholder="Search for some activities"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '14px',
                padding: '10px 14px 10px 40px',
                color: '#fff',
                fontSize: '0.86rem',
                outline: 'none',
                transition: 'border 0.2s ease'
              }}
              onFocus={e => e.target.style.borderColor = 'rgba(0, 242, 254, 0.4)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
            />
          </div>

          <button
            onClick={() => openScheduleModal(selectedDate)}
            style={{
              background: 'linear-gradient(135deg, #007aff 0%, #00f2fe 100%)',
              border: 'none',
              borderRadius: '14px',
              padding: '11px 22px',
              color: '#fff',
              fontWeight: 800,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 20px rgba(0, 122, 255, 0.35)',
              transition: 'transform 0.15s ease'
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <Plus size={16} /> Schedule
          </button>
        </div>
      </div>

      {/* MAIN CONTAINER: Calendar (Left) & Scheduled Agenda (Right) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(600px, 1fr) 420px',
        gap: '24px',
        alignItems: 'start'
      }}>

        {/* LEFT COLUMN: INTERACTIVE MONTH CALENDAR */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '24px',
          padding: '24px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)'
        }}>

          {/* Month & Year Selectors with Navigation */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              {/* Month Dropdown */}
              <div style={{ position: 'relative' }}>
                <select
                  value={currentMonth}
                  onChange={e => setCurrentMonth(Number(e.target.value))}
                  style={{
                    appearance: 'none',
                    background: 'transparent',
                    border: 'none',
                    color: '#fff',
                    fontSize: '1.25rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    paddingRight: '22px',
                    outline: 'none'
                  }}
                >
                  {MONTH_NAMES.map((name, i) => (
                    <option key={name} value={i} style={{ background: '#0f172a', color: '#fff' }}>
                      {name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'rgba(255,255,255,0.6)' }} />
              </div>

              {/* Year Dropdown */}
              <div style={{ position: 'relative' }}>
                <select
                  value={currentYear}
                  onChange={e => setCurrentYear(Number(e.target.value))}
                  style={{
                    appearance: 'none',
                    background: 'transparent',
                    border: 'none',
                    color: 'rgba(255,255,255,0.6)',
                    fontSize: '1.25rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    paddingRight: '20px',
                    outline: 'none'
                  }}
                >
                  {[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map(y => (
                    <option key={y} value={y} style={{ background: '#0f172a', color: '#fff' }}>
                      {y}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'rgba(255,255,255,0.4)' }} />
              </div>
            </div>

            {/* Prev / Next Month Arrow Buttons */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handlePrevMonth}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '10px',
                  width: '32px',
                  height: '32px',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={handleNextMonth}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '10px',
                  width: '32px',
                  height: '32px',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Day of Week Header Row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '8px',
            marginBottom: '10px'
          }}>
            {DAY_NAMES.map(day => (
              <div
                key={day}
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'rgba(255, 255, 255, 0.4)',
                  padding: '4px 6px'
                }}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Month Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '8px'
          }}>
            {calendarDays.map((cell, idx) => {
              const cellDate = new Date(cell.year, cell.month, cell.dayNumber);
              const isToday = isSameDay(cellDate, new Date());
              const isSelected = isSameDay(cellDate, selectedDate);
              const dayEvents = getEventsForDay(cell.year, cell.month, cell.dayNumber);

              return (
                <div
                  key={idx}
                  onClick={() => handleSelectCalendarDay(cellDate)}
                  onDoubleClick={() => openScheduleModal(cellDate)}
                  style={{
                    minHeight: '105px',
                    borderRadius: '16px',
                    padding: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    // Background & borders matching reference:
                    background: isToday
                      ? 'radial-gradient(circle at center, rgba(0, 122, 255, 0.35) 0%, rgba(15, 23, 42, 0.6) 80%)'
                      : isSelected
                      ? 'rgba(0, 122, 255, 0.12)'
                      : 'rgba(255, 255, 255, 0.02)',
                    border: isSelected
                      ? '1px dashed #007aff'
                      : isToday
                      ? '1px solid rgba(0, 122, 255, 0.5)'
                      : '1px solid rgba(255, 255, 255, 0.04)',
                    opacity: cell.isCurrentMonth ? 1 : 0.3
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  }}
                  onMouseLeave={e => {
                    if (!isSelected && !isToday) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                  }}
                >
                  {/* Date Number */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span style={{
                      fontSize: '0.88rem',
                      fontWeight: isToday || isSelected ? 800 : 600,
                      color: isToday ? '#00f2fe' : isSelected ? '#fff' : 'rgba(255, 255, 255, 0.7)'
                    }}>
                      {cell.dayNumber}
                    </span>

                    {/* Quick + button on selected */}
                    {isSelected && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openScheduleModal(cellDate);
                        }}
                        title="Add meeting on this day"
                        style={{
                          background: 'rgba(0, 122, 255, 0.25)',
                          border: 'none',
                          borderRadius: '50%',
                          width: '18px',
                          height: '18px',
                          color: '#00f2fe',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 0
                        }}
                      >
                        <Plus size={12} />
                      </button>
                    )}
                  </div>

                  {/* Meeting Event Chips inside Cell */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '6px' }}>
                    {dayEvents.slice(0, 3).map((event, eventIdx) => {
                      const color = getTypeColor(eventIdx);
                      return (
                        <div
                          key={event._id || eventIdx}
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 600,
                            color: 'rgba(255, 255, 255, 0.85)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <span style={{
                            width: '3px',
                            height: '9px',
                            borderRadius: '2px',
                            background: color,
                            flexShrink: 0
                          }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {event.title}
                          </span>
                        </div>
                      );
                    })}

                    {dayEvents.length > 3 && (
                      <span style={{ fontSize: '0.62rem', color: '#00f2fe', fontWeight: 700 }}>
                        +{dayEvents.length - 3} more
                      </span>
                    )}
                  </div>

                </div>
              );
            })}
          </div>

        </div>

        {/* RIGHT COLUMN: "SCHEDULED" SIDEBAR / AGENDA */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '24px',
          padding: '24px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column'
        }}>

          {/* Header: Title, Selected Date, and Date Nav */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px'
          }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#fff' }}>
                Scheduled
              </h2>
              <span style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                {selectedDate.getDate()} {MONTH_NAMES[selectedDate.getMonth()]}, {selectedDate.getFullYear()}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                onClick={() => setSelectedDate(new Date())}
                title="Go to Today"
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: '6px 8px',
                  color: '#00f2fe',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <CalendarIcon size={14} />
              </button>
              <button
                onClick={handlePrevDay}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: '6px 8px',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={handleNextDay}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: '6px 8px',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* Quick Filter Tabs: Upcoming / Past / All */}
          <div style={{
            display: 'flex',
            background: 'rgba(255, 255, 255, 0.04)',
            borderRadius: '10px',
            padding: '3px',
            marginBottom: '18px'
          }}>
            {[
              { id: 'upcoming', label: 'Upcoming' },
              { id: 'past', label: 'Past' },
              { id: 'all', label: 'All' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setScheduledFilter(tab.id)}
                style={{
                  flex: 1,
                  background: scheduledFilter === tab.id ? 'rgba(0, 122, 255, 0.25)' : 'transparent',
                  color: scheduledFilter === tab.id ? '#00f2fe' : 'rgba(255, 255, 255, 0.6)',
                  border: scheduledFilter === tab.id ? '1px solid rgba(0, 242, 254, 0.3)' : '1px solid transparent',
                  borderRadius: '8px',
                  padding: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Meeting Cards List */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            overflowY: 'auto',
            maxHeight: 'calc(100vh - 280px)',
            paddingRight: '4px'
          }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.4)', fontSize: '0.88rem' }}>
                Loading scheduled meetings...
              </div>
            ) : filteredScheduledCalls.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '48px 16px',
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: '16px',
                border: '1px dashed rgba(255, 255, 255, 0.1)'
              }}>
                <Clock size={32} style={{ color: 'rgba(255,255,255,0.25)', marginBottom: '8px' }} />
                <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem' }}>
                  No activities scheduled
                </div>
                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)', marginTop: '4px', marginBottom: '14px' }}>
                  {scheduledFilter === 'upcoming'
                    ? `No upcoming meetings on ${selectedDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}`
                    : scheduledFilter === 'past'
                    ? `No past meetings on ${selectedDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}`
                    : `No meetings on ${selectedDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}`}
                </div>
                <button
                  onClick={() => openScheduleModal(selectedDate)}
                  style={{
                    background: 'rgba(0, 122, 255, 0.15)',
                    border: '1px solid rgba(0, 122, 255, 0.3)',
                    color: '#00f2fe',
                    borderRadius: '10px',
                    padding: '8px 16px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  + Add Meeting
                </button>
              </div>
            ) : (
              filteredScheduledCalls.map((call, idx) => {
                const callDate = new Date(call.scheduledAt);
                const isHost = (call.host?._id || call.host) === currentUser._id;
                const isCancelled = call.status === 'cancelled';
                const accentColor = getTypeColor(idx);
                const statusBadge = getCallStatusBadge(call);

                // Real-time live participant count
                const liveCount = roomParticipantsMap[call.roomId] || call.liveParticipantCount || 0;
                const isLiveNow = liveCount > 0;

                // Time strings: e.g. 09:00 AM - 10:15 AM
                const startTimeStr = callDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                const endTimeDate = new Date(callDate.getTime() + (call.durationMinutes || 30) * 60000);
                const endTimeStr = endTimeDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                const isPast = endTimeDate < new Date() || call.status === 'completed';
                const isUpcoming = !isCancelled && !isPast;

                // Duration text: e.g. 45 min, 1 hour
                const durationMins = call.durationMinutes || 30;
                const durationLabel = durationMins >= 60 
                  ? `${Math.floor(durationMins / 60)} hour${durationMins % 60 ? ` ${durationMins % 60}m` : ''}` 
                  : `${durationMins} min`;

                const attendees = [
                  call.host,
                  ...(call.participants || [])
                ].filter(Boolean);

                return (
                  <div key={call._id || idx}>
                    {/* Time Label header above card (like 09:00, 10:00 in reference) */}
                    <div style={{
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      color: 'rgba(255, 255, 255, 0.45)',
                      marginBottom: '6px'
                    }}>
                      {startTimeStr}
                    </div>

                    {/* The Reference Style Card */}
                    <div style={{
                      background: '#131b2e',
                      border: isLiveNow ? '1px solid #00f2fe' : '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '18px',
                      padding: '16px 18px',
                      position: 'relative',
                      overflow: 'hidden',
                      boxShadow: isLiveNow ? '0 8px 30px rgba(0, 242, 254, 0.2)' : '0 8px 24px rgba(0, 0, 0, 0.35)',
                      transition: 'transform 0.15s ease'
                    }}>
                      {/* Top Horizontal Colored Accent Bar */}
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '4px',
                        background: accentColor
                      }} />

                      {/* Card Header: Title & Actions */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginTop: '2px',
                        marginBottom: '6px'
                      }}>
                        <div>
                          <div style={{ marginBottom: '6px' }}>
                            <span style={{
                              fontSize: '0.66rem',
                              fontWeight: 800,
                              color: statusBadge.color,
                              background: statusBadge.bg,
                              border: statusBadge.border,
                              borderRadius: '6px',
                              padding: '2px 8px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              letterSpacing: '0.5px',
                              textTransform: 'uppercase'
                            }}>
                              {statusBadge.label}
                            </span>
                          </div>
                          <h3 style={{
                            margin: 0,
                            fontSize: '1.05rem',
                            fontWeight: 800,
                            color: isCancelled ? 'rgba(255, 255, 255, 0.45)' : '#fff',
                            textDecoration: isCancelled ? 'line-through' : 'none',
                            lineHeight: 1.3
                          }}>
                            {call.title}
                          </h3>
                          {call.description && (
                            <p style={{
                              margin: '4px 0 0 0',
                              fontSize: '0.8rem',
                              color: 'rgba(255, 255, 255, 0.55)',
                              lineHeight: 1.3
                            }}>
                              {call.description}
                            </p>
                          )}
                        </div>

                        {/* Host Actions: Edit & Cancel for Upcoming; Delete for Past / Cancelled */}
                        {isHost && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {/* If upcoming and NOT cancelled: Host can Edit or Cancel */}
                            {isUpcoming && !isCancelled && (
                              <>
                                <button
                                  onClick={() => openEditModal(call)}
                                  title="Edit meeting"
                                  style={{
                                    background: 'rgba(0, 122, 255, 0.12)',
                                    border: '1px solid rgba(0, 122, 255, 0.3)',
                                    borderRadius: '8px',
                                    color: '#00f2fe',
                                    cursor: 'pointer',
                                    padding: '4px 8px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    transition: 'all 0.15s ease'
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(0, 122, 255, 0.25)'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(0, 122, 255, 0.12)'}
                                >
                                  <Edit2 size={11} /> Edit
                                </button>

                                <button
                                  onClick={() => handleCancelCall(call._id)}
                                  title="Cancel meeting (must cancel before deleting)"
                                  style={{
                                    background: 'rgba(255, 171, 0, 0.1)',
                                    border: '1px solid rgba(255, 171, 0, 0.3)',
                                    borderRadius: '8px',
                                    color: '#ffb703',
                                    cursor: 'pointer',
                                    padding: '4px 8px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    transition: 'all 0.15s ease'
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 171, 0, 0.22)'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 171, 0, 0.1)'}
                                >
                                  <X size={11} /> Cancel
                                </button>
                              </>
                            )}

                            {/* If Past or Cancelled: Host can permanently Delete from database */}
                            {(isPast || isCancelled) && (
                              <button
                                onClick={() => handleDeleteCall(call._id)}
                                title="Permanently remove from database"
                                style={{
                                  background: 'rgba(255, 77, 77, 0.1)',
                                  border: '1px solid rgba(255, 77, 77, 0.3)',
                                  borderRadius: '8px',
                                  color: '#ff4d4d',
                                  cursor: 'pointer',
                                  padding: '4px 8px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  transition: 'all 0.15s ease'
                                }}
                                onMouseEnter={e => {
                                  e.currentTarget.style.background = 'rgba(255, 77, 77, 0.25)';
                                  e.currentTarget.style.color = '#fff';
                                }}
                                onMouseLeave={e => {
                                  e.currentTarget.style.background = 'rgba(255, 77, 77, 0.1)';
                                  e.currentTarget.style.color = '#ff4d4d';
                                }}
                              >
                                <Trash2 size={11} /> Delete
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Time Range & Duration Row */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.78rem',
                        color: 'rgba(255, 255, 255, 0.65)',
                        margin: '10px 0 14px 0'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Clock size={13} color="rgba(255,255,255,0.4)" />
                          <span>{startTimeStr} - {endTimeStr}</span>
                        </div>
                        <span style={{ color: 'rgba(255,255,255,0.45)' }}>{durationLabel}</span>
                      </div>

                      {/* Live Counter & Google Meet Style Link Pill */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '8px',
                        marginBottom: '14px',
                        padding: '8px 10px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        borderRadius: '12px'
                      }}>
                        {/* Live Participant Status */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {isLiveNow ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              color: '#00f2fe',
                              fontSize: '0.78rem',
                              fontWeight: 800
                            }}>
                              <span style={{
                                width: '7px',
                                height: '7px',
                                borderRadius: '50%',
                                background: '#00f2fe',
                                boxShadow: '0 0 10px #00f2fe'
                              }} />
                              {liveCount} in room
                            </span>
                          ) : (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              color: 'rgba(255, 255, 255, 0.4)',
                              fontSize: '0.75rem'
                            }}>
                              <span style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: 'rgba(255,255,255,0.3)'
                              }} />
                              Room open (0 in call)
                            </span>
                          )}
                        </div>

                        {/* Join / Meet Link Buttons */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {/* Meet Link Join Button */}
                          <button
                            disabled={isCancelled}
                            onClick={() => !isCancelled && handleJoinCall(call)}
                            style={{
                              background: isCancelled
                                ? 'rgba(255, 255, 255, 0.05)'
                                : isLiveNow
                                ? 'linear-gradient(135deg, #007aff, #00f2fe)'
                                : 'rgba(0, 122, 255, 0.15)',
                              border: isCancelled
                                ? '1px solid rgba(255, 255, 255, 0.1)'
                                : isLiveNow ? 'none' : '1px solid rgba(0, 122, 255, 0.35)',
                              borderRadius: '20px',
                              padding: '5px 12px',
                              color: isCancelled ? 'rgba(255, 255, 255, 0.35)' : isLiveNow ? '#fff' : '#00f2fe',
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              cursor: isCancelled ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '5px'
                            }}
                          >
                            <Video size={12} /> {isCancelled ? 'Cancelled' : 'Meet Link'}
                          </button>

                          {/* Copy Link Button */}
                          <button
                            onClick={() => copyMeetingLink(call)}
                            title="Copy Meet Link to share"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: copiedId === call._id ? '#00f2fe' : 'rgba(255, 255, 255, 0.45)',
                              cursor: 'pointer',
                              padding: '4px',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                          >
                            {copiedId === call._id ? <Check size={14} /> : <Share2 size={14} />}
                          </button>
                        </div>
                      </div>

                      {/* Host & Invited Attendees Section */}
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        paddingTop: '10px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.06)'
                      }}>
                        {/* Host Row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            width: '22px',
                            height: '22px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #007aff, #00f2fe)',
                            border: '1.5px solid rgba(0, 242, 254, 0.6)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            color: '#fff',
                            overflow: 'hidden',
                            flexShrink: 0
                          }}>
                            {call.host?.communityProfile?.avatarUrl ? (
                              <img src={call.host.communityProfile.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (call.host?.communityProfile?.fullName || call.host?.username || 'H').charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontSize: '0.76rem', color: 'rgba(255, 255, 255, 0.85)' }}>
                            Host: <strong style={{ color: '#00f2fe' }}>
                              {isHost ? `${call.host?.communityProfile?.fullName || call.host?.username || 'Host'} (You)` : (call.host?.communityProfile?.fullName || call.host?.username || 'Host')}
                            </strong>
                          </span>
                        </div>

                        {/* Invited Members Row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {call.participants && call.participants.length > 0 ? (
                            <>
                              <div style={{ display: 'flex', alignItems: 'center' }}>
                                {call.participants.slice(0, 3).map((u, aIdx) => {
                                  const name = u.communityProfile?.fullName || u.username || 'Member';
                                  const initial = name.charAt(0).toUpperCase();
                                  const avatar = u.communityProfile?.avatarUrl;

                                  return (
                                    <div
                                      key={u._id || aIdx}
                                      title={name}
                                      style={{
                                        width: '20px',
                                        height: '20px',
                                        borderRadius: '50%',
                                        background: 'linear-gradient(135deg, #a855f7, #ec4899)',
                                        border: '1.5px solid #131b2e',
                                        marginLeft: aIdx > 0 ? '-6px' : '0',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '0.62rem',
                                        fontWeight: 800,
                                        color: '#fff',
                                        overflow: 'hidden'
                                      }}
                                    >
                                      {avatar ? (
                                        <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                      ) : initial}
                                    </div>
                                  );
                                })}
                              </div>

                              <span style={{
                                fontSize: '0.73rem',
                                color: 'rgba(255, 255, 255, 0.55)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}>
                                Invited: {call.participants[0]?.communityProfile?.fullName || call.participants[0]?.username}
                                {call.participants.length > 1 ? ` +${call.participants.length - 1} more` : ''}
                              </span>
                            </>
                          ) : (
                            <span style={{ fontSize: '0.73rem', color: 'rgba(255, 255, 255, 0.4)', fontStyle: 'italic' }}>
                              No members invited yet (open via Meet Link)
                            </span>
                          )}
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>

      </div>

      {/* --- FLOATING "BRAINSTORM SESSION" / SCHEDULE MODAL POPUP --- */}
      {/* Exactly replicating the dark card popup from the reference image */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(3, 7, 18, 0.78)',
          backdropFilter: 'blur(14px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999,
          padding: '16px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '430px',
            background: '#131b2e',
            borderRadius: '22px',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            color: '#fff'
          }}>

            {/* Modal Header: Title & Close */}
            <div>
              {editingCallId && (
                <div style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  color: '#00f2fe',
                  textTransform: 'uppercase',
                  letterSpacing: '0.8px',
                  marginBottom: '4px'
                }}>
                  Editing Meeting (Host)
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <input
                  type="text"
                  value={modalTitle}
                  onChange={e => setModalTitle(e.target.value)}
                  placeholder="Meeting Title"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#fff',
                    fontSize: '1.25rem',
                    fontWeight: 800,
                    outline: 'none',
                    width: '90%'
                  }}
                />
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingCallId(null);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'rgba(255, 255, 255, 0.5)',
                    cursor: 'pointer',
                    padding: '4px'
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {errorMsg && (
              <div style={{
                background: 'rgba(255, 77, 77, 0.15)',
                border: '1px solid rgba(255, 77, 77, 0.3)',
                borderRadius: '8px',
                padding: '8px 12px',
                color: '#ff4d4d',
                fontSize: '0.8rem'
              }}>
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSaveMeeting} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {/* Row 1: Date (Future Date Only) */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.84rem', color: 'rgba(255, 255, 255, 0.5)', width: '70px' }}>
                  Date
                </span>
                <input
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  value={modalDate}
                  onChange={e => {
                    const val = e.target.value;
                    const todayStr = new Date().toISOString().split('T')[0];
                    if (val < todayStr) {
                      setErrorMsg('Meeting date cannot be in the past.');
                      return;
                    }
                    setErrorMsg('');
                    setModalDate(val);
                  }}
                  required
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '10px',
                    padding: '8px 12px',
                    color: '#fff',
                    fontSize: '0.85rem',
                    outline: 'none',
                    colorScheme: 'dark',
                    flex: 1
                  }}
                />
              </div>

              {/* Row 2: Type / Category Dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.84rem', color: 'rgba(255, 255, 255, 0.5)', width: '70px' }}>
                  Type
                </span>
                <div style={{ position: 'relative', flex: 1 }}>
                  <select
                    value={modalType}
                    onChange={e => setModalType(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '10px',
                      padding: '8px 12px',
                      color: '#fff',
                      fontSize: '0.85rem',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {MEETING_TYPES.map(t => (
                      <option key={t.id} value={t.id} style={{ background: '#0f172a' }}>
                        ● {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 3: Hour Range with Clean Steppers (< 11:30 > < 13:00 > in reference) */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.84rem', color: 'rgba(255, 255, 255, 0.5)', width: '70px' }}>
                  Hour
                </span>

                <div style={{ display: 'flex', gap: '10px', flex: 1 }}>
                  {/* Start Time Stepper & Dropdown */}
                  <div style={{ flex: 1, position: 'relative' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: showStartTimeDropdown ? '1px solid #00f2fe' : '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '10px',
                      padding: '8px 10px',
                      transition: 'border 0.2s ease'
                    }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStepStartTime(-15);
                        }}
                        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                      >
                        <ChevronLeft size={15} />
                      </button>

                      <div
                        onClick={() => {
                          setShowEndTimeDropdown(false);
                          setShowStartTimeDropdown(prev => !prev);
                        }}
                        title="Click to select start time"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          color: '#fff',
                          fontSize: '0.88rem',
                          fontWeight: 700,
                          letterSpacing: '0.3px',
                          userSelect: 'none',
                          cursor: 'pointer',
                          padding: '2px 4px',
                          borderRadius: '6px'
                        }}
                      >
                        <span>{format24To12(modalStartTime)}</span>
                        <ChevronDown size={12} color="rgba(255, 255, 255, 0.6)" />
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStepStartTime(15);
                        }}
                        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                      >
                        <ChevronRight size={15} />
                      </button>
                    </div>

                    {/* Start Time Dropdown Menu */}
                    {showStartTimeDropdown && (
                      <div style={{
                        position: 'absolute',
                        top: 'calc(100% + 6px)',
                        left: 0,
                        right: 0,
                        maxHeight: '190px',
                        overflowY: 'auto',
                        background: '#0d1527',
                        border: '1px solid rgba(0, 242, 254, 0.4)',
                        borderRadius: '10px',
                        boxShadow: '0 14px 40px rgba(0, 0, 0, 0.9)',
                        zIndex: 10000,
                        padding: '4px'
                      }}>
                        {TIME_SLOTS.map(slot => {
                          const isSelected = slot.value === modalStartTime;
                          return (
                            <div
                              key={slot.value}
                              onClick={() => handleSelectStartTime(slot.value)}
                              style={{
                                padding: '6px 10px',
                                borderRadius: '6px',
                                fontSize: '0.8rem',
                                fontWeight: isSelected ? 800 : 500,
                                color: isSelected ? '#00f2fe' : '#fff',
                                background: isSelected ? 'rgba(0, 122, 255, 0.25)' : 'transparent',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                transition: 'background 0.12s ease'
                              }}
                              onMouseEnter={e => {
                                if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                              }}
                              onMouseLeave={e => {
                                if (!isSelected) e.currentTarget.style.background = 'transparent';
                              }}
                            >
                              <span>{slot.label}</span>
                              {isSelected && <Check size={12} color="#00f2fe" />}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* End Time Stepper & Dropdown */}
                  <div style={{ flex: 1, position: 'relative' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: showEndTimeDropdown ? '1px solid #00f2fe' : '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '10px',
                      padding: '8px 10px',
                      transition: 'border 0.2s ease'
                    }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStepEndTime(-15);
                        }}
                        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                      >
                        <ChevronLeft size={15} />
                      </button>

                      <div
                        onClick={() => {
                          setShowStartTimeDropdown(false);
                          setShowEndTimeDropdown(prev => !prev);
                        }}
                        title="Click to select end time"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          color: '#fff',
                          fontSize: '0.88rem',
                          fontWeight: 700,
                          letterSpacing: '0.3px',
                          userSelect: 'none',
                          cursor: 'pointer',
                          padding: '2px 4px',
                          borderRadius: '6px'
                        }}
                      >
                        <span>{format24To12(modalEndTime)}</span>
                        <ChevronDown size={12} color="rgba(255, 255, 255, 0.6)" />
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStepEndTime(15);
                        }}
                        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                      >
                        <ChevronRight size={15} />
                      </button>
                    </div>

                    {/* End Time Dropdown Menu */}
                    {showEndTimeDropdown && (
                      <div style={{
                        position: 'absolute',
                        top: 'calc(100% + 6px)',
                        left: 0,
                        right: 0,
                        maxHeight: '190px',
                        overflowY: 'auto',
                        background: '#0d1527',
                        border: '1px solid rgba(0, 242, 254, 0.4)',
                        borderRadius: '10px',
                        boxShadow: '0 14px 40px rgba(0, 0, 0, 0.9)',
                        zIndex: 10000,
                        padding: '4px'
                      }}>
                        {TIME_SLOTS
                          .filter(slot => {
                            const [sh, sm] = modalStartTime.split(':').map(Number);
                            return slot.minutes > sh * 60 + sm;
                          })
                          .map(slot => {
                            const isSelected = slot.value === modalEndTime;
                            return (
                              <div
                                key={slot.value}
                                onClick={() => handleSelectEndTime(slot.value)}
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: '6px',
                                  fontSize: '0.8rem',
                                  fontWeight: isSelected ? 800 : 500,
                                  color: isSelected ? '#00f2fe' : '#fff',
                                  background: isSelected ? 'rgba(0, 122, 255, 0.25)' : 'transparent',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  transition: 'background 0.12s ease'
                                }}
                                onMouseEnter={e => {
                                  if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                                }}
                                onMouseLeave={e => {
                                  if (!isSelected) e.currentTarget.style.background = 'transparent';
                                }}
                              >
                                <span>{slot.label}</span>
                                {isSelected && <Check size={12} color="#00f2fe" />}
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Row 5: Note / Description */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.84rem', color: 'rgba(255, 255, 255, 0.5)', width: '70px', paddingTop: '6px' }}>
                  Note
                </span>
                <textarea
                  value={modalNote}
                  onChange={e => setModalNote(e.target.value)}
                  placeholder="Add Note"
                  rows={2}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '10px',
                    padding: '8px 12px',
                    color: '#fff',
                    fontSize: '0.85rem',
                    outline: 'none',
                    resize: 'none',
                    flex: 1
                  }}
                />
              </div>

              {/* Row 6: Members Avatar Stack + Plus Button */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.84rem', color: 'rgba(255, 255, 255, 0.5)', width: '70px' }}>
                  Members
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                  {/* Selected members avatar stack */}
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {selectedParticipants.slice(0, 4).map((pId, pIdx) => {
                      const m = allMembers.find(item => item._id === pId);
                      const name = m?.communityProfile?.fullName || m?.username || 'Member';
                      return (
                        <div
                          key={pId}
                          title={name}
                          style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #007aff, #a855f7)',
                            border: '2px solid #131b2e',
                            marginLeft: pIdx > 0 ? '-6px' : '0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            color: '#fff',
                            overflow: 'hidden'
                          }}
                        >
                          {m?.communityProfile?.avatarUrl ? (
                            <img src={m.communityProfile.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : name.charAt(0).toUpperCase()}
                        </div>
                      );
                    })}
                  </div>

                  {/* '+' button to open picker */}
                  <button
                    type="button"
                    onClick={() => setShowMemberPicker(prev => !prev)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px dashed rgba(255, 255, 255, 0.25)',
                      borderRadius: '50%',
                      width: '26px',
                      height: '26px',
                      color: '#fff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0
                    }}
                  >
                    <Plus size={13} />
                  </button>

                  <span style={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.45)' }}>
                    {selectedParticipants.length} invited
                  </span>
                </div>
              </div>

              {/* Collapsible Member Search & Selection Box */}
              {showMemberPicker && (
                <div style={{
                  background: 'rgba(0, 0, 0, 0.45)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '12px',
                  padding: '10px',
                  maxHeight: '170px',
                  overflowY: 'auto'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <input
                      type="text"
                      placeholder="Search members..."
                      value={memberSearch}
                      onChange={e => setMemberSearch(e.target.value)}
                      style={{
                        width: '100%',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        color: '#fff',
                        fontSize: '0.8rem',
                        outline: 'none'
                      }}
                    />
                  </div>

                  {checkingAvailability && (
                    <div style={{ fontSize: '0.72rem', color: '#00f2fe', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={11} className="animate-spin" /> Refreshing schedule availability...
                    </div>
                  )}

                  {allMembers
                    .filter(m => {
                      if (!memberSearch.trim()) return true;
                      const name = (m.communityProfile?.fullName || m.username || '').toLowerCase();
                      return name.includes(memberSearch.toLowerCase());
                    })
                    .map(m => {
                      const isSel = selectedParticipants.includes(m._id);
                      const isBusy = busyUserIds.includes(m._id);
                      const name = m.communityProfile?.fullName || m.username;
                      const initial = name.charAt(0).toUpperCase();

                      return (
                        <div
                          key={m._id}
                          onClick={() => !isBusy && handleToggleMember(m._id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 8px',
                            borderRadius: '8px',
                            background: isBusy
                              ? 'rgba(255, 77, 77, 0.06)'
                              : isSel
                              ? 'rgba(0, 122, 255, 0.2)'
                              : 'transparent',
                            cursor: isBusy ? 'not-allowed' : 'pointer',
                            fontSize: '0.8rem',
                            opacity: isBusy ? 0.6 : 1,
                            marginBottom: '3px',
                            transition: 'all 0.15s ease'
                          }}
                          title={isBusy ? `${name} has a conflicting meeting scheduled at this time` : name}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                              width: '22px',
                              height: '22px',
                              borderRadius: '50%',
                              background: isBusy ? '#475569' : 'linear-gradient(135deg, #007aff, #00f2fe)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              color: '#fff',
                              overflow: 'hidden'
                            }}>
                              {m.communityProfile?.avatarUrl ? (
                                <img src={m.communityProfile.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : initial}
                            </div>
                            <span style={{ fontWeight: 600, color: isBusy ? 'rgba(255, 255, 255, 0.55)' : '#fff' }}>
                              {name}
                            </span>
                            {isBusy && (
                              <span style={{
                                fontSize: '0.66rem',
                                color: '#ff4d4d',
                                background: 'rgba(255, 77, 77, 0.15)',
                                border: '1px solid rgba(255, 77, 77, 0.3)',
                                padding: '1px 6px',
                                borderRadius: '6px',
                                fontWeight: 700
                              }}>
                                Busy (Time Conflict)
                              </span>
                            )}
                          </div>

                          {isBusy ? (
                            <span style={{ fontSize: '0.68rem', color: '#ff4d4d', fontWeight: 600 }}>
                              Unavailable
                            </span>
                          ) : (
                            <div style={{
                              width: '16px',
                              height: '16px',
                              borderRadius: '4px',
                              border: isSel ? '1px solid #00f2fe' : '1px solid rgba(255,255,255,0.3)',
                              background: isSel ? '#00f2fe' : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              {isSel && <Check size={11} color="#000" />}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}

              {/* Save Button (Reference blue pill button) */}
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    background: 'linear-gradient(135deg, #007aff 0%, #00c6ff 100%)',
                    border: 'none',
                    borderRadius: '20px',
                    padding: '10px 48px',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: '0.92rem',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 18px rgba(0, 122, 255, 0.45)',
                    opacity: isSubmitting ? 0.7 : 1,
                    transition: 'transform 0.15s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                  {isSubmitting ? 'Saving...' : editingCallId ? 'Save Changes' : 'Save'}
                </button>
              </div>

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
