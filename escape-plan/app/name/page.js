"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { getNickname, setNickname } from "@/lib/nickname";

export default function EnterNamePage() {
  const router = useRouter();
  const [nickname, setNick] = useState("");

  useEffect(() => {
    const s = getNickname();
    if (s) setNick(s);
  }, []);

  const onSubmit = (e) => {
    e.preventDefault();
    const t = nickname.trim();
    if (!t) return;
    setNickname(t);
    router.push("/lobby");
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 -translate-y-10">
      <div className="mb-2 flex flex-col items-center justify-center">
        {/* I want to add .gif here */}
        <Image
          src="https://tenor.com/en-GB/view/stick-figure-running-hurry-gif-12649974.gif"
          alt="Stick figure running"
          width={250}
          height={250}
          priority // ensures it loads early for good LCP
          unoptimized // disable optimization for GIF animation
          className="mb-2 rounded-lg"
        />
        <h1 className="holtwood-title text-6xl font-extrabold">Run For It!</h1>
      </div>
      <div className="w-full max-w-md bg-[var(--bg-secondary)] rounded-2xl border border-[#959595] p-6 space-y-2 flex flex-col items-center justify-center text-center">
        <p className="text-base font-extrabold text-[var(--text-primary)]">
          CHOOSE A NICKNAME
        </p>
        <form onSubmit={onSubmit} className="space-y-6">
          <input
            value={nickname}
            onChange={(e) => setNick(e.target.value)}
            placeholder="CoolNickname123"
            maxLength={20}
            className="w-xs border border-neutral-400 rounded-md px-3 py-1 text-lg font-bold bg-[var(--bg-primary)] text-[var(--text-primary)]"
          />
          <Button
            type="submit"
            className="w-1/2 bg-white hover:bg-[var(--accent)] hover:text-[var(--bg-primary)] text-base font-extrabold text-[var(--text-primary)] border-b-4 shadow-xs active:scale-95 transition"
          >
            START
          </Button>
        </form>
      </div>
    </main>
  );
}
