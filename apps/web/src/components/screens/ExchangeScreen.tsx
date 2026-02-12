'use client';

import { useState } from 'react';
import { getRequiredReturnCard } from '@358/shared';
import { Button } from '@/components/ui/button';
import { PlayingCard } from '@/components/PlayingCard';
import { PlayerHand } from '@/components/PlayerHand';
import { useGameStore } from '@/store/gameStore';

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

  // Collect cards given TO me (cards I received from others)
  const cardsGivenToMe = exchangeInfo.givenCards.filter(g => g.toSeat === humanSeat);
  // Collect cards returned TO me (cards returned by others after I gave)
  const cardsReturnedToMe = exchangeInfo.returnedCards.filter(r => r.toSeat === humanSeat);

  // AI or online other player's turn - show waiting with relevant exchange info
  if (isAiTurn || (isOnline && !isMyTurn)) {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
          <div className="text-5xl mb-4 animate-float">🔄</div>
          <h2 className="text-xl font-bold mb-2">
            {isAiTurn && '🤖 '}{currentPlayer.name} {isGiving ? 'נותן קלפים' : 'מחזיר קלפים'}...
          </h2>
          <p className="text-muted-foreground text-sm animate-pulse mb-4">ממתין...</p>

          {/* Show cards I already gave */}
          {exchangeInfo.givenCards.filter(g => g.fromSeat === humanSeat).length > 0 && (
            <div className="glass rounded-2xl p-4 w-full max-w-sm mb-3 border border-blue-500/20">
              <p className="text-sm font-bold text-blue-400 mb-2">📤 קלפים שנתת:</p>
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

          {/* Show cards returned to me so far */}
          {cardsReturnedToMe.length > 0 && (
            <div className="glass rounded-2xl p-4 w-full max-w-sm border border-green-500/20">
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

        {/* Show own hand at bottom */}
        <div className="glass-strong pb-4 pt-2">
          <div className="text-center text-xs text-muted-foreground mb-1">הקלפים שלך</div>
          <PlayerHand cards={playerHands[humanSeat]} />
        </div>
      </div>
    );
  }

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

  let autoReturnCard: string | null = null;
  const receivedCardsList: { fromSeat: number; card: typeof hand[0] }[] = [];

  if (isReturning) {
    const givings = exchangeInfo.givings;
    const returnedCards = exchangeInfo.returnedCards;
    const givenCards = exchangeInfo.givenCards;

    // Collect all cards given TO the current player (these are the cards they received)
    for (const giving of givings) {
      if (giving.toSeat === currentSeat) {
        const givenForDir = givenCards.filter(
          (g) => g.fromSeat === giving.fromSeat && g.toSeat === currentSeat,
        );
        for (const g of givenForDir) {
          receivedCardsList.push({ fromSeat: g.fromSeat, card: g.card });
        }

        const returnedForDir = returnedCards.filter(
          (r) => r.fromSeat === currentSeat && r.toSeat === giving.fromSeat,
        );
        if (returnedForDir.length < givenForDir.length) {
          const receivedCard = givenForDir[returnedForDir.length]?.card;
          if (receivedCard) {
            const required = getRequiredReturnCard(hand, receivedCard);
            if (required.id !== receivedCard.id) {
              autoReturnCard = required.id;
            }
          }
        }
      }
    }
  }

  const receivedCardIds = new Set(receivedCardsList.map((r) => r.card.id));

  const handleCardClick = (cardId: string) => {
    if (!isMyTurn) return;
    if (isGiving) {
      setSelectedCards((prev) => {
        const next = new Set(prev);
        if (next.has(cardId)) {
          next.delete(cardId);
        } else if (next.size < cardsToGive) {
          next.add(cardId);
        }
        return next;
      });
    } else if (isReturning) {
      dispatch({
        type: 'EXCHANGE_RETURN_CARD',
        payload: { fromSeat: currentSeat, cardId },
      });
    }
  };

  const handleGiveCards = () => {
    if (!isMyTurn) return;
    const cardIds = Array.from(selectedCards);
    for (const cardId of cardIds) {
      dispatch({
        type: 'EXCHANGE_GIVE_CARD',
        payload: { fromSeat: currentSeat, cardId },
      });
    }
    setSelectedCards(new Set());
  };

  const handleAutoReturn = () => {
    if (!isMyTurn) return;
    if (autoReturnCard) {
      dispatch({
        type: 'EXCHANGE_RETURN_CARD',
        payload: { fromSeat: currentSeat, cardId: autoReturnCard },
      });
    }
  };

  const exchangePartner = isGiving
    ? exchangeInfo.givings[exchangeInfo.currentGiverIdx]?.toSeat
    : exchangeInfo.givings.find((g) => g.toSeat === currentSeat)?.fromSeat;
  const partnerName = exchangePartner !== undefined ? players[exchangePartner]?.name : '';

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="text-center py-4 glass-strong">
        <h2 className="text-lg font-bold">
          🔄 {isGiving ? 'תן קלפים' : 'החזר קלפים'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isGiving
            ? <><span className="text-purple-400 font-bold">{currentPlayer.name}</span>: בחר {cardsToGive} קלפים לתת ל{partnerName}</>
            : autoReturnCard
              ? <><span className="text-amber-400 font-bold">חובה</span> להחזיר את הגבוה ביותר בצבע</>
              : <><span className="text-purple-400 font-bold">{currentPlayer.name}</span>: בחר קלף להחזיר ל{partnerName}</>
          }
          {!isMyTurn && <span className="block text-xs mt-1 text-muted-foreground">(ממתין ל{currentPlayer.name}...)</span>}
        </p>
      </div>

      {/* Show received cards */}
      {isReturning && isMyTurn && receivedCardsList.length > 0 && (
        <div className="mx-4 mt-3">
          <div className="glass rounded-2xl p-4 text-center border border-green-500/20">
            <p className="text-sm font-bold text-green-400 mb-3">
              🎁 הקלפים שקיבלת:
            </p>
            <div className="flex justify-center gap-2 flex-wrap">
              {receivedCardsList.map((r) => (
                <div key={r.card.id} className="text-center">
                  <p className="text-[10px] text-muted-foreground mb-1">מ{players[r.fromSeat].name}</p>
                  <PlayingCard card={r.card} highlight />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {isReturning && autoReturnCard && (
        <div className="mx-4 mt-3">
          <div className="glass rounded-2xl p-4 text-center border border-amber-500/20">
            <p className="text-sm font-bold text-amber-400 mb-2">
              ⚠️ חובה להחזיר קלף חזק
            </p>
            <Button size="sm" variant="accent" onClick={handleAutoReturn} disabled={!isMyTurn} className="rounded-xl">
              החזר קלף חובה ✨
            </Button>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col justify-center">
        <PlayerHand
          cards={hand}
          onCardClick={(!isReturning || !autoReturnCard) ? handleCardClick : undefined}
          selectedCards={selectedCards}
          highlightCards={isReturning ? receivedCardIds : undefined}
          disabled={false}
          maxSelect={isGiving ? cardsToGive : 1}
        />
      </div>

      {isGiving && (
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
      )}
    </div>
  );
}
