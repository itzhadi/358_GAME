'use client';

import { Button } from '@/components/ui/button';
import { PlayingCard } from '@/components/PlayingCard';
import { useGameStore } from '@/store/gameStore';

export function ReceivedCardsScreen() {
  const { gameState, dismissReceivedCards, aiSeats, activePlayerSeat, mode, playerSeat } = useGameStore();
  if (!gameState || !gameState.exchangeInfo) return null;

  const hasAI = aiSeats.size > 0;
  const isOnline = mode === 'online';
  const humanSeat = isOnline ? (playerSeat ?? 0) : (hasAI ? 0 : activePlayerSeat);
  const { returnedCards } = gameState.exchangeInfo;
  const players = gameState.players;

  const received = returnedCards.filter((r) => r.toSeat === humanSeat);

  const grouped = new Map<number, typeof received>();
  for (const r of received) {
    const from = r.fromSeat;
    if (!grouped.has(from)) grouped.set(from, []);
    grouped.get(from)!.push(r);
  }

  return (
    <div className="flex flex-col items-center flex-1 p-4 pb-24 text-center animate-scale-in relative overflow-y-auto">
      <div className="absolute top-[10%] left-[10%] w-[200px] h-[200px] rounded-full bg-green-500/10 blur-[100px] pointer-events-none" />

      <div className="text-5xl mb-3 animate-float">🎁</div>
      <h2 className="text-2xl font-black text-gradient-primary mb-1">קלפים שהוחזרו לך</h2>
      <p className="text-sm text-muted-foreground mb-6">הקלפים הגבוהים ביותר שהחזירו לך</p>

      <div className="glass rounded-3xl p-5 mb-8 w-full max-w-sm space-y-5">
        {Array.from(grouped.entries()).map(([fromSeat, cards]) => (
          <div key={fromSeat}>
            <p className="text-sm text-muted-foreground mb-3">
              מ<span className="font-bold text-purple-400">{players[fromSeat].name}</span>
              {hasAI && aiSeats.has(fromSeat) && ' 🤖'}:
            </p>
            <div className="flex justify-center gap-3">
              {cards.map((r) => (
                <div key={r.card.id} className="animate-card-play">
                  <PlayingCard card={r.card} highlight />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Button size="lg" variant="glow" onClick={dismissReceivedCards} className="text-lg px-12 rounded-2xl">
        המשך ➡️
      </Button>
    </div>
  );
}
