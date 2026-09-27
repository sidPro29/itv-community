import React from 'react';

export default function Footer() {
  return (
    <footer style={{
      borderTop: '1px solid var(--border-glass)',
      padding: '30px 24px',
      marginTop: '60px',
      textAlign: 'center',
      color: 'var(--text-muted)',
      fontSize: '0.85rem'
    }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <p>🚀 <strong>Interplanetary Space Community</strong> — Gated Networking Platform for Verified Space Enthusiasts, Professionals & Entrepreneurs</p>
        <p>© {new Date().getFullYear()} Interplanetary TV. All Rights Reserved.</p>
      </div>
    </footer>
  );
}
