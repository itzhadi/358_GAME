'use client';

import { useState, useMemo } from 'react';
import { Card, getRequiredReturnCard } from '@358/shared';
import { Button } from '@/components/ui/button';
import { PlayingCard } from '@/components/PlayingCard';
import { PlayerHand } from '@/components/PlayerHand';
import { useGameStore } from '@/store/gameStore';
import BotIcon from '@/components/BotIcon';

type ReturnPair = { received: Card; returned: Card; toPlayerName: string };

export function ExchangeScreen() {
  const { gameState, dispatch, activePlayerSeat, aiSeats, mode, playerSeat } = useGameStore();
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());

  if (!gameState || !gameState.exchangeInfo) return null;

  const hasAI = aiSeats.size > 0;
  const isOnline = mode === 'online';
  const { exchangeInfo, players, playerHands } = gameState;
  const currentSeat = gameState.currentPlayerIndex;
  const humanSeat = isOnline ? (playerSeat ?? 0) : (hasAI ? 0 : activePlayerSeat);
  const isMyTurn = currentSeat === humanSeat;
  const isAiTurn = hasAI && aiSeats.has(currentSeat);

  const currentPlayer = players[currentSeat];
  const hand = playerHands[isMyTurn ? currentSeat : humanSeat];

  const isGiving = gameState.phase === 'EXCHANGE_GIVE';
  const isReturning = gameState.phase === 'EXCHANGE_RETURN';

  const isDealerBeforeCutter = humanSeat === gameState.dealerIndex && !gameState.cutterSuit;
  const cardsReturnedToMe = isDealerBeforeCutter
    ? []
    : exchangeInfo.returnedCards.filter(r => r.toSeat === humanSeat);

  // Pre-compute all return pairs for the human so we can show summary and dispatch all at once
  const returnPairs = useMemo<ReturnPair[]>(() => {
    if (!isReturning || !isMyTurn) return [];
    const { givings, givenCards, returnedCards } = exchangeInfo;
    const pairs: ReturnPair[] = [];
    let simHand = [...hand];

    for (const giving of givings) {
      if (giving.toSeat !== currentSeat) continue;
      const givenForDir = givenCards.filter(g => g.fromSeat === giving.fromSeat && g.toSeat === currentSeat);
      const alreadyReturned = returnedCards.filter(r => r.fromSeat === currentSeat && r.toSeat === giving.fromSeat).length;

      for (let i = alreadyReturned; i < givenForDir.length; i++) {
        const receivedCard = givenForDir[i].card;
        const returnCard = getRequiredReturnCard(simHand, receivedCard);
        pairs.push({ received: receivedCard, returned: returnCard, toPlayerName: players[giving.fromSeat].name });
        simHand = simHand.filter(c => c.id !== returnCard.id);
      }
    }
    return pairs;
  }, [isReturning, isMyTurn, currentSeat, exchangeInfo, hand, players]);

  const handleConfirmReturns = () => {
    for (const pair of returnPairs) {
      dispatch({ type: 'EXCHANGE_RETURN_CARD', payload: { fromSeat: currentSeat, cardId: pair.returned.id } });
    }
  };

  if (isAiTurn || (isOnline && !isMyTurn)) {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex-1 flex flex-col items-center p-4 text-center overflow-y-auto">
          <div className="text-5xl mb-4 animate-float">🔄</div>
          <h2 className="text-xl font-bold mb-2">
            {isAiTurn && <><BotIcon size={20} />{' '}</>}{currentPlayer.name} {isGiving ? 'נותן קלפים' : 'מחזיר קלפים'}...
          </h2>
          <p className="text-muted-foreground text-sm animate-pulse mb-4">ממתין...</p>

          {exchangeInfo.givenCards.filter(g => g.fromSeat === humanSeat).length > 0 && (
            <div className="glass rounded-2xl p-4 w-full max-w-sm mb-3 border border-cyan-500/15">
              <p className="text-sm font-bold text-cyan-400 mb-2">📤 קלפים שנתת:</p>
              <div className="flex justify-center gap-2 flex-wrap">
                {exchangeInfo.givenCards.filter(g => g.fromSeat === humanSeat).map((g) => (
                  <div key={g.card.id} className="text-center">
                    <p className="text-[10px] text-muted-foreground mb-0.5">ל{players[g.toSeat].name}</p>
                    <PlayingCard card={g.card} small />
                  </div>
                ))}
              </div>
            </div>
          )}

          {cardsReturnedToMe.length > 0 && (
            <div className="glass rounded-2xl p-4 w-full max-w-sm border border-green-500/15">
              <p className="text-sm font-bold text-green-400 mb-2">🎁 קלפים שהוחזרו לך:</p>
              <div className="flex justify-center gap-2 flex-wrap">
                {cardsReturnedToMe.map((r) => (
                  <div key={r.card.id} className="text-center">
                    <p className="text-[10px] text-muted-foreground mb-0.5">מ{players[r.fromSeat].name}</p>
                    <PlayingCard card={r.card} small highlight />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="glass-strong pb-4 pt-2 shrink-0">
          <div className="text-center text-xs text-muted-foreground mb-1">הקלפים שלך</div>
          <PlayerHand cards={playerHands[humanSeat]} />
        </div>
      </div>
    );
  }

  // --- EXCHANGE_RETURN: auto summary screen ---
  if (isReturning && isMyTurn && returnPairs.length > 0) {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex-1 flex flex-col items-center p-4 text-center overflow-y-auto">
          <div className="text-4xl mb-3">🔄</div>
          <h2 className="text-xl font-bold mb-1">החזרת קלפים</h2>
          <p className="text-sm text-muted-foreground mb-5">
            הקלפים הבאים יוחזרו אוטומטית (הגבוה ביותר בכל צורה)
          </p>

          <div className="w-full max-w-sm space-y-3 mb-6">
            {returnPairs.map((pair, idx) => (
              <div key={idx} className="glass rounded-2xl p-3 border border-white/5">
                <div className="flex items-center justify-center gap-3">
                  <div className="text-center">
                    <p className="text-[9px] text-green-400 mb-0.5">קיבלת</p>
                    <PlayingCard card={pair.received} small highlight />
                  </div>
                  <span className="text-amber-400 text-xl">→</span>
                  <div className="text-center">
                    <p className="text-[9px] text-rose-400 mb-0.5">מחזיר</p>
                    <PlayingCard card={pair.returned} small />
                  </div>
                  <span className="text-[10px] text-slate-500">ל{pair.toPlayerName}</span>
                </div>
              </div>
            ))}
          </div>

          <Button size="lg" variant="glow" className="text-lg rounded-2xl px-10" onClick={handleConfirmReturns}>
            אישור ✨
          </Button>
        </div>
      </div>
    );
  }

  // --- EXCHANGE_GIVE ---
  let cardsToGive = 0;
  if (isGiving) {
    const currentGiving = exchangeInfo.givings[exchangeInfo.currentGiverIdx];
    if (currentGiving) {
      const alreadyGiven = exchangeInfo.givenCards.filter(
        (g) => g.fromSeat === currentGiving.fromSeat && g.toSeat === currentGiving.toSeat,
      ).length;
      cardsToGive = currentGiving.count - alreadyGiven;
    }
  }

  const handleCardClick = (cardId: string) => {
    if (!isMyTurn || !isGiving) return;
    setSelectedCards((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else if (next.size < cardsToGive) {
        next.add(cardId);
      }
      return next;
    });
  };

  const handleGiveCards = () => {
    if (!isMyTurn) return;
    const cardIds = Array.from(selectedCards);
    for (const cardId of cardIds) {
      dispatch({ type: 'EXCHANGE_GIVE_CARD', payload: { fromSeat: currentSeat, cardId } });
    }
    setSelectedCards(new Set());
  };

  const exchangePartner = isGiving
    ? exchangeInfo.givings[exchangeInfo.currentGiverIdx]?.toSeat
    : undefined;
  const partnerName = exchangePartner !== undefined ? players[exchangePartner]?.name : '';

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="text-center py-4 glass-strong">
        <h2 className="text-lg font-bold">תן קלפים</h2>
        <p className="text-sm text-muted-foreground">
          <span className="text-emerald-400 font-bold">{currentPlayer.name}</span>: בחר {cardsToGive} קלפים לתת ל{partnerName}
          {!isMyTurn && <span className="block text-xs mt-1 text-muted-foreground">(ממתין ל{currentPlayer.name}...)</span>}
        </p>
      </div>

      <div className="flex-1 flex flex-col justify-center">
        <PlayerHand
          cards={hand}
          onCardClick={handleCardClick}
          selectedCards={selectedCards}
          disabled={false}
          maxSelect={cardsToGive}
        />
      </div>

      <div className="p-4 pb-6">
        <Button
          size="lg"
          variant="glow"
          className="w-full text-lg rounded-2xl"
          disabled={!isMyTurn || selectedCards.size !== cardsToGive}
          onClick={handleGiveCards}
        >
          תן {selectedCards.size}/{cardsToGive} קלפים
        </Button>
      </div>
    </div>
  );
}
