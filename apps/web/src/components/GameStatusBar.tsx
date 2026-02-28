'use client';

import { useState } from 'react';
import { GameState } from '@358/shared';
import { SuitIcon } from './PlayingCard';
import { cn } from '@/lib/utils';

interface GameStatusBarProps {
  gameState: GameState;
  aiSeats: Set<number>;
}

export function GameStatusBar({ gameState, aiSeats }: GameStatusBarProps) {
  const [expanded, setExpanded] = useState(false);
  const hasAI = aiSeats.size > 0;
  const { players, targets, tricksTakenCount, scoreTotal, victoryTarget, cutterSuit, trickNumber, handNumber, phase } = gameState;

  const showTricks = ['TRICK_PLAY', 'HAND_SCORING', 'GAME_OVER'].includes(phase);
  const showCutter = !!cutterSuit && phase !== 'SETUP_DEAL';

  return (
    <div className="w-full glass-strong border-b border-white/8 z-30 relative">
      <div className="grid grid-cols-[1fr_auto_auto] items-center pl-14 pr-2.5 py-2 text-xs gap-1.5">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <span className="text-muted-foreground font-medium shrink-0">יד {Math.max(handNumber, 1)}</span>
          {showCutter && (
            <span className="flex items-center gap-1 shrink-0 bg-white/5 rounded-full px-2 py-0.5">
              <SuitIcon suit={cutterSuit!} className="text-lg" />
            </span>
          )}
          {showTricks && (
            <span className="text-muted-foreground shrink-0">
              <span className="text-emerald-400 font-bold">{trickNumber}</span>/16
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {players.map((p, i) => {
            const taken = tricksTakenCount[i];
            const target = targets[i];
            const isActive = gameState.currentPlayerIndex === i;
            const isOver = taken > target;
            const isMet = taken === target;
            const targetColor = target === 8 ? 'text-amber-400' : target === 5 ? 'text-emerald-400' : 'text-cyan-400';
            return (
              <span
                key={p.id}
                className={cn(
                  'flex items-center gap-1 px-2 py-0.5 rounded-lg transition-all',
                  isActive ? 'bg-emerald-500/15 ring-1 ring-emerald-500/20' : '',
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

        <button
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            'w-8 h-8 flex items-center justify-center rounded-lg transition-all',
            expanded
              ? 'bg-emerald-500/15 text-emerald-300'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/8',
          )}
          title="טבלת ניקוד"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn('transition-transform', expanded && 'rotate-180')}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-3 animate-fade-in">
          <div className="glass rounded-2xl overflow-hidden">
            <div className="grid grid-cols-[1fr_40px_50px_50px] gap-1 px-3 py-2 text-[10px] font-bold text-muted-foreground border-b border-white/5">
              <div>שחקן</div>
              <div className="text-center">יעד</div>
              <div className="text-center">{showTricks ? 'לקח' : '—'}</div>
              <div className="text-center">ניקוד</div>
            </div>
            {players.map((p, i) => {
              const target = targets[i];
              const taken = tricksTakenCount[i];
              const total = scoreTotal[i];
              const isActive = gameState.currentPlayerIndex === i;
              const delta = taken - target;
              const isAI = hasAI && aiSeats.has(i);
              const targetColor = target === 8 ? 'text-amber-400' : target === 5 ? 'text-emerald-400' : 'text-cyan-400';

              return (
                <div
                  key={p.id}
                  className={cn(
                    'grid grid-cols-[1fr_40px_50px_50px] gap-1 px-3 py-2.5 border-b border-white/5 last:border-0 text-sm',
                    isActive && 'bg-emerald-500/5',
                  )}
                >
                  <div className="flex items-center gap-1.5 font-bold truncate">
                    <span className="text-xs">{isAI ? '🤖' : '👤'}</span>
                    <span className="truncate">{p.name}</span>
                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
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
        </div>
      )}
    </div>
  );
}
