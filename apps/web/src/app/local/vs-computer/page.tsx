'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import BotIcon from '@/components/BotIcon';
import { useGameStore } from '@/store/gameStore';

const ISRAELI_NAMES = [
  'יוסי', 'דני', 'אבי', 'משה', 'דוד', 'רון', 'גיל', 'איתי',
  'נועם', 'עידו', 'תומר', 'אורי', 'שי', 'עומר', 'ליאור', 'אלון',
  'מיכל', 'שרה', 'נועה', 'מאיה', 'ליאת', 'דנה', 'הדר', 'טל',
  'שירה', 'רוני', 'עדי', 'ניר', 'בן', 'יעל',
];

function pickTwoNames(): [string, string] {
  const shuffled = [...ISRAELI_NAMES].sort(() => Math.random() - 0.5);
  return [shuffled[0], shuffled[1]];
}

export default function VsComputerSetupPage() {
  const router = useRouter();
  const { startLocalGame } = useGameStore();

  const [playerName, setPlayerName] = useState('');
  const [victoryTarget, setVictoryTarget] = useState(10);
  const [aiNames, setAiNames] = useState<[string, string]>(['', '']);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setAiNames(pickTwoNames());
    setMounted(true);
  }, []);

  const canStart = mounted && playerName.trim().length > 0;

  const handleStart = () => {
    const players = [
      { id: 'human-0', name: playerName.trim() },
      { id: 'ai-1', name: aiNames[0] },
      { id: 'ai-2', name: aiNames[1] },
    ];
    startLocalGame(players, victoryTarget, [1, 2]);
    router.push('/local/play');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] py-4 px-6 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[300px] h-[300px] rounded-full bg-purple-600/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[300px] h-[300px] rounded-full bg-blue-600/10 blur-[100px] pointer-events-none" />

      <div className="mb-2 animate-float relative z-10">
        <Image src="/bot-avatar.png" alt="בוט" width={160} height={160} className="drop-shadow-2xl" />
      </div>
      <h1 className="text-2xl font-black text-gradient-primary mb-0.5 relative z-10">שחק סולו</h1>
      <p className="text-muted-foreground text-sm mb-5 relative z-10">שחק נגד 2 בוטים</p>

      <div className="w-full max-w-sm space-y-2.5 mb-5 relative z-10">
        {/* Human player */}
        <div className="glass rounded-2xl p-4 bg-gradient-to-l from-purple-500/20 to-purple-600/10">
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            👤 השם שלך
          </label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="הזן את שמך"
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-purple-500/50 text-lg transition-colors"
            maxLength={20}
            autoFocus
          />
        </div>

        {/* AI opponents */}
        {mounted && aiNames.map((name, i) => (
          <div key={i} className="glass rounded-2xl px-4 py-1.5 bg-gradient-to-l from-slate-500/10 to-slate-600/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BotIcon size={64} />
                <span className="font-bold text-base">{name}</span>
              </div>
              <span className="text-xs glass rounded-full px-3 py-1 text-muted-foreground">
                בוט
              </span>
            </div>
          </div>
        ))}

        {/* Victory target */}
        <div className="glass rounded-2xl px-4 py-3 mt-3">
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            🏆 יעד ניצחון
          </label>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setVictoryTarget((v) => Math.max(1, v - 5))}
              className="w-11 h-11 rounded-xl glass text-lg font-bold active:scale-95 transition-transform hover:bg-white/10"
            >
              −
            </button>
            <span className="text-3xl font-black text-gradient-primary min-w-[3ch] text-center">
              {victoryTarget}
            </span>
            <button
              onClick={() => setVictoryTarget((v) => Math.min(100, v + 5))}
              className="w-11 h-11 rounded-xl glass text-lg font-bold active:scale-95 transition-transform hover:bg-white/10"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 w-full max-w-sm relative z-10">
        <Button
          size="lg"
          variant="glow"
          className="w-full text-lg rounded-2xl"
          disabled={!canStart}
          onClick={handleStart}
        >
          התחל משחק!
        </Button>
        <Button
          variant="ghost"
          onClick={() => router.push('/')}
          className="text-muted-foreground"
        >
          ← חזרה
        </Button>
      </div>
    </div>
  );
}
