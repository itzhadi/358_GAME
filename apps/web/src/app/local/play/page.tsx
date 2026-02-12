'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { GameBoard } from '@/components/GameBoard';
import { useGameStore } from '@/store/gameStore';

export default function LocalPlayPage() {
  const router = useRouter();
  const { gameState } = useGameStore();

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

  return <GameBoard />;
}
