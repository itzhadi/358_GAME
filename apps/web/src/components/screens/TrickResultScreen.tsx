'use client';

import { Button } from '@/components/ui/button';
import { PlayingCard } from '@/components/PlayingCard';
import { useGameStore } from '@/store/gameStore';
import { cn } from '@/lib/utils';

export function TrickResultScreen() {
  const { gameState, lastTrickWinner, dismissTrickResult, aiSeats } = useGameStore();
  if (!gameState || lastTrickWinner === null) return null;

  const lastTrick = gameState.tricksHistory[gameState.tricksHistory.length - 1];
  if (!lastTrick) return null;

  const winner = gameState.players[lastTrickWinner];
  const hasAI = aiSeats.size > 0;

  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-center p-6 text-center animate-fade-in"
      style={{ background: 'radial-gradient(ellipse at 50% 40%, hsla(265, 40%, 12%, 0.98) 0%, hsla(230, 25%, 7%, 0.99) 70%)' }}>

      <div className="glass rounded-3xl p-6 max-w-sm w-full animate-scale-in">
        <div className="text-xs text-muted-foreground mb-2">לקיחה {lastTrick.trickNumber}/16</div>
        <h2 className="text-2xl font-black text-gradient-gold mb-5">
          🏆 {winner.name} {hasAI && aiSeats.has(lastTrickWinner) ? '🤖' : ''}
        </h2>

        <div className="flex justify-center gap-3 mb-6">
          {lastTrick.cardsPlayed.map((cp) => (
            <div key={cp.card.id} className="text-center">
              <p className={cn(
                'text-[10px] mb-1 font-medium',
                cp.seatIndex === lastTrickWinner ? 'text-amber-400' : 'text-muted-foreground',
              )}>
                {gameState.players[cp.seatIndex].name}
              </p>
              <PlayingCard
                card={cp.card}
                highlight={cp.seatIndex === lastTrickWinner}
              />
            </div>
          ))}
        </div>

        <div className="space-y-1.5 mb-6">
          {gameState.players.map((p, i) => {
            const taken = gameState.tricksTakenCount[i];
            const target = gameState.targets[i];
            const pct = Math.min(100, (taken / target) * 100);
            return (
              <div key={p.id} className="flex items-center gap-2 text-sm">
                <span className="font-medium w-16 text-right truncate">
                  {p.name} {hasAI && aiSeats.has(i) ? '🤖' : ''}
                </span>
                <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      taken >= target ? 'bg-gradient-to-l from-green-400 to-emerald-500' : 'progress-bar',
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="font-mono font-bold text-xs w-10 text-left">
                  {taken}/{target}
                </span>
              </div>
            );
          })}
        </div>

        <Button size="lg" variant="glow" onClick={dismissTrickResult} className="w-full rounded-2xl">
          {gameState.phase === 'HAND_SCORING' ? 'ניקוד יד →' : gameState.phase === 'GAME_OVER' ? 'תוצאות! 🏆' : 'המשך'}
        </Button>
      </div>
    </div>
  );
}
