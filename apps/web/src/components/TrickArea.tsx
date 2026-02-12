'use client';

import { GameState } from '@358/shared';
import { PlayingCard, SuitIcon } from './PlayingCard';
import { cn } from '@/lib/utils';

interface TrickAreaProps {
  gameState: GameState;
}

export function TrickArea({ gameState }: TrickAreaProps) {
  const { currentTrick, cutterSuit, players, trickNumber, tricksTakenCount, targets } = gameState;

  return (
    <div className="relative glass rounded-3xl p-4 h-56 sm:h-64">
      {/* Top bar with info */}
      <div className="absolute top-2 inset-x-3 flex justify-between items-center text-[10px]">
        <div className="flex items-center gap-1.5 glass rounded-full px-2.5 py-1">
          <span className="text-muted-foreground">לקיחה</span>
          <span className="font-bold text-purple-400">{trickNumber}</span>
          <span className="text-muted-foreground">/16</span>
        </div>
        <div className="flex items-center gap-2">
          {cutterSuit && (
            <div className="flex items-center gap-1.5 glass rounded-full px-2.5 py-1">
              <span className="text-muted-foreground">חותך</span>
              <SuitIcon suit={cutterSuit} className="text-lg" />
            </div>
          )}
          {currentTrick?.leadSuit && (
            <div className="flex items-center gap-1.5 glass rounded-full px-2.5 py-1">
              <span className="text-muted-foreground">מוביל</span>
              <SuitIcon suit={currentTrick.leadSuit} className="text-lg" />
            </div>
          )}
        </div>
      </div>

      {/* Played cards — center */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex gap-2 sm:gap-3">
          {currentTrick?.cardsPlayed.map((cp, i) => (
            <div key={cp.card.id} className="text-center animate-card-play">
              <p className="text-xs text-muted-foreground mb-1 font-medium truncate max-w-[66px]">
                {players[cp.seatIndex].name}
              </p>
              <PlayingCard card={cp.card} small />
            </div>
          ))}

          {(!currentTrick || currentTrick.cardsPlayed.length === 0) && (
            <div className="text-muted-foreground/40 text-sm animate-pulse-soft">
              ממתין לקלף ראשון...
            </div>
          )}
        </div>
      </div>

      {/* Score pills at bottom */}
      <div className="absolute bottom-2 inset-x-3 flex justify-center gap-2">
        {players.map((p, i) => {
          const isActive = gameState.currentPlayerIndex === i;
          const taken = tricksTakenCount[i];
          const target = targets[i];
          const isOver = taken > target;
          const isMet = taken === target;
          return (
            <div
              key={p.id}
              className={cn(
                'px-2.5 py-1 rounded-full text-[10px] font-medium transition-all',
                isActive
                  ? 'glass glow-primary text-purple-300'
                  : 'glass-card text-muted-foreground',
              )}
            >
              <span className="font-bold">{p.name}</span>
              <span className="mx-1">·</span>
              <span className={cn(
                'font-mono font-bold',
                isOver ? 'text-green-400' : isMet ? 'text-amber-400' : '',
              )}>
                {taken}/{target}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
