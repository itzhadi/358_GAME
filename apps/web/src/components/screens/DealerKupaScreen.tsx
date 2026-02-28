'use client';

import { Button } from '@/components/ui/button';
import { PlayingCard, SuitIcon } from '@/components/PlayingCard';
import { useGameStore } from '@/store/gameStore';

export function DealerKupaScreen() {
  const { gameState, dismissDealerKupa } = useGameStore();

  if (!gameState) return null;

  const kupaCards = gameState.dealerReceivedKupa;
  const dealer = gameState.players[gameState.dealerIndex];

  return (
    <div className="flex flex-col items-center justify-center flex-1 p-4 text-center relative overflow-hidden">
      <div className="absolute top-[10%] left-[-5%] w-[200px] h-[200px] rounded-full bg-emerald-600/8 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[10%] right-[-5%] w-[200px] h-[200px] rounded-full bg-cyan-600/6 blur-[100px] pointer-events-none" />

      <h2 className="text-xl font-bold mb-1">{dealer.name}</h2>
      <p className="text-muted-foreground text-sm mb-2">
        הקלפים שקיבלת מהקופה
      </p>

      {gameState.cutterSuit && (
        <div className="flex items-center gap-1.5 mb-4">
          <span className="text-xs text-muted-foreground">חותך:</span>
          <SuitIcon suit={gameState.cutterSuit} className="text-xl" />
        </div>
      )}

      <div className="flex gap-3 mb-6">
        {kupaCards.map((card) => (
          <div key={card.id} className="animate-fade-in">
            <PlayingCard card={card} highlight />
          </div>
        ))}
      </div>

      <Button
        size="lg"
        variant="glow"
        className="text-lg rounded-2xl px-8"
        onClick={dismissDealerKupa}
      >
        המשך למשחק ✨
      </Button>
    </div>
  );
}
