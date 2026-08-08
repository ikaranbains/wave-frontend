'use client';

import React from 'react';
import { X, HelpCircle } from 'lucide-react';

export const HelpModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex select-none items-center justify-center bg-black/50 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div className="scroll-touch max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-outline-variant bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4 border-b border-surface-container pb-3">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-base text-on-surface">Help & Keyboard Shortcuts</h3>
          </div>
          <button onClick={onClose} className="text-outline hover:text-on-surface">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 text-xs text-on-surface-variant">
          <div className="flex justify-between items-center py-1.5 border-b border-surface-container/60">
            <span>Send Message</span>
            <kbd className="px-2 py-0.5 bg-surface-container-low border border-outline-variant rounded font-mono text-[10px]">Enter</kbd>
          </div>
          <div className="flex justify-between items-center py-1.5 border-b border-surface-container/60">
            <span>Global Search</span>
            <kbd className="px-2 py-0.5 bg-surface-container-low border border-outline-variant rounded font-mono text-[10px]">Ctrl + K / Cmd + K</kbd>
          </div>
          <div className="flex justify-between items-center py-1.5 border-b border-surface-container/60">
            <span>Switch to Messages</span>
            <kbd className="px-2 py-0.5 bg-surface-container-low border border-outline-variant rounded font-mono text-[10px]">Alt + 1</kbd>
          </div>
          <div className="flex justify-between items-center py-1.5 border-b border-surface-container/60">
            <span>Switch to Contacts</span>
            <kbd className="px-2 py-0.5 bg-surface-container-low border border-outline-variant rounded font-mono text-[10px]">Alt + 2</kbd>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-surface-container text-center">
          <p className="text-[11px] text-outline">Wave v1.0.0 — Your people, a tap away.</p>
        </div>
      </div>
    </div>
  );
};
