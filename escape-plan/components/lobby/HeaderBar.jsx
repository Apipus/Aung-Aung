'use client';

import { useRouter } from "next/navigation";

export default function HeaderBar({ online }) {
  const router = useRouter();
  return (
    <div className="relative w-full max-w-6xl flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          className="px-3 py-2 text-sm font-extrabold rounded-lg border bg-[var(--bg-tertiary)] hover:bg-neutral-200"
          onClick={() => router.push("/name")}
        >
          ← BACK
        </button>
      </div>

      <h1 className="absolute left-1/2 -translate-x-1/2 holtwood-title text-4xl md:text-5xl tracking-wide">RUN FOR IT!</h1>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-neutral-400">
          <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
          <span>{online} PLAYERS ONLINE</span>
        </div>
        <button className="p-2 rounded-full hover:bg-neutral-100" aria-label="settings">⋮</button>
      </div>

    </div>
  );
}