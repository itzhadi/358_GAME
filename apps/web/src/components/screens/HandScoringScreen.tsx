'use client';

import { Button } from '@/components/ui/button';
import { useGameStore } from '@/store/gameStore';
import { cn } from '@/lib/utils';

export function HandScoringScreen() {
  const { gameState, dispatch, aiSeats, mode, playerSeat } = useGameStore();
  if (!gameState) return null;

  const hasAI = aiSeats.size > 0;
  const isOnline = mode === 'online';
  const isDealer = isOnline && playerSeat === gameState.dealerIndex;
  const canAdvance = !isOnline || isDealer;

  const handleNextHand = () => {
    dispatch({ type: 'NEXT_HAND' });
  };

  return (
    <div className="flex flex-col items-center flex-1 p-4 pb-24 text-center animate-scale-in relative overflow-y-auto">
      <div className="absolute top-[5%] right-[-5%] w-[250px] h-[250px] rounded-full bg-purple-600/10 blur-[100px] pointer-events-none" />

      <h2 className="text-2xl font-black text-gradient-primary mb-1">סיכום יד {gameState.handNumber}</h2>
      <p className="text-sm text-muted-foreground mb-6">תוצאות הלקיחות</p>

      <div className="glass rounded-3xl p-5 mb-6 w-full max-w-sm">
        <div className="grid grid-cols-4 gap-2 text-xs font-bold text-muted-foreground pb-3 mb-3 border-b border-white/5">
          <div>שחקן</div>
          <div>יעד</div>
          <div>לקח</div>
          <div>+/−</div>
        </div>
        {gameState.players.map((p, i) => {
          const delta = gameState.lastHandDelta[i];
          const isAI = hasAI && aiSeats.has(i);
          return (
            <div key={p.id} className="grid grid-cols-4 gap-2 text-sm py-2.5 border-b border-white/5 last:border-0">
              <div className="font-bold flex items-center gap-1">
                {isAI && <span className="text-xs">🤖</span>}
                {p.name}
              </div>
              <div className="text-muted-foreground">{gameState.targets[i]}</div>
              <div className="font-semibold">{gameState.tricksTakenCount[i]}</div>
              <div className={cn('font-black text-base', {
                'text-green-400': delta > 0,
                'text-rose-400': delta < 0,
                'text-muted-foreground': delta === 0,
              })}>
                {delta > 0 ? `+${delta}` : delta}
              </div>
            </div>
          );
        })}
      </div>

      <div className="glass rounded-3xl p-5 mb-8 w-full max-w-sm">
        <h3 className="font-bold mb-4 text-sm">ניקוד מצטבר</h3>
        {gameState.players.map((p, i) => {
          const total = gameState.scoreTotal[i];
          const pct = Math.max(0, Math.min(100, (total / gameState.victoryTarget) * 100));
          const isLeading = total === Math.max(...gameState.scoreTotal) && total > 0;
          const isAI = hasAI && aiSeats.has(i);
          return (
            <div key={p.id} className="mb-3 last:mb-0">
              <div className="flex justify-between text-sm mb-1.5">
                <span className="font-medium flex items-center gap-1">
                  {isAI && <span className="text-xs">🤖</span>}
                  {p.name}
                </span>
                <span className={cn(
                  'font-mono font-bold',
                  isLeading ? 'text-purple-400' : '',
                )}>
                  {total} <span className="text-muted-foreground font-normal">/ {gameState.victoryTarget}</span>
                </span>
              </div>
              <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-700 ease-out',
                    isLeading
                      ? 'bg-gradient-to-l from-purple-500 to-blue-500 shadow-lg shadow-purple-500/20'
                      : 'bg-gradient-to-l from-slate-500 to-slate-600',
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {canAdvance ? (
        <Button size="lg" variant="glow" onClick={handleNextHand} className="text-lg px-12 rounded-2xl">
          יד הבאה ➡️
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground animate-pulse">ממתין שהדילר ימשיך...</p>
      )}
    </div>
  );
}
