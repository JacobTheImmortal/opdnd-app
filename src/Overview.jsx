
// src/Overview.js
import React from 'react';

export default function Overview({ onBack }) {
  return (
    <div style={{ padding: '1rem' }}>
      <button onClick={onBack}>← Back</button>
      <h2>Game Overview</h2>
      <p>
        Description goes here.
      </p>
    </div>
  );
}