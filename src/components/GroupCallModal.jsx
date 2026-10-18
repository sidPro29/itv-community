import React, { useState } from 'react';
import { Users, Video, PhoneCall, Search, Check, X } from 'lucide-react';

export default function GroupCallModal({
  isOpen,
  onClose,
  members = [],
  onStartCall
}) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [callType, setCallType] = useState('video');

  if (!isOpen) return null;

  const filteredMembers = members.filter(m => 
    m.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleStart = () => {
    if (selectedIds.length === 0) return;
    onStartCall({
      selectedUserIds: selectedIds,
      callType
    });
    setSelectedIds([]);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(3, 5, 12, 0.75)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      <div style={{
        width: '92%',
        maxWidth: '480px',
        background: '#0d1326',
        borderRadius: '24px',
        border: '1px solid rgba(0, 242, 254, 0.25)',
        boxShadow: '0 24px 60px rgba(0,0,0,0.85)',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '85vh',
        color: '#fff'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'rgba(0, 242, 254, 0.12)',
              border: '1px solid rgba(0, 242, 254, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-cyan, #00f2fe)'
            }}>
              <Users size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>New Group Call</h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>
                Select members to invite to a call
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Call Type Switcher */}
        <div style={{
          display: 'flex',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '14px',
          padding: '4px',
          marginBottom: '16px',
          border: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <button
            onClick={() => setCallType('video')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px',
              borderRadius: '10px',
              border: 'none',
              background: callType === 'video' ? 'linear-gradient(135deg, #00f2fe, #4facfe)' : 'transparent',
              color: callType === 'video' ? '#000' : '#fff',
              fontWeight: 700,
              fontSize: '0.88rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <Video size={16} /> Video Call
          </button>
          <button
            onClick={() => setCallType('audio')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px',
              borderRadius: '10px',
              border: 'none',
              background: callType === 'audio' ? 'linear-gradient(135deg, #00f2fe, #4facfe)' : 'transparent',
              color: callType === 'audio' ? '#000' : '#fff',
              fontWeight: 700,
              fontSize: '0.88rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <PhoneCall size={16} /> Audio Call
          </button>
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative', marginBottom: '14px' }}>
          <Search size={16} color="rgba(255,255,255,0.4)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search members to add..."
            style={{
              width: '100%',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '10px 12px 10px 38px',
              color: '#fff',
              fontSize: '0.9rem',
              outline: 'none'
            }}
          />
        </div>

        {/* Selected Counter */}
        <div style={{
          fontSize: '0.82rem',
          color: 'var(--accent-cyan, #00f2fe)',
          fontWeight: 700,
          marginBottom: '10px'
        }}>
          {selectedIds.length} {selectedIds.length === 1 ? 'member' : 'members'} selected
        </div>

        {/* Members List */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filteredMembers.length === 0 ? (
            <div style={{ padding: '30px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: '0.88rem' }}>
              No members found
            </div>
          ) : (
            filteredMembers.map(member => {
              const isSelected = selectedIds.includes(member._id);
              return (
                <div
                  key={member._id}
                  onClick={() => toggleSelect(member._id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    background: isSelected ? 'rgba(0, 242, 254, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                    borderRadius: '14px',
                    border: `1px solid ${isSelected ? 'rgba(0, 242, 254, 0.35)' : 'rgba(255, 255, 255, 0.05)'}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
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

                  {/* Checkbox indicator */}
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '8px',
                    border: isSelected ? 'none' : '2px solid rgba(255,255,255,0.3)',
                    background: isSelected ? 'var(--accent-cyan, #00f2fe)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#000'
                  }}>
                    {isSelected && <Check size={16} strokeWidth={3} />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer actions */}
        <div style={{ marginTop: '18px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 18px',
              borderRadius: '12px',
              background: 'rgba(255,255,255,0.08)',
              border: 'none',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleStart}
            disabled={selectedIds.length === 0}
            style={{
              padding: '10px 24px',
              borderRadius: '12px',
              background: selectedIds.length === 0 ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #00f2fe, #4facfe)',
              border: 'none',
              color: selectedIds.length === 0 ? 'rgba(255,255,255,0.4)' : '#000',
              fontWeight: 800,
              cursor: selectedIds.length === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: selectedIds.length > 0 ? '0 0 20px rgba(0,242,254,0.4)' : 'none'
            }}
          >
            {callType === 'video' ? <Video size={18} /> : <PhoneCall size={18} />}
            <span>Start Call ({selectedIds.length})</span>
          </button>
        </div>
      </div>
    </div>
  );
}
