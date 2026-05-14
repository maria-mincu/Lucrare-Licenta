import React from 'react';

export default function AccessDenied({ message }) {
  return (
    <div className="empty-state" style={{ padding: 40 }}>
      <div className="es-icon">🚫</div>
      <h2 style={{ marginTop: 12, color: '#111827' }}>Acces restricționat</h2>
      <p style={{ marginTop: 10, color: '#475569', maxWidth: 460, lineHeight: 1.6 }}>
        {message || 'Nu ai permisiunile necesare pentru a accesa această pagină.'}
      </p>
    </div>
  );
}
