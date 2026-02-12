'use client';

import { useState } from 'react';
import { GameState, Suit } from '@358/shared';
import { cn } from '@/lib/utils';

const SUIT_SYMBOLS: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
const isRed = (suit: Suit) => suit === 'H' || suit === 'D';

interface TrickHistoryProps {
  gameState: GameState;
  aiSeats: Set<number>;
}

function MiniCard({ rank, suit, isWinner }: { rank: string; suit: Suit; isWinner: boolean }) {
  const red = isRed(suit);
  return (
    <div
      className={cn(
        'w-[56px] h-[78px] rounded-lg flex flex-col items-center justify-center gap-0.5',
        'bg-gradient-to-br from-white to-gray-100 shadow-md border',
        isWinner
          ? 'border-amber-400 ring-1 ring-amber-400/50 scale-110 z-10'
          : 'border-gray-300/50',
      )}
    >
      <span className={cn(
        'text-base font-black leading-none',
        red ? 'text-rose-600' : 'text-gray-800',
      )}>
        {rank}
      </span>
      <span className={cn(
        'text-xl leading-none',
        red ? 'text-rose-500' : 'text-gray-700',
      )}>
        {SUIT_SYMBOLS[suit]}
      </span>
    </div>
  );
}

export function TrickHistory({ gameState, aiSeats }: TrickHistoryProps) {
  const [expanded, setExpanded] = useState(true);
  const { tricksHistory, players, cutterSuit } = gameState;

  if (tricksHistory.length === 0) return null;

  const lastTricks = [...tricksHistory].reverse();

  return (
    <div className={cn(
      'fixed top-14 right-2 z-50 transition-all duration-300',
      expanded ? 'w-[calc(100vw-1rem)] sm:w-[380px]' : 'w-auto',
    )}>
      {/* Collapsed: badge */}
      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="glass-strong rounded-xl px-4 py-2.5 border border-white/10 hover:border-purple-500/30 transition-all flex items-center gap-2 shadow-lg"
        >
          <span className="text-lg">📜</span>
          <span className="text-sm font-bold text-slate-300">{tricksHistory.length}</span>
        </button>
      )}

      {/* Expanded: scrollable list with mini cards */}
      {expanded && (
        <div className="glass-strong rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <span className="text-sm font-bold text-purple-300">📜 היסטוריה</span>
            <button
              onClick={() => setExpanded(false)}
              className="text-muted-foreground hover:text-white text-sm px-1"
            >
              ✕
            </button>
          </div>

          {/* Tricks */}
          <div className="max-h-[70vh] overflow-y-auto p-3 space-y-3">
            {lastTricks.map((trick) => {
              const winner = trick.winnerIndex;
              return (
                <div key={trick.trickNumber} className="rounded-xl bg-white/[0.03] border border-white/5 p-3">
                  {/* Trick header */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground font-medium">#{trick.trickNumber}</span>
                    <span className="text-sm font-bold text-amber-400">
                      🏆 {players[winner].name}
                    </span>
                  </div>

                  {/* Cards row */}
                  <div className="flex items-end justify-center gap-2">
                    {trick.cardsPlayed.map((cp) => (
                      <div key={cp.card.id} className="flex flex-col items-center gap-1">
                        <span className="text-xs text-muted-foreground truncate max-w-[56px]">
                          {players[cp.seatIndex].name.slice(0, 5)}
                        </span>
                        <MiniCard
                          rank={cp.card.rank}
                          suit={cp.card.suit}
                          isWinner={cp.seatIndex === winner}
                        />
                      </div>
                    ))}
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
