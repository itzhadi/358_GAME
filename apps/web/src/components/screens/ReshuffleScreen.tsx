'use client';

import { getReshuffleSide, calculateExchangeGivings } from '@358/shared';
import { Button } from '@/components/ui/button';
import { PlayerHand } from '@/components/PlayerHand';
import { useGameStore } from '@/store/gameStore';

export function ReshuffleScreen() {
  const { gameState, dispatch, aiSeats, mode, playerSeat, reshuffleVoteStatus, myReshuffleVote } = useGameStore();

  if (!gameState) return null;

  const { dealerIndex, reshuffleWindowFor8, reshuffleWindowFor35, reshuffleUsedBy8, reshuffleUsedBy35, handNumber } = gameState;
  const isOnline = mode === 'online';

  const mySeat = isOnline ? (playerSeat ?? 0) : 0;
  const mySide = getReshuffleSide(mySeat, dealerIndex);
  const myHand = gameState.playerHands[mySeat];

  const exchangeGivings = handNumber > 1
    ? calculateExchangeGivings(gameState.lastHandDelta, gameState.targets)
    : [];
  const owedToMe = exchangeGivings.filter((g) => g.toSeat === mySeat);
  const iOwe = exchangeGivings.filter((g) => g.fromSeat === mySeat);

  const can8 = !reshuffleUsedBy8 && reshuffleWindowFor8;
  const can35 = !reshuffleUsedBy35 && reshuffleWindowFor35;
  const myTurn = mySide === '8' ? can8 : can35;

  const otherSideReshuffled =
    (mySide === '8' && reshuffleUsedBy35) ||
    (mySide === '35' && reshuffleUsedBy8);
  const otherSideLabel = mySide === '8' ? '3+5' : '8';

  const iReshuffled =
    (mySide === '8' && reshuffleUsedBy8) ||
    (mySide === '35' && reshuffleUsedBy35);

  const waitingForOther = !myTurn && ((mySide === '8' && can35) || (mySide === '35' && can8));

  const iVotedOnline35 = isOnline && mySide === '35' && myReshuffleVote !== null;
  const partnerVoteStatus = isOnline && mySide === '35' && reshuffleVoteStatus && reshuffleVoteStatus.votedSeat !== mySeat
    ? reshuffleVoteStatus
    : null;

  const nonDealerSeats = [0, 1, 2].filter((s) => s !== dealerIndex);
  const partnerSeat = nonDealerSeats.find((s) => s !== mySeat);
  const partnerName = partnerSeat !== undefined ? gameState.players[partnerSeat].name : '';
  const partnerTarget = partnerSeat !== undefined ? gameState.targets[partnerSeat] : 0;

  const handleAccept = () => {
    dispatch({ type: 'RESHUFFLE_ACCEPT', payload: { side: mySide } });
  };

  const handleDecline = () => {
    dispatch({ type: 'RESHUFFLE_DECLINE', payload: { side: mySide } });
  };

  const showButtons = myTurn && !iVotedOnline35;

  return (
    <div className="flex flex-col items-center justify-center flex-1 p-4 text-center animate-scale-in relative">
      <div className="absolute top-[10%] left-[-5%] w-[250px] h-[250px] rounded-full bg-amber-600/8 blur-[100px] pointer-events-none" />

      <div className="text-4xl mb-2">🔄</div>
      <h2 className="text-xl font-black text-gradient-primary mb-1">
        יד {handNumber} — חלוקה מחדש
      </h2>

      {otherSideReshuffled && myTurn && (
        <div className="glass-strong rounded-2xl px-4 py-2 mb-3 text-sm text-amber-400 font-semibold animate-scale-in">
          צד {otherSideLabel} ביקש חלוקה מחדש — הקלפים חולקו מחדש!
          <br />
          רוצה גם לבקש חלוקה מחדש?
        </div>
      )}

      {otherSideReshuffled && !myTurn && (
        <div className="glass-strong rounded-2xl px-4 py-2 mb-3 text-sm text-amber-400 font-semibold animate-scale-in">
          צד {otherSideLabel} ביקש חלוקה מחדש — הקלפים חולקו מחדש!
        </div>
      )}

      {iReshuffled && waitingForOther && (
        <div className="glass-strong rounded-2xl px-4 py-2 mb-3 text-sm text-emerald-400 font-semibold animate-scale-in">
          ביקשת חלוקה מחדש — ממתין להחלטת צד {otherSideLabel}...
        </div>
      )}

      {iVotedOnline35 && myReshuffleVote === 'accept' && (
        <div className="glass-strong rounded-2xl px-4 py-2 mb-3 text-sm text-emerald-400 font-semibold animate-scale-in">
          ביקשת חלוקה מחדש — ממתין ל{partnerName} ({partnerTarget})...
        </div>
      )}

      {partnerVoteStatus && partnerVoteStatus.vote === 'accept' && !iVotedOnline35 && (
        <div className="glass-strong rounded-2xl px-4 py-2 mb-3 text-sm text-amber-400 font-semibold animate-scale-in">
          {partnerName} ({partnerTarget}) מבקש חלוקה מחדש — מסכים?
        </div>
      )}

      {!otherSideReshuffled && !iReshuffled && !iVotedOnline35 && !partnerVoteStatus && myTurn && (
        <p className="text-muted-foreground text-sm mb-4">
          {isOnline && mySide === '35'
            ? 'בדוק את הקלפים שלך — שניכם צריכים להסכים לחלוקה מחדש'
            : 'בדוק את הקלפים שלך — רוצה חלוקה מחדש?'}
        </p>
      )}

      {!otherSideReshuffled && !iReshuffled && !myTurn && waitingForOther && (
        <p className="text-muted-foreground text-sm mb-4 animate-pulse">
          ממתין להחלטת צד {otherSideLabel}...
        </p>
      )}

      <div className="mb-5 w-full max-w-md">
        <PlayerHand cards={myHand} />
      </div>

      {(owedToMe.length > 0 || iOwe.length > 0) && (
        <div className="glass rounded-2xl px-4 py-3 mb-4 text-sm max-w-sm w-full">
          {iOwe.map((g) => (
            <div key={`owed-${g.toSeat}`} className="flex items-center justify-center gap-2 text-emerald-400 font-semibold">
              <span>🃏</span>
              <span>{gameState.players[g.toSeat].name} ({gameState.targets[g.toSeat]}) חייב לך {g.count} {g.count === 1 ? 'קלף' : 'קלפים'}</span>
            </div>
          ))}
          {owedToMe.map((g) => (
            <div key={`iowe-${g.fromSeat}`} className="flex items-center justify-center gap-2 text-red-400 font-semibold mt-1">
              <span>🃏</span>
              <span>אתה חייב {g.count} {g.count === 1 ? 'קלף' : 'קלפים'} ל{gameState.players[g.fromSeat].name} ({gameState.targets[g.fromSeat]})</span>
            </div>
          ))}
        </div>
      )}

      {showButtons ? (
        <div className="flex gap-3">
          <Button size="lg" variant="glow" onClick={handleAccept} className="text-base px-8 rounded-2xl">
            חלוקה מחדש
          </Button>
          <Button size="lg" variant="outline" onClick={handleDecline} className="text-base px-8 rounded-2xl">
            המשך ▶
          </Button>
        </div>
      ) : iVotedOnline35 ? (
        <p className="text-sm text-muted-foreground animate-pulse">
          ממתין ל{partnerName} ({partnerTarget})...
        </p>
      ) : waitingForOther && !iReshuffled ? (
        <p className="text-sm text-muted-foreground animate-pulse">
          ממתין להחלטת צד {otherSideLabel}...
        </p>
      ) : null}
    </div>
  );
}
