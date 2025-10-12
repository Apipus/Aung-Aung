'use client';
import React from 'react';
import { Shield, User } from 'lucide-react';

export default function PlayerCard({ warderName, prisonerName, currentTurn }) {
  const active =
    'font-semibold text-[#1447E6] dark:text-[#FFCC33] animate-pulse';

  return (
    <div className="flex items-center justify-between w-full rounded-2xl border shadow-sm mb-4 px-4 py-3
      bg-[var(--bg-secondary)] border-[var(--border-color)] transition-colors">
      
      {/* Warder */}
      <div className="flex items-center gap-2">
        <Shield className="w-5 h-5 text-[#E64D1A]" />
        <div className="text-sm">
          <span className={currentTurn === 'warder' ? active : 'font-medium'}>
            {warderName || 'Waiting...'}
          </span>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            Warder 🔒
          </div>
        </div>
      </div>

      {/* VS separator */}
      <div className="text-base md:text-lg font-bold text-neutral-600 dark:text-neutral-300">
        VS
      </div>

      {/* Prisoner */}
      <div className="flex items-center gap-2">
        <div className="text-sm text-right">
          <span className={currentTurn === 'prisoner' ? active : 'font-medium'}>
            {prisonerName || 'Waiting...'}
          </span>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            Prisoner 🧍
          </div>
        </div>
        <User className="w-5 h-5 text-[#2EB873]" />
      </div>
    </div>
  );
}