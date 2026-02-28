'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { GameBoard } from '@/components/GameBoard';
import { useGameStore } from '@/store/gameStore';

export default function LocalPlayPage() {
  const router = useRouter();
  const { gameState, resetGame } = useGameStore();

  useEffect(() => {
    if (!gameState) {
      router.push('/');
    }
  }, [gameState, router]);

  if (!gameState) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh]">
        <p className="text-muted-foreground">טוען...</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => {
          if (confirm('בטוח שאתה רוצה לצאת מהמשחק?')) {
            resetGame();
            router.push('/');
          }
        }}
        className="fixed top-4 left-4 z-50 p-2 glass rounded-full hover:bg-white/10 text-xs text-muted-foreground"
      >
        🚪 יציאה
      </button>
      <GameBoard />
    </div>
  );
}
