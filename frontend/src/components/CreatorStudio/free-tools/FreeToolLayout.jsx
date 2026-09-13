import React from 'react';
import { ArrowLeft } from 'lucide-react';

export default function FreeToolLayout({ children, toolName, onBack }) {
  return (
    <div className="cs-tool-layout-wrapper w-full max-w-5xl mx-auto px-4 pt-24 pb-8">
      <div className="cs-tool-content-body">
        {children}
      </div>
    </div>
  );
}
