'use client';

import { useRouter } from "next/navigation";

export default function HeaderBar({ online, showLeaveButton = false, onLeave = null }) {
  const router = useRouter();
  
  // Default back action, can be overridden by onLeave
  const handleBack = onLeave ? onLeave : () => router.push("/lobby");

  return (
    <div className="relative w-full max-w-6xl flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          className="px-4 py-2 text-sm font-extrabold rounded-lg border bg-[var(--bg-tertiary)] hover:bg-neutral-200 dark:hover:bg-neutral-700"
          onClick={handleBack}
        >
          {showLeaveButton ? 'LEAVE ROOM' : '← BACK'}
        </button>
      </div>

      <h1 className="absolute left-1/2 -translate-x-1/2 holtwood-title text-4xl md:text-5xl tracking-wide">RUN FOR IT!</h1>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-neutral-400">
          <span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span>{online} PLAYERS ONLINE</span>
        </div>
        {/* Settings button is removed for now to simplify UI */}
      </div>
    </div>
  );
}