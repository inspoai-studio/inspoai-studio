import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import '../../styles/ModeToggle.css';

function PencilSparkles({ size = 16, ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M10 3H8" />
      <path d="m15.007 5.008 3.987 3.986" />
      <path d="M20 15v4" />
      <path d="M21.174 6.813a2.82 2.82 0 0 0-3.986-3.987L3.842 16.175a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
      <path d="M22 17h-4" />
      <path d="M4 5v4" />
      <path d="M6 7H2" />
      <path d="M9 2v2" />
    </svg>
  );
}

export default function ModeToggle({ activeMode }) {
  const navigate = useNavigate();

  return (
    <div className="mode-toggle-container animate-in-up">
      <div className="mode-toggle-pill">
        <button
          type="button"
          className={`mode-toggle-btn ${activeMode === 'design' ? 'active' : ''}`}
          onClick={() => navigate('/agentic-ui')}
        >
          <PencilSparkles size={14} />
          Design Mode
        </button>
        <button
          type="button"
          className={`mode-toggle-btn ${activeMode === 'inspo' ? 'active' : ''}`}
          onClick={() => navigate('/search')}
        >
          <Search size={14} />
          Inspo Mode
        </button>
      </div>
    </div>
  );
}
