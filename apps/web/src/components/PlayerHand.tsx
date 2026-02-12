'use client';

import { Card as CardType, Suit, sortHand, getLegalCards } from '@358/shared';
import { PlayingCard } from './PlayingCard';
import { cn } from '@/lib/utils';

interface PlayerHandProps {
  cards: CardType[];
  cutterSuit?: Suit | null;
  leadSuit?: Suit | null;
  onCardClick?: (cardId: string) => void;
  selectedCards?: Set<string>;
  highlightCards?: Set<string>;
  disabled?: boolean;
  maxSelect?: number;
  small?: boolean;
}

export function PlayerHand({
  cards,
  cutterSuit,
  leadSuit,
  onCardClick,
  selectedCards = new Set(),
  highlightCards,
  disabled = false,
  maxSelect,
  small = false,
}: PlayerHandProps) {
  const sorted = sortHand(cards, cutterSuit);
  const legalCards = leadSuit !== undefined ? getLegalCards(cards, leadSuit ?? null) : cards;
  const legalIds = new Set(legalCards.map((c) => c.id));

  return (
    <div className={cn('flex flex-wrap justify-center gap-1 px-2', small ? 'py-1' : 'py-2')}>
      {sorted.map((card, idx) => {
        const isLegal = legalIds.has(card.id);
        const isSelected = selectedCards.has(card.id);
        const isDisabled = disabled || (!isLegal && leadSuit !== undefined);
        const atMax = maxSelect !== undefined && selectedCards.size >= maxSelect && !isSelected;

        return (
          <div
            key={card.id}
            className="animate-card-play"
            style={{ animationDelay: `${idx * 30}ms` }}
          >
            <PlayingCard
              card={card}
              small={small}
              onClick={
                onCardClick && !isDisabled && !atMax
                  ? () => onCardClick(card.id)
                  : undefined
              }
              disabled={isDisabled || atMax}
              selected={isSelected}
              highlight={(isLegal && !isSelected && !disabled) || (highlightCards?.has(card.id) ?? false)}
            />
          </div>
        );
      })}
    </div>
  );
}
