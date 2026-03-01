'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PlayerHand } from '@/components/PlayerHand';
import { SuitIcon } from '@/components/PlayingCard';
import { useGameStore } from '@/store/gameStore';
import BotIcon from '@/components/BotIcon';

export function DealerDiscardScreen() {
  const { gameState, dispatch, activePlayerSeat, aiSeats, mode, playerSeat } = useGameStore();
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());

  if (!gameState) return null;

  const hasAI = aiSeats.size > 0;
  const isOnline = mode === 'online';
  const dealerSeat = gameState.dealerIndex;
  const dealer = gameState.players[dealerSeat];
  const humanSeat = isOnline ? (playerSeat ?? 0) : (hasAI ? 0 : activePlayerSeat);
  const isMyTurn = dealerSeat === humanSeat;
  const isAiDealer = hasAI && aiSeats.has(dealerSeat);

  if (isAiDealer || (isOnline && !isMyTurn)) {
    const hand = gameState.playerHands[humanSeat];
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center relative overflow-hidden">
          <div className="absolute bottom-[10%] right-[-5%] w-[200px] h-[200px] rounded-full bg-emerald-600/8 blur-[100px] pointer-events-none" />

          {isAiDealer && <div className="mb-4 animate-float"><BotIcon size={56} /></div>}
          <h2 className="text-xl font-bold mb-2">{dealer.name}</h2>
          {gameState.cutterSuit && (
            <div className="glass rounded-2xl px-5 py-3 flex items-center gap-2 mb-4">
              <span className="text-sm text-muted-foreground">חותך:</span>
              <SuitIcon suit={gameState.cutterSuit} className="text-3xl" />
            </div>
          )}
          <p className="text-muted-foreground text-sm animate-pulse">מחליף קלפים עם הקופה...</p>
        </div>
        {isOnline && !isMyTurn && (
          <div className="glass-strong pb-4 pt-2">
            <div className="text-center text-xs text-muted-foreground mb-1">הקלפים שלך</div>
            <PlayerHand cards={hand} />
          </div>
        )}
      </div>
    );
  }

  const hand = gameState.playerHands[dealerSeat];

  const handleCardClick = (cardId: string) => {
    if (!isMyTurn) return;
    setSelectedCards((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else if (next.size < 4) {
        next.add(cardId);
      }
      return next;
    });
  };

  const handleDiscard = () => {
    if (!isMyTurn) return;
    if (selectedCards.size !== 4) return;
    dispatch({
      type: 'DEALER_DISCARD_4',
      payload: { cardIds: Array.from(selectedCards) },
    });
    setSelectedCards(new Set());
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="text-center py-4 glass-strong">
        <h2 className="text-lg font-bold">{dealer.name}</h2>
        <p className="text-sm text-muted-foreground">
          בחר <span className="text-emerald-400 font-bold">4 קלפים</span> לזרוק → קבל קופה
        </p>
        {gameState.cutterSuit && (
          <div className="flex items-center justify-center gap-1.5 mt-1">
            <span className="text-xs text-muted-foreground">חותך:</span>
            <SuitIcon suit={gameState.cutterSuit} className="text-2xl" />
          </div>
        )}
      </div>

      <div className="text-center py-3">
        <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${i < selectedCards.size
                  ? 'bg-emerald-500 shadow-lg shadow-emerald-500/40'
                  : 'bg-white/8'
                }`}
            />
          ))}
          <span className="text-sm font-bold text-muted-foreground mr-1">{selectedCards.size}/4</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center">
        <PlayerHand
          cards={hand}
          cutterSuit={gameState.cutterSuit}
          onCardClick={handleCardClick}
          selectedCards={selectedCards}
          disabled={!isMyTurn}
          maxSelect={4}
        />
      </div>

      <div className="p-4 pb-6">
        <Button
          size="lg"
          variant="glow"
          className="w-full text-lg rounded-2xl"
          disabled={!isMyTurn || selectedCards.size !== 4}
          onClick={handleDiscard}
        >
          זרוק ולקח קופה ✨
        </Button>
      </div>
    </div>
  );
}
