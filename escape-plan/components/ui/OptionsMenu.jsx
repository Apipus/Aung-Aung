'use client';
import { useState, useEffect } from 'react';
import { MoreVertical, Sun, Moon, Info } from 'lucide-react';

export default function OptionsMenu() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState('light');

  // Sync with system theme initially
  useEffect(() => {
    const root = document.documentElement;
    if (root.classList.contains('dark')) setTheme('dark');
  }, []);

  const toggleTheme = () => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('dark');
      setTheme('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      setTheme('light');
      localStorage.setItem('theme', 'light');
    }
  };

  const showHowToPlay = () => {
    alert(
      `🕹️ How to Play Escape Plan:\n\n` +
      `• Warder (🔒) tries to capture the Prisoner (🧍)\n` +
      `• Prisoner escapes by reaching the tunnel\n` +
      `• Each player moves one cell (up/down/left/right) per turn\n` +
      `• Warder can't enter tunnel\n` +
      `• Prisoner can move onto Warder\n` +
      `• If time runs out → turn skips\n` +
      `• Winner stays as Warder, next joins as Prisoner`
    );
    setOpen(false);
  };

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-700"
      >
        <MoreVertical className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg overflow-hidden z-50">
          <button
            onClick={() => { toggleTheme(); setOpen(false); }}
            className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700"
          >
            {theme === 'light'
              ? <><Moon className="w-4 h-4" /> Switch to Dark Mode</>
              : <><Sun className="w-4 h-4" /> Switch to Light Mode</>}
          </button>

          <button
            onClick={showHowToPlay}
            className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700"
          >
            <Info className="w-4 h-4" /> How to Play
          </button>
        </div>
      )}
    </div>
  );
}