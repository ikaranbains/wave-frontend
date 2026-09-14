'use client';

import React from 'react';
import { X, HelpCircle } from 'lucide-react';

export const HelpModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex select-none items-center justify-center bg-black/60 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div className="card scroll-touch max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-2xl p-6">
        <div className="mb-4 flex items-center justify-between border-b border-outline-variant pb-3">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-[18px] w-[18px] text-primary" strokeWidth={1.9} />
            <h3 className="font-display text-lg font-semibold tracking-tight text-on-surface">Help & Keyboard Shortcuts</h3>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-outline transition-colors duration-150 hover:bg-surface-container hover:text-on-surface active:scale-95"
          >
            <X className="h-[18px] w-[18px]" strokeWidth={1.9} />
          </button>
        </div>

        <div className="space-y-3 text-[13px] text-on-surface-variant">
          <div className="flex items-center justify-between border-b border-outline-variant py-1.5">
            <span>Send Message</span>
            <kbd className="rounded-full bg-surface-container px-2.5 py-0.5 font-mono text-[11px] text-on-surface-variant">Enter</kbd>
          </div>
          <div className="flex items-center justify-between border-b border-outline-variant py-1.5">
            <span>Global Search</span>
            <kbd className="rounded-full bg-surface-container px-2.5 py-0.5 font-mono text-[11px] text-on-surface-variant">Ctrl + K / Cmd + K</kbd>
          </div>
          <div className="flex items-center justify-between border-b border-outline-variant py-1.5">
            <span>Switch to Messages</span>
            <kbd className="rounded-full bg-surface-container px-2.5 py-0.5 font-mono text-[11px] text-on-surface-variant">Alt + 1</kbd>
          </div>
          <div className="flex items-center justify-between border-b border-outline-variant py-1.5">
            <span>Switch to Contacts</span>
            <kbd className="rounded-full bg-surface-container px-2.5 py-0.5 font-mono text-[11px] text-on-surface-variant">Alt + 2</kbd>
          </div>
        </div>

        <div className="mt-6 border-t border-outline-variant pt-4 text-center">
          <p className="text-[11px] text-outline">Wave v1.0.0 — Your people, a tap away.</p>
        </div>
      </div>
    </div>
  );
};
