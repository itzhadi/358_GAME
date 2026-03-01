'use client';

import { Button } from '@/components/ui/button';
import { PlayingCard } from '@/components/PlayingCard';
import { useGameStore } from '@/store/gameStore';
import BotIcon from '@/components/BotIcon';

export function ReceivedCardsScreen() {
  const { gameState, dismissReceivedCards, aiSeats, activePlayerSeat, mode, playerSeat } = useGameStore();
  if (!gameState || !gameState.exchangeInfo) return null;

  const hasAI = aiSeats.size > 0;
  const isOnline = mode === 'online';
  const humanSeat = isOnline ? (playerSeat ?? 0) : (hasAI ? 0 : activePlayerSeat);
  const { givenCards, returnedCards } = gameState.exchangeInfo;
  const players = gameState.players;

  // Cards returned TO the human (human was positive → others return high cards)
  const returnedToMe = returnedCards.filter((r) => r.toSeat === humanSeat);
  // Cards given TO the human (human was negative → others gave cards)
  const givenToMe = givenCards.filter((g) => g.toSeat === humanSeat);
  // Cards returned BY the human (human was negative → human returns high cards)
  const returnedByMe = returnedCards.filter((r) => r.fromSeat === humanSeat);

  const humanWasNegative = givenToMe.length > 0 && returnedByMe.length > 0;
  const humanWasPositive = returnedToMe.length > 0;

  // Group returnedToMe by fromSeat
  const groupedReturned = new Map<number, typeof returnedToMe>();
  for (const r of returnedToMe) {
    if (!groupedReturned.has(r.fromSeat)) groupedReturned.set(r.fromSeat, []);
    groupedReturned.get(r.fromSeat)!.push(r);
  }

  return (
    <div className="flex flex-col items-center flex-1 p-4 pb-24 text-center animate-scale-in relative overflow-y-auto">
      <div className="absolute top-[10%] left-[10%] w-[200px] h-[200px] rounded-full bg-emerald-500/8 blur-[100px] pointer-events-none" />

      <div className="text-5xl mb-3 animate-float">🔄</div>
      <h2 className="text-2xl font-black text-gradient-primary mb-1">סיכום החלפה</h2>
      <p className="text-sm text-muted-foreground mb-5">הנה מה שקרה בהחלפת הקלפים</p>

      {/* Human was NEGATIVE: show received + returned pairs */}
      {humanWasNegative && (
        <div className="glass rounded-3xl p-4 mb-4 w-full max-w-sm">
          <p className="text-sm font-bold text-amber-400 mb-3">📥 קיבלת והחזרת:</p>
          <div className="space-y-3">
            {givenToMe.map((given, idx) => {
              const returned = returnedByMe[idx];
              return (
                <div key={given.card.id} className="flex items-center justify-center gap-2">
                  <div className="text-center">
                    <p className="text-[9px] text-green-400 mb-0.5">קיבלת מ{players[given.fromSeat].name}</p>
                    <PlayingCard card={given.card} small highlight />
                  </div>
                  {returned && (
                    <>
                      <span className="text-muted-foreground text-lg">→</span>
                      <div className="text-center">
                        <p className="text-[9px] text-rose-400 mb-0.5">החזרת</p>
                        <PlayingCard card={returned.card} small />
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Human was POSITIVE: show returned to them */}
      {humanWasPositive && (
        <div className="glass rounded-3xl p-4 mb-4 w-full max-w-sm">
          <p className="text-sm font-bold text-green-400 mb-3">🎁 קלפים שהוחזרו לך:</p>
          {Array.from(groupedReturned.entries()).map(([fromSeat, cards]) => (
            <div key={fromSeat} className="mb-3 last:mb-0">
              <p className="text-xs text-muted-foreground mb-2">
                מ<span className="font-bold text-emerald-400">{players[fromSeat].name}</span>
                {hasAI && aiSeats.has(fromSeat) && <>{' '}<BotIcon size={14} /></>}:
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
      )}

      <Button size="lg" variant="glow" onClick={dismissReceivedCards} className="text-lg px-12 rounded-2xl">
        המשך ➡️
      </Button>
    </div>
  );
}
