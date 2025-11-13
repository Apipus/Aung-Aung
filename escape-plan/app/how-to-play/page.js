"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/button";

export default function HowToPlayPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 -translate-y-6 text-[var(--text-primary)]">
      <div className="relative mb-6">
        <h1 className="holtwood-title text-5xl font-extrabold">How to Play</h1>
      </div>

      <div className="w-full max-w-4xl p-6 space-y-6 bg-[var(--bg-secondary)] rounded-2xl border border-[#959595]">
        <section className="space-y-2">
          <h2 className="text-2xl font-semibold">Objective</h2>
          <p className="text-sm text-[var(--text-primary)]">
            Two-player board game: the <strong>Warder</strong> tries to catch the <strong>Prisoner</strong>, while the Prisoner
            tries to reach the tunnel to escape. Players take turns moving one cell
            (up/down/left/right) per turn. Each turn has a limited time.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-2xl font-semibold">Controls</h2>
          <ul className="list-disc pl-6 text-sm">
            <li>Click a highlighted cell to move there when it's your turn.</li>
            <li>The turn timer is shown at the top — time runs out and the turn skips if you don't move.</li>
            <li>Some cells contain special items (icons) — stepping on them triggers effects immediately.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-2xl font-semibold">Items</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="panel p-4 text-center">
              <div className="text-3xl mb-2">🔁</div>
              <h3 className="font-bold">Move Tunnel</h3>
              <p className="text-sm text-[var(--text-primary)]">
                When picked, the tunnel (escape cell) moves to a new free location. The server tries to place it where the Prisoner can still reach it.
              </p>
            </div>

            <div className="panel p-4 text-center">
              <div className="text-3xl mb-2">⭐</div>
              <h3 className="font-bold">Extra Round</h3>
              <p className="text-sm text-[var(--text-primary)]">
                Grants the picker an extra turn in the current match. The extra turn is consumed automatically when your next turn comes up.
              </p>
            </div>

            <div className="panel p-4 text-center">
              <div className="text-3xl mb-2">🧱</div>
              <h3 className="font-bold">Move Obstacle</h3>
              <p className="text-sm text-[var(--text-primary)]">
                A two-step interactive item. When picked, both players see a banner. The picker chooses an existing obstacle to move, then chooses a destination cell.
                Each phase has a 15-second limit. Destinations must be free (not an obstacle, not the tunnel, and not occupied by a player).
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-2xl font-semibold">Move-Obstacle Flow (details)</h2>
          <ol className="list-decimal pl-6 text-sm space-y-1">
            <li>Pick up the 🧱 item by moving onto its cell.</li>
            <li>Both players see a non-blocking banner with a countdown; the picker is highlighted.</li>
            <li>The picker clicks any obstacle cell to select it (server validates it's an obstacle).</li>
            <li>The picker then clicks a destination cell (server validates it's allowed). If valid, the obstacle is moved and the board updates for everyone.</li>
            <li>If the picker fails to select within 15s in either phase, the action times out and is cancelled.</li>
          </ol>
        </section>

        <section className="space-y-2">
          <h2 className="text-2xl font-semibold">Tips & Rules</h2>
          <ul className="list-disc pl-6 text-sm">
            <li>Obstacles block movement and pathfinding.</li>
            <li>The Warder cannot move into the tunnel cell.</li>
            <li>Items only trigger when a player moves onto the item's cell.</li>
            <li>If the board becomes crowded there may be fewer than three items spawned.</li>
          </ul>
        </section>

        <div className="flex justify-end">
          <Button onClick={() => router.push('/lobby')} className="bg-white hover:bg-[var(--accent)] hover:text-[var(--bg-primary)] text-base font-extrabold text-[var(--text-primary)] border-b-4 shadow-xs active:scale-95 transition">
            Back to Lobby
          </Button>
        </div>
      </div>
    </main>
  );
}
