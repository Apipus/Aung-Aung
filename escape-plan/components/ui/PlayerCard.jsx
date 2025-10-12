'use client';
import React from 'react';
import { Shield, User } from 'lucide-react';

/**
 * Props:
 * - warderName: string
 * - prisonerName: string
 * - currentTurn: 'warder' | 'prisoner' | ''
 */
export default function PlayerCard({ warderName, prisonerName, currentTurn }) {
  const highlight =
    'font-semibold text-blue-600 dark:text-blue-400 animate-pulse';

  return (
    <div className="flex items-center justify-between w-full bg-white/70 backdrop-blur border border-neutral-200 shadow-sm rounded-2xl p-4 mb-4">
      {/* Warder */}
      <div className="flex items-center gap-2">
        <Shield className="text-red-500 w-5 h-5" />
        <div className="text-sm">
          <span className={currentTurn === 'warder' ? highlight : 'font-medium'}>
            {warderName || 'Waiting...'}
          </span>
          <div className="text-xs text-neutral-500">Warder 🔒</div>
        </div>
      </div>

      {/* VS separator */}
      <div className="text-lg font-bold text-neutral-600">VS</div>

      {/* Prisoner */}
      <div className="flex items-center gap-2">
        <div className="text-sm text-right">
          <span className={currentTurn === 'prisoner' ? highlight : 'font-medium'}>
            {prisonerName || 'Waiting...'}
          </span>
          <div className="text-xs text-neutral-500">Prisoner 🧍</div>
        </div>
        <User className="text-emerald-500 w-5 h-5" />
      </div>
    </div>
  );
}