'use client';

import { Button } from '@/components/ui/button';
import { useGameStore } from '@/store/gameStore';
import BotIcon from '@/components/BotIcon';

export function DealScreen() {
  const { gameState, dispatch, aiSeats, mode, playerSeat } = useGameStore();
  if (!gameState) return null;

  const { players, dealerIndex, handNumber, targets } = gameState;
  const hasAI = aiSeats.size > 0;
  const isOnline = mode === 'online';
  const isDealer = isOnline && playerSeat === dealerIndex;
  const dealerIsAI = isOnline && aiSeats.has(dealerIndex);
  const canDeal = !isOnline || isDealer || dealerIsAI;

  const handleDeal = () => {
    dispatch({ type: 'SHUFFLE_DEAL' });
  };

  const targetColors: Record<number, string> = {
    8: 'from-amber-500 to-orange-500',
    5: 'from-emerald-500 to-teal-500',
    3: 'from-cyan-500 to-blue-500',
  };

  return (
    <div className="flex flex-col items-center justify-center flex-1 p-4 text-center animate-scale-in relative">
      <div className="absolute top-[10%] right-[-5%] w-[250px] h-[250px] rounded-full bg-emerald-600/8 blur-[100px] pointer-events-none" />

      <div className="text-5xl mb-3 animate-float">🎴</div>
      <h2 className="text-2xl font-black text-gradient-primary mb-1">
        {handNumber === 0 ? 'משחק חדש!' : `יד ${handNumber + 1}`}
      </h2>
      <p className="text-muted-foreground text-sm mb-6">חלוקת תפקידים</p>

      <div className="glass rounded-3xl p-5 mb-8 w-full max-w-sm">
        <div className="space-y-3">
          {players.map((p, i) => {
            const isPlayerDealer = i === dealerIndex;
            const target = targets[i];
            const startsFirst = target === 5;
            const isAI = aiSeats.has(i);
            const isMe = isOnline && i === playerSeat;
            const gradient = targetColors[target] || 'from-gray-500 to-gray-600';
            return (
              <div
                key={p.id}
                className={`flex justify-between items-center py-3 px-4 rounded-2xl transition-all ${
                  isPlayerDealer ? 'glass-strong glow-primary' : isMe ? 'glass-strong ring-1 ring-emerald-500/20' : 'glass-card'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{isAI ? <BotIcon size={20} /> : '👤'}</span>
                  <span className="font-bold text-base">{p.name}</span>
                  {isMe && <span className="text-[10px] text-emerald-400">(אתה)</span>}
                  <div className="flex gap-1">
                    {isPlayerDealer && (
                      <span className="text-[10px] bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded-full font-semibold">
                        דילר
                      </span>
                    )}
                    {startsFirst && (
                      <span className="text-[10px] bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full font-semibold">
                        מתחיל
                      </span>
                    )}
                  </div>
                </div>
                <div className={`bg-gradient-to-l ${gradient} text-white font-black text-xl w-10 h-10 rounded-xl flex items-center justify-center shadow-lg`}>
                  {target}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-3 border-t border-white/5">
          <p className="text-xs text-muted-foreground">
            <span className="text-emerald-400">★</span> השחקן עם יעד 5 מתחיל את הלקיחה הראשונה
          </p>
        </div>
      </div>

      {canDeal ? (
        <Button size="lg" variant="glow" onClick={handleDeal} className="text-lg px-12 rounded-2xl">
          חלק קלפים
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground animate-pulse">ממתין שהדילר יחלק קלפים...</p>
      )}
    </div>
  );
}
