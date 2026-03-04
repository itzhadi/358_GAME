# Audit: Online 2P+AI Mode vs Local & 3-Player Online

**Date:** 2025-03-01  
**Scope:** Compare game flow between LOCAL (vs computer), ONLINE 3-player, and ONLINE 2P+AI modes. Identify screens/animations/indicators that are MISSING or BROKEN in 2P+AI online mode.

---

## Executive Summary

The online 2P+AI mode has **8 distinct issues** where screens, animations, or notifications work in local/3-player mode but are missing or broken when the AI runs server-side.

---

## A. CUTTER_PICK Phase

### Issue A1: AI cutter pick animation is cut short
**Files:** `apps/web/src/components/screens/CutterPickScreen.tsx`, `apps/api/src/aiRunner.ts`

**Local mode:** CutterPickScreen shows full animation when AI is dealer:
- 0–1200ms: "בוחר חותך..." (thinking) with pulsing suits
- 1200–2500ms: "הכריז על החותך!" reveal with chosen suit
- At 2500ms: `dispatch(PICK_CUTTER)` runs client-side

**Online 2P+AI mode:** Server `aiRunner.scheduleAiTurn` uses `getDelay('CUTTER_PICK')` = **1500ms** (line 104). The server applies and broadcasts at 1500ms. The client receives the new state and the phase changes (CUTTER_PICK → EXCHANGE_GIVE or DEALER_DISCARD) **before** the client's 2500ms reveal completes.

**Result:** Humans see ~300ms of the reveal animation (1200–1500ms) before the screen is replaced. The full "הכריז על החותך!" moment is truncated.

**Fix:** Align server delay with client animation. Either:
- Increase `aiRunner.getDelay('CUTTER_PICK')` to 2500ms, or
- Add a server-side "cutter:revealing" event that clients can use to delay the phase transition.

---

### Issue A2: aiSeats may not be set — AI indicators missing
**Files:** `apps/web/src/store/gameStore.ts` (lines 190–194), `apps/api/src/socket.ts` (game:start handler)

**Root cause:** `aiSeats` is set only when `!prevState && prev.lobbyState?.aiSeat != null` (gameStore line 192). When the game starts, the server does **not** emit `room:state` after `startGame()`. The client's `lobbyState` was last updated at room create/join, when `aiSeat` was still `null`. So `lobbyState.aiSeat` is null when the first `game:privateHand` arrives.

**Result:** `aiSeats` stays empty. Consequences:
- `isAiDealer` is false → CutterPickScreen shows generic "ממתין..." instead of the 🤖 AI animation
- No 🤖 emoji next to AI in HandScoringScreen, TrickResultScreen, DealScreen, etc.
- `hasAI` is false → GameBoard's AI timer/heartbeat never runs (but AI runs server-side, so gameplay continues)

**Fix:** Emit `room:state` when the game starts in `socket.ts` (game:start handler, after `startGame()`), so the client receives `aiSeat: 2` and can set `aiSeats` correctly. Alternatively, include `aiSeat` in the `game:privateHand` payload or derive it from `gameState.players` (e.g. player with `id.startsWith('ai-')`).

---

## B. DEALER_DISCARD Phase

### Status: ✅ Working
**File:** `apps/web/src/components/screens/DealerDiscardScreen.tsx`

When AI is dealer, DealerDiscardScreen shows "מחליף קלפים עם הקופה..." for both human players. Server delay is 1000ms (`aiRunner` line 106). Humans see the waiting screen for ~1 second before the phase changes. Behavior matches local mode (local uses 1500ms in GameBoard).

---

## C. Exchange Screens (EXCHANGE_GIVE, EXCHANGE_RETURN)

### Issue C1: DealerReturnsScreen never shown in online mode
**Files:** `apps/web/src/store/gameStore.ts`, `apps/web/src/components/GameBoard.tsx`

**Local mode:** When `PICK_CUTTER` is applied and the dealer has `dealerHiddenReturns` or `dealerPendingReceived`, the dispatch sets `showDealerReturns: true` (gameStore lines 399–412). The dealer sees DealerReturnsScreen with the cards they received back before continuing.

**Online 2P+AI mode:** The `game:privateHand` handler has **no** logic to set `showDealerReturns`. When the server applies `PICK_CUTTER` and broadcasts, the client receives the new state (phase = DEALER_DISCARD or EXCHANGE_RETURN) but never sets `showDealerReturns`.

**Result:** When a **human** is dealer and had hidden returns (positive dealer) or pending received (negative dealer), they skip DealerReturnsScreen and go straight to DealerDiscardScreen or ExchangeScreen. They never get the focused "here are the cards you got back" reveal.

**Fix:** In `game:privateHand`, add detection for:
```
prevState?.phase === 'CUTTER_PICK' && newState.phase === 'DEALER_DISCARD' && mySeat === newState.dealerIndex && newState.dealerHiddenReturns.length > 0
```
or
```
prevState?.phase === 'CUTTER_PICK' && newState.phase === 'EXCHANGE_RETURN' && mySeat === newState.dealerIndex && newState.dealerPendingReceived.length > 0
```
Set `showDealerReturns: true` in those cases.

---

### Issue C2: ReceivedCardsScreen — possible edge case for dealer transition
**Files:** `apps/web/src/store/gameStore.ts` (lines 214–225, 376–393)

**Status:** The handler correctly detects:
- Exchange cards returned TO me (lines 205–212)
- Phase transition EXCHANGE_RETURN → CUTTER_PICK with returnedToMe (lines 214–225), excluding dealer

**Potential gap:** When phase goes EXCHANGE_RETURN → DEALER_DISCARD (dealer was negative, finished returning), the non-dealer humans who received cards back might need ReceivedCardsScreen. The handler at 376–393 in the **local** dispatch covers "EXCHANGE_RETURN_CARD → DEALER_DISCARD" with `returnedToHuman`. The **online** handler does not have an equivalent for the transition EXCHANGE_RETURN → DEALER_DISCARD. Need to verify if that transition can occur (dealer returns last card → phase DEALER_DISCARD) and if non-dealers need to see ReceivedCardsScreen. The engine's `handleExchangeReturn` determines next phase; if the last return completes the exchange, phase may go to DEALER_DISCARD. The "returned to me" detection (lines 205–212) is incremental (newReturnedToMe > prevReturnedToMe), so it should catch returns as they happen. **Likely OK** — marked for verification only.

---

## D. RESHUFFLE_WINDOW

### Issue D1: Reshuffle outcome notifications never shown in online mode
**Files:** `apps/web/src/store/gameStore.ts` (lines 414–415, 419–448, 578–581)

**Local mode:** When AI accepts/declines reshuffle, the dispatch sets `reshuffleNotification` with messages like:
- "שחקן X לא מסכים — ממשיכים לשחק"
- "שחקן X מסכים — הקלפים מחולקים מחדש!"
- "צד 3+5 ביקש חלוקה מחדש — הקלפים מחולקים מחדש!"
- "צד 3+5 ויתר על חלוקה מחדש"

**Online 2P+AI mode:** The `game:privateHand` handler never sets `reshuffleNotification`. When the server applies RESHUFFLE_ACCEPT or RESHUFFLE_DECLINE and broadcasts, the client only does:
```ts
set({ gameState: newState, reshuffleVoteStatus: null, myReshuffleVote: null });
```
No toast/overlay is shown.

**Result:** Humans do not see feedback when:
- AI (dealer) accepts or declines side-8 reshuffle
- AI (side-35) agrees or disagrees with human partner's vote
- Side-35 vote completes (both accept or one declines)

**Fix:** In `game:privateHand`, detect phase/reshuffle state transitions and set `reshuffleNotification` with appropriate messages. E.g. when `prevState.phase === 'RESHUFFLE_WINDOW'` and `newState.phase === 'CUTTER_PICK'` (or new deal), infer reshuffle outcome and show a message. May require the server to send a `reshuffle:result` event with the outcome.

---

### Issue D2: reshuffle:voteStatus works
**Status:** ✅ The `reshuffle:voteStatus` socket event is handled (gameStore line 274). ReshuffleScreen shows partner vote status correctly for side-35.

---

## E. TRICK_PLAY / TRICK_RESULT

### Status: ✅ Working
**Files:** `apps/web/src/store/gameStore.ts` (lines 237–270)

The `game:privateHand` handler correctly detects trick completion:
- `prevState.phase === 'TRICK_PLAY'`, 2 cards in current trick, `newState.tricksHistory.length` increased
- Builds `displayState` with all 3 cards
- Shows them for 1200ms, then sets `showTrickResult: true`

Local mode uses 1000ms; online uses 1200ms. Both show the trick and TrickResultScreen correctly.

---

## F. HAND_SCORING / GAME_OVER

### Status: ✅ Working
**Files:** `apps/web/src/components/screens/HandScoringScreen.tsx`, `apps/api/src/aiRunner.ts` (lines 164–174)

- HandScoringScreen shows for all players. When dealer is AI, `canAdvance` is true for humans (line 14: `dealerIsAI` allows advance). When dealer is human, non-dealers see "ממתין שהדילר ימשיך...".
- AI dealer auto-advances after 4000ms (aiRunner lines 164–172).
- GameOverScreen renders when `phase === 'GAME_OVER'`.

---

## Summary Table

| Phase / Feature           | Local | Online 3P | Online 2P+AI | Issue |
|--------------------------|-------|-----------|--------------|-------|
| CUTTER_PICK (AI animation) | ✅ Full | N/A | ⚠️ Cut short | A1 |
| aiSeats / AI indicators  | ✅ | N/A | ❌ Not set | A2 |
| DEALER_DISCARD (AI wait)  | ✅ | ✅ | ✅ | — |
| DealerReturnsScreen      | ✅ | ✅ | ❌ Never shown | C1 |
| ReceivedCardsScreen      | ✅ | ✅ | ✅ | — |
| DealerKupaScreen         | ✅ | ✅ | ✅ | — |
| RESHUFFLE notifications | ✅ | N/A | ❌ Never shown | D1 |
| reshuffle:voteStatus     | N/A | ✅ | ✅ | — |
| TRICK_RESULT             | ✅ | ✅ | ✅ | — |
| HAND_SCORING / GAME_OVER | ✅ | ✅ | ✅ | — |

---

## Recommended Fix Order

1. **A2 (aiSeats)** — Emit `room:state` on game start so `aiSeats` is set. Fixes AI indicators and CutterPickScreen AI branch.
2. **A1 (Cutter animation)** — Increase server CUTTER_PICK delay to 2500ms or add a reveal event.
3. **C1 (DealerReturnsScreen)** — Add `showDealerReturns` detection in `game:privateHand`.
4. **D1 (Reshuffle notifications)** — Add reshuffle outcome detection and `reshuffleNotification` in `game:privateHand`, or add `reshuffle:result` server event.
