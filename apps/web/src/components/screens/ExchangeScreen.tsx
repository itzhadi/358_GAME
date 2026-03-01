'use client';

import { useState } from 'react';
import { getRequiredReturnCard } from '@358/shared';
import { Button } from '@/components/ui/button';
import { PlayingCard } from '@/components/PlayingCard';
import { PlayerHand } from '@/components/PlayerHand';
import { useGameStore } from '@/store/gameStore';
import BotIcon from '@/components/BotIcon';

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

  const cardsGivenToMe = exchangeInfo.givenCards.filter(g => g.toSeat === humanSeat);
  const isDealerBeforeCutter = humanSeat === gameState.dealerIndex && !gameState.cutterSuit;
  const cardsReturnedToMe = isDealerBeforeCutter
    ? []
    : exchangeInfo.returnedCards.filter(r => r.toSeat === humanSeat);

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
  let autoReturnIsReceived = false;
  const receivedCardsList: { fromSeat: number; card: typeof hand[0] }[] = [];
  let totalMyReturns = 0;
  let doneMyReturns = 0;

  type ExchangePair = {
    received: typeof hand[0];
    returned: typeof hand[0] | null;
    fromSeat: number;
    done: boolean;
  };
  const exchangePairs: ExchangePair[] = [];
  let currentReceivedCard: typeof hand[0] | null = null;
  let currentReturnCardObj: typeof hand[0] | null = null;

  if (isReturning) {
    const givings = exchangeInfo.givings;
    const returnedCards = exchangeInfo.returnedCards;
    const givenCards = exchangeInfo.givenCards;

    for (const giving of givings) {
      if (giving.toSeat === currentSeat) {
        const givenForDir = givenCards.filter(
          (g) => g.fromSeat === giving.fromSeat && g.toSeat === currentSeat,
        );
        const returnedForDir = returnedCards.filter(
          (r) => r.fromSeat === currentSeat && r.toSeat === giving.fromSeat,
        );
        for (let i = 0; i < givenForDir.length; i++) {
          receivedCardsList.push({ fromSeat: givenForDir[i].fromSeat, card: givenForDir[i].card });
          exchangePairs.push({
            received: givenForDir[i].card,
            returned: i < returnedForDir.length ? returnedForDir[i].card : null,
            fromSeat: giving.fromSeat,
            done: i < returnedForDir.length,
          });
        }
        totalMyReturns += givenForDir.length;
        doneMyReturns += returnedForDir.length;
      }
    }

    for (const giving of givings) {
      if (giving.toSeat === currentSeat) {
        const givenForDir = givenCards.filter(
          (g) => g.fromSeat === giving.fromSeat && g.toSeat === currentSeat,
        );
        const returnedForDir = returnedCards.filter(
          (r) => r.fromSeat === currentSeat && r.toSeat === giving.fromSeat,
        );
        if (returnedForDir.length < givenForDir.length) {
          const receivedCard = givenForDir[returnedForDir.length]?.card;
          if (receivedCard) {
            const required = getRequiredReturnCard(hand, receivedCard);
            autoReturnCard = required.id;
            autoReturnIsReceived = required.id === receivedCard.id;
            currentReceivedCard = receivedCard;
            currentReturnCardObj = hand.find((c) => c.id === required.id) || null;
          }
          break;
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
          {isGiving ? 'תן קלפים' : 'החזר קלפים'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isGiving
            ? <><span className="text-emerald-400 font-bold">{currentPlayer.name}</span>: בחר {cardsToGive} קלפים לתת ל{partnerName}</>
            : autoReturnCard
              ? <><span className="text-amber-400 font-bold">החזרה {doneMyReturns + 1}/{totalMyReturns}</span> — לחץ על הכפתור להחזרה</>
              : <><span className="text-emerald-400 font-bold">{currentPlayer.name}</span>: בחר קלף להחזיר ל{partnerName}</>
          }
          {!isMyTurn && <span className="block text-xs mt-1 text-muted-foreground">(ממתין ל{currentPlayer.name}...)</span>}
        </p>
      </div>

      {isReturning && isMyTurn && exchangePairs.length > 0 && (
        <div className="mx-3 mt-3 flex-1 overflow-y-auto pb-2">
          {exchangePairs.filter((p) => p.done).length > 0 && (
            <div className="glass rounded-2xl p-3 mb-2 border border-white/5">
              <p className="text-[10px] font-bold text-muted-foreground mb-2 text-center">✅ הוחזרו</p>
              <div className="space-y-1.5">
                {exchangePairs.filter((p) => p.done).map((pair, idx) => (
                  <div key={idx} className="flex items-center justify-center gap-2">
                    <div className="text-center">
                      <p className="text-[9px] text-green-400/70 mb-0.5">קיבלת</p>
                      <PlayingCard card={pair.received} small />
                    </div>
                    <span className="text-muted-foreground text-lg">→</span>
                    <div className="text-center">
                      <p className="text-[9px] text-rose-400/70 mb-0.5">החזרת</p>
                      <PlayingCard card={pair.returned!} small />
                    </div>
                    <span className="text-[10px] text-slate-500 mr-1">ל{players[pair.fromSeat].name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentReceivedCard && currentReturnCardObj && (
            <div className="glass rounded-2xl p-4 border border-amber-500/15">
              <p className="text-[10px] font-bold text-amber-400 mb-2 text-center">
                {autoReturnIsReceived
                  ? '↩️ אין קלף גבוה יותר — מחזיר את הקלף שקיבלת'
                  : '⚠️ חובה להחזיר את הגבוה ביותר בצבע'}
              </p>
              <div className="flex items-center justify-center gap-3 mb-3">
                <div className="text-center">
                  <p className="text-[9px] text-green-400 mb-0.5">קיבלת</p>
                  <PlayingCard card={currentReceivedCard} highlight />
                </div>
                <span className="text-amber-400 text-2xl animate-pulse">→</span>
                <div className="text-center">
                  <p className="text-[9px] text-rose-400 mb-0.5">מחזיר</p>
                  <div className="ring-2 ring-amber-500/40 rounded-lg">
                    <PlayingCard card={currentReturnCardObj} />
                  </div>
                </div>
              </div>
              <Button size="sm" variant="accent" onClick={handleAutoReturn} disabled={!isMyTurn} className="w-full rounded-xl">
                החזר ({doneMyReturns + 1}/{totalMyReturns}) ✨
              </Button>
            </div>
          )}
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
