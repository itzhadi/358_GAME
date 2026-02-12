'use client';

import { useState } from 'react';
import { GameState } from '@358/shared';
import { SuitIcon } from './PlayingCard';
import { useGameStore } from '@/store/gameStore';
import { cn } from '@/lib/utils';

interface GameStatusBarProps {
  gameState: GameState;
  aiSeats: Set<number>;
}

export function GameStatusBar({ gameState, aiSeats }: GameStatusBarProps) {
  const { resetGame } = useGameStore();
  const [expanded, setExpanded] = useState(false);
  const hasAI = aiSeats.size > 0;
  const { players, targets, tricksTakenCount, scoreTotal, victoryTarget, cutterSuit, trickNumber, handNumber, phase } = gameState;

  const showTricks = ['TRICK_PLAY', 'HAND_SCORING', 'GAME_OVER'].includes(phase);
  const showCutter = !!cutterSuit && phase !== 'SETUP_DEAL';

  return (
    <div className="w-full glass-strong border-b border-white/10 z-30 relative">
      {/* Compact bar — always visible */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full grid grid-cols-[auto_1fr_auto] items-center px-3 py-2 text-xs"
      >
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground font-medium">יד {Math.max(handNumber, 1)}</span>
          {showCutter && (
            <span className="flex items-center gap-1.5">
              <span className="text-muted-foreground">חותך</span>
              <SuitIcon suit={cutterSuit!} className="text-xl" />
            </span>
          )}
          {showTricks && (
            <span className="text-muted-foreground">
              לקיחה <span className="text-purple-400 font-bold">{trickNumber}</span>/16
            </span>
          )}
        </div>

        <div className="flex items-center justify-center gap-2">
          {players.map((p, i) => {
            const taken = tricksTakenCount[i];
            const target = targets[i];
            const isActive = gameState.currentPlayerIndex === i;
            const isOver = taken > target;
            const isMet = taken === target;
            const targetColor = target === 8 ? 'text-amber-400' : target === 5 ? 'text-purple-400' : 'text-cyan-400';
            return (
              <span
                key={p.id}
                className={cn(
                  'flex items-center gap-1 px-1.5 py-0.5 rounded-md transition-all',
                  isActive ? 'bg-purple-500/20' : '',
                )}
              >
                <span className="text-[10px] text-slate-400 truncate max-w-[50px]">{p.name}</span>
                <span className={cn(
                  'font-mono font-bold',
                  isOver ? 'text-green-400' : isMet && showTricks ? 'text-amber-400' : targetColor,
                )}>
                  {showTricks ? `${taken}/${target}` : target}
                </span>
              </span>
            );
          })}
        </div>

        <span className={cn('transition-transform text-muted-foreground', expanded && 'rotate-180')}>▾</span>
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div className="px-3 pb-3 animate-fade-in">
          <div className="glass rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[1fr_40px_50px_50px] gap-1 px-3 py-2 text-[10px] font-bold text-muted-foreground border-b border-white/5">
              <div>שחקן</div>
              <div className="text-center">יעד</div>
              <div className="text-center">{showTricks ? 'לקח' : '—'}</div>
              <div className="text-center">ניקוד</div>
            </div>
            {/* Players */}
            {players.map((p, i) => {
              const target = targets[i];
              const taken = tricksTakenCount[i];
              const total = scoreTotal[i];
              const isActive = gameState.currentPlayerIndex === i;
              const delta = taken - target;
              const isAI = hasAI && aiSeats.has(i);
              const targetColor = target === 8 ? 'text-amber-400' : target === 5 ? 'text-purple-400' : 'text-cyan-400';

              return (
                <div
                  key={p.id}
                  className={cn(
                    'grid grid-cols-[1fr_40px_50px_50px] gap-1 px-3 py-2.5 border-b border-white/5 last:border-0 text-sm',
                    isActive && 'bg-purple-500/5',
                  )}
                >
                  <div className="flex items-center gap-1.5 font-bold truncate">
                    <span className="text-xs">{isAI ? '🤖' : '👤'}</span>
                    <span className="truncate">{p.name}</span>
                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />}
                  </div>
                  <div className={cn('text-center font-black', targetColor)}>{target}</div>
                  <div className="text-center">
                    {showTricks ? (
                      <span className={cn(
                        'font-bold',
                        delta > 0 ? 'text-green-400' : delta === 0 && taken > 0 ? 'text-amber-400' : '',
                      )}>
                        {taken}
                      </span>
                    ) : '—'}
                  </div>
                  <div className="text-center">
                    <span className="font-mono font-bold">{total}</span>
                    <span className="text-muted-foreground text-[10px]">/{victoryTarget}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm('בטוח שאתה רוצה לצאת מהמשחק?')) resetGame();
            }}
            className="mt-3 w-full py-2.5 rounded-xl text-sm font-bold text-rose-400 hover:text-rose-300 glass hover:bg-rose-500/10 transition-all border border-rose-500/20"
          >
            🚪 יציאה מהמשחק
          </button>
        </div>
      )}
    </div>
  );
}
