'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const SUITS = ['♠', '♥', '♦', '♣'] as const;
const RANKS = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];

interface Slide {
  icon: string;
  title: string;
  content: React.ReactNode;
}

function MiniCard({ rank, suit, className }: { rank: string; suit: string; className?: string }) {
  const red = suit === '♥' || suit === '♦';
  return (
    <div className={cn(
      'w-10 h-14 sm:w-12 sm:h-16 rounded-lg flex flex-col items-center justify-center shadow-lg',
      'bg-gradient-to-br from-white to-gray-100 border border-gray-200',
      className,
    )}>
      <span className={cn('text-xs sm:text-sm font-black leading-none', red ? 'text-rose-600' : 'text-gray-800')}>{rank}</span>
      <span className={cn('text-sm sm:text-base leading-none', red ? 'text-rose-500' : 'text-gray-700')}>{suit}</span>
    </div>
  );
}

function FaceDownCard({ className }: { className?: string }) {
  return (
    <div className={cn(
      'w-10 h-14 sm:w-12 sm:h-16 rounded-lg shadow-lg',
      'bg-gradient-to-br from-blue-800 to-blue-950 border border-blue-600/50',
      'flex items-center justify-center',
      className,
    )}>
      <span className="text-blue-400/60 text-lg">🂠</span>
    </div>
  );
}

function SuitIcon({ suit, size = 'text-3xl' }: { suit: string; size?: string }) {
  const red = suit === '♥' || suit === '♦';
  return <span className={cn(size, red ? 'text-rose-500' : 'text-slate-300')}>{suit}</span>;
}

function AnimatedArrow() {
  return (
    <div className="flex items-center gap-0.5 text-purple-400 animate-pulse">
      <span>→</span>
    </div>
  );
}

const slides: Slide[] = [
  // 0 — Welcome
  {
    icon: '🃏',
    title: 'ברוכים הבאים ל-3-5-8!',
    content: (
      <div className="space-y-4">
        <p className="text-base sm:text-lg text-muted-foreground">
          משחק קלפים אסטרטגי ומרתק לשלושה שחקנים
        </p>
        <div className="flex justify-center gap-3 my-6">
          {SUITS.map((s) => (
            <div key={s} className="animate-float" style={{ animationDelay: `${SUITS.indexOf(s) * 200}ms` }}>
              <SuitIcon suit={s} size="text-5xl" />
            </div>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">בואו נלמד איך לשחק — צעד אחרי צעד</p>
      </div>
    ),
  },

  // 1 — What you need
  {
    icon: '👥',
    title: 'מה צריך?',
    content: (
      <div className="space-y-5">
        <div className="flex items-center justify-center gap-6">
          <div className="text-center">
            <div className="text-4xl mb-2">👤👤👤</div>
            <p className="text-sm font-bold">3 שחקנים</p>
          </div>
          <div className="text-center">
            <div className="text-4xl mb-2">🃏</div>
            <p className="text-sm font-bold">52 קלפים</p>
          </div>
        </div>
        <div className="glass rounded-2xl p-4 text-center">
          <p className="text-sm text-muted-foreground">כל שחקן מקבל <span className="text-purple-400 font-bold">16 קלפים</span></p>
          <p className="text-sm text-muted-foreground mt-1"><span className="text-amber-400 font-bold">4 קלפים</span> נשארים בצד — זו ה&quot;קופה&quot;</p>
        </div>
      </div>
    ),
  },

  // 2 — Roles
  {
    icon: '🎯',
    title: 'תפקידים ויעדים',
    content: (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground mb-4">
          כל יד, לכל שחקן יש יעד — כמה לקיחות הוא צריך לקחת:
        </p>
        <div className="grid grid-cols-3 gap-3">
          <div className="glass rounded-2xl p-4 text-center glow-accent">
            <div className="text-3xl font-black text-gradient-gold mb-1">8</div>
            <div className="text-xs font-bold text-amber-400">דילר</div>
            <div className="text-[10px] text-muted-foreground mt-1">בוחר חותך + קופה</div>
          </div>
          <div className="glass rounded-2xl p-4 text-center glow-primary">
            <div className="text-3xl font-black text-gradient-primary mb-1">5</div>
            <div className="text-xs font-bold text-purple-400">שמאל לדילר</div>
            <div className="text-[10px] text-muted-foreground mt-1">מתחיל ראשון!</div>
          </div>
          <div className="glass rounded-2xl p-4 text-center">
            <div className="text-3xl font-black text-gradient-primary mb-1">3</div>
            <div className="text-xs font-bold text-cyan-400">ימין לדילר</div>
            <div className="text-[10px] text-muted-foreground mt-1">הכי קל</div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground text-center">🔄 הדילר מתחלף כל יד (בכיוון השעון)</p>
      </div>
    ),
  },

  // 3 — Cutter (Trump)
  {
    icon: '✂️',
    title: 'מה זה חותך (Trump)?',
    content: (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          הדילר בוחר <strong className="text-amber-400">צבע חותך</strong> — הצבע החזק ביותר במשחק!
        </p>
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center justify-center gap-4 mb-3">
            {SUITS.map((s) => (
              <div key={s} className={cn(
                'w-14 h-14 rounded-xl flex items-center justify-center transition-all',
                s === '♣' ? 'glass-strong ring-2 ring-amber-500/50 scale-110 glow-accent' : 'glass opacity-50',
              )}>
                <SuitIcon suit={s} size="text-2xl" />
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-amber-400 font-bold">♣ נבחר כחותך!</p>
        </div>
        <div className="glass rounded-2xl p-3">
          <p className="text-xs text-center">
            <span className="text-amber-400 font-bold">קלף חותך מנצח כל קלף מצבע אחר</span>
            <br />
            <span className="text-muted-foreground">גם 2♣ ינצח את A♠ אם ♣ הוא החותך!</span>
          </p>
        </div>
      </div>
    ),
  },

  // 4 — Dealer kupa exchange
  {
    icon: '📦',
    title: 'החלפת הקופה',
    content: (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground text-center">
          אחרי בחירת החותך, הדילר משפר את היד שלו:
        </p>
        <div className="space-y-3">
          <div className="glass rounded-2xl p-3 flex items-center gap-3">
            <span className="text-2xl">1️⃣</span>
            <div>
              <p className="text-sm font-bold">זורק 4 קלפים</p>
              <p className="text-xs text-muted-foreground">בוחר את הקלפים החלשים ביותר</p>
            </div>
          </div>
          <div className="flex justify-center">
            <span className="text-lg text-purple-400 animate-pulse">⬇️</span>
          </div>
          <div className="glass rounded-2xl p-3 flex items-center gap-3">
            <span className="text-2xl">2️⃣</span>
            <div>
              <p className="text-sm font-bold">לוקח את הקופה</p>
              <p className="text-xs text-muted-foreground">מקבל 4 קלפים חדשים!</p>
            </div>
          </div>
        </div>
        <div className="flex justify-center gap-2 mt-3">
          <FaceDownCard />
          <FaceDownCard />
          <FaceDownCard />
          <FaceDownCard />
        </div>
        <p className="text-xs text-center text-muted-foreground">
          💡 זו הזדמנות לשפר את היד בגדול!
        </p>
      </div>
    ),
  },

  // 5 — How tricks work
  {
    icon: '🎮',
    title: 'איך משחקים?',
    content: (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground text-center">
          המשחק מורכב מ-<span className="text-purple-400 font-bold">16 סיבובים</span> (לקיחות)
        </p>
        <div className="glass rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-xl shrink-0">1.</span>
            <p className="text-sm">שחקן פותח — שם קלף על השולחן</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xl shrink-0">2.</span>
            <p className="text-sm">כל שחקן שם קלף אחד (בכיוון השעון)</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xl shrink-0">3.</span>
            <p className="text-sm">הקלף הגבוה ביותר מנצח ולוקח!</p>
          </div>
        </div>
        <div className="flex justify-center items-center gap-3">
          <MiniCard rank="K" suit="♠" />
          <MiniCard rank="10" suit="♠" />
          <MiniCard rank="A" suit="♠" className="ring-2 ring-green-500/50" />
        </div>
        <p className="text-xs text-center text-green-400 font-bold">A♠ מנצח! (הגבוה ביותר בצבע)</p>
      </div>
    ),
  },

  // 6 — Must follow suit
  {
    icon: '🎨',
    title: 'חובה לענות צבע!',
    content: (
      <div className="space-y-4">
        <div className="glass rounded-2xl p-4 border border-amber-500/20">
          <p className="text-sm font-bold text-amber-400 mb-2">⚠️ חוק חשוב:</p>
          <p className="text-sm">
            אם הצבע הפותח הוא <SuitIcon suit="♠" size="text-base" /> ויש לך ♠ —
            <strong> חובה לשים ♠!</strong>
          </p>
        </div>
        <div className="glass rounded-2xl p-4">
          <p className="text-sm font-bold text-purple-400 mb-3">אם אין לך מהצבע?</p>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-green-400">✅</span>
              <span>אפשר לשים <strong className="text-amber-400">חותך</strong> — ולנצח!</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-green-400">✅</span>
              <span>אפשר לשים כל קלף אחר</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-blue-400">ℹ️</span>
              <span className="text-muted-foreground">אין חובה לשים קלף חזק יותר</span>
            </div>
          </div>
        </div>
      </div>
    ),
  },

  // 7 — Who wins a trick
  {
    icon: '🏆',
    title: 'מי מנצח לקיחה?',
    content: (
      <div className="space-y-4">
        <div className="glass rounded-2xl p-4 space-y-4">
          <div>
            <p className="text-sm font-bold text-amber-400 mb-2">אם יש חותך בלקיחה:</p>
            <div className="flex items-center justify-center gap-2">
              <MiniCard rank="A" suit="♠" />
              <MiniCard rank="K" suit="♠" />
              <MiniCard rank="3" suit="♣" className="ring-2 ring-amber-500/50" />
            </div>
            <p className="text-xs text-center mt-2 text-amber-400">3♣ מנצח! (♣ = חותך)</p>
          </div>
          <div className="border-t border-white/10 pt-4">
            <p className="text-sm font-bold text-purple-400 mb-2">בלי חותך:</p>
            <div className="flex items-center justify-center gap-2">
              <MiniCard rank="J" suit="♥" className="ring-2 ring-green-500/50" />
              <MiniCard rank="5" suit="♥" />
              <MiniCard rank="K" suit="♦" />
            </div>
            <p className="text-xs text-center mt-2 text-green-400">J♥ מנצח! (הגבוה ביותר מהצבע הפותח)</p>
          </div>
        </div>
      </div>
    ),
  },

  // 8 — Card ranking
  {
    icon: '📊',
    title: 'דירוג הקלפים',
    content: (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground text-center">מהגבוה ביותר לנמוך ביותר:</p>
        <div className="glass rounded-2xl p-4">
          <div className="flex flex-wrap justify-center gap-1.5">
            {RANKS.map((r, i) => (
              <div key={r} className={cn(
                'w-8 h-10 sm:w-9 sm:h-11 rounded-lg flex items-center justify-center text-xs sm:text-sm font-black',
                'bg-gradient-to-br shadow-md',
                i === 0 ? 'from-amber-500 to-orange-600 text-white ring-2 ring-amber-400/50' :
                i <= 3 ? 'from-purple-600 to-purple-800 text-white' :
                'from-gray-100 to-gray-200 text-gray-800',
              )}>
                {r}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-3 px-2">
            <span className="text-[10px] text-amber-400 font-bold">← גבוה</span>
            <span className="text-[10px] text-muted-foreground font-bold">נמוך →</span>
          </div>
        </div>
        <div className="glass rounded-2xl p-3 text-center">
          <p className="text-xs text-muted-foreground">
            <span className="text-amber-400 font-bold">A</span> (אס) הוא הקלף הגבוה ביותר
            • <span className="text-purple-400 font-bold">2</span> הוא הנמוך ביותר
          </p>
        </div>
      </div>
    ),
  },

  // 9 — Scoring
  {
    icon: '⭐',
    title: 'ניקוד',
    content: (
      <div className="space-y-4">
        <div className="glass rounded-2xl p-4 text-center glow-primary">
          <p className="text-lg font-mono font-bold text-gradient-primary">נקודות = לקיחות − יעד</p>
        </div>
        <div className="space-y-2">
          <div className="glass rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-green-400 text-lg">📈</span>
              <span className="text-sm">יעד 5, לקחת 7</span>
            </div>
            <span className="font-black text-green-400 text-lg">+2</span>
          </div>
          <div className="glass rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-yellow-400 text-lg">🎯</span>
              <span className="text-sm">יעד 3, לקחת 3</span>
            </div>
            <span className="font-black text-muted-foreground text-lg">0</span>
          </div>
          <div className="glass rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-rose-400 text-lg">📉</span>
              <span className="text-sm">יעד 8, לקחת 5</span>
            </div>
            <span className="font-black text-rose-400 text-lg">-3</span>
          </div>
        </div>
        <p className="text-xs text-center text-purple-400 font-bold">
          🏆 הראשון שמגיע ל-10 נקודות — מנצח!
        </p>
      </div>
    ),
  },

  // 10 — Exchange
  {
    icon: '🔄',
    title: 'החלפת קלפים',
    content: (
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground text-center">(מהיד השנייה והלאה)</p>
        <div className="glass rounded-2xl p-4 space-y-3">
          <p className="text-sm">
            מי ש<span className="text-green-400 font-bold">עשה יותר</span> מהיעד →
            נותן קלפים למי ש<span className="text-rose-400 font-bold">עשה פחות</span>
          </p>
          <div className="border-t border-white/10 pt-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-green-400">📤</span>
              <p className="text-xs">הנותן בוחר את הקלפים <strong>החלשים</strong> שלו</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-rose-400">📥</span>
              <p className="text-xs">המקבל <strong className="text-amber-400">חייב להחזיר</strong> את הקלף הגבוה ביותר באותו צבע!</p>
            </div>
          </div>
        </div>
        <div className="glass rounded-2xl p-3 text-center border border-amber-500/20">
          <p className="text-xs text-amber-400">
            💡 <strong>טיפ אסטרטגי:</strong> נותנים חותכים נמוכים כדי &quot;לשרוף&quot; חותכים גבוהים ליריב!
          </p>
        </div>
      </div>
    ),
  },

  // 11 — Tie breakers
  {
    icon: '⚖️',
    title: 'שוברי שוויון',
    content: (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground text-center">אם שני שחקנים מגיעים ל-10 באותה יד:</p>
        <div className="space-y-2">
          <div className="glass rounded-xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-sm font-black text-white shrink-0">1</div>
            <p className="text-sm">מי שהרוויח <strong>יותר נקודות</strong> ביד האחרונה</p>
          </div>
          <div className="glass rounded-xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-sm font-black text-white shrink-0">2</div>
            <p className="text-sm">מי שלקח את <strong>הלקיחה האחרונה</strong></p>
          </div>
          <div className="glass rounded-xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-sm font-black text-white shrink-0">3</div>
            <p className="text-sm">מי שלקח לקיחה <strong>מאוחרת יותר</strong></p>
          </div>
        </div>
      </div>
    ),
  },

  // 12 — Ready!
  {
    icon: '🚀',
    title: 'מוכנים לשחק!',
    content: (
      <div className="space-y-5 text-center">
        <div className="flex justify-center gap-2">
          {SUITS.map((s, i) => (
            <div key={s} className="animate-float" style={{ animationDelay: `${i * 150}ms` }}>
              <SuitIcon suit={s} size="text-4xl" />
            </div>
          ))}
        </div>
        <div className="glass rounded-2xl p-4 space-y-2">
          <p className="text-sm font-bold text-purple-400">סיכום מהיר:</p>
          <div className="text-xs text-muted-foreground space-y-1 text-start">
            <p>🎯 כל שחקן מנסה לקחת את מספר הלקיחות שלו (3, 5, או 8)</p>
            <p>✂️ הדילר בוחר חותך — הצבע החזק ביותר</p>
            <p>🎨 חובה לענות צבע — אם אין, אפשר לחתוך</p>
            <p>⭐ מי שעושה יותר מהיעד מרוויח נקודות</p>
            <p>🏆 ראשון ל-10 נקודות מנצח!</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">עכשיו אתה מוכן! 🎉</p>
      </div>
    ),
  },
];

export default function RulesPage() {
  const router = useRouter();
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const [animating, setAnimating] = useState(false);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const total = slides.length;
  const isLast = current === total - 1;
  const isFirst = current === 0;

  const goTo = useCallback((idx: number, dir: 'next' | 'prev') => {
    if (animating || idx < 0 || idx >= total) return;
    setDirection(dir);
    setAnimating(true);
    setTimeout(() => {
      setCurrent(idx);
      setAnimating(false);
    }, 200);
  }, [animating, total]);

  const next = useCallback(() => { if (!isLast) goTo(current + 1, 'next'); }, [current, isLast, goTo]);
  const prev = useCallback(() => { if (!isFirst) goTo(current - 1, 'prev'); }, [current, isFirst, goTo]);

  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchMove = (e: React.TouchEvent) => { touchEndX.current = e.touches[0].clientX; };
  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) {
      // RTL: swipe left = prev, swipe right = next
      if (diff > 0) prev();
      else next();
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') next(); // RTL
      if (e.key === 'ArrowRight') prev(); // RTL
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [next, prev]);

  const slide = slides[current];

  return (
    <div className="flex flex-col min-h-[100dvh] relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute top-[-10%] right-[-15%] w-[350px] h-[350px] rounded-full bg-purple-600/8 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-15%] w-[350px] h-[350px] rounded-full bg-blue-600/8 blur-[120px] pointer-events-none" />

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 z-10">
        <button onClick={() => router.push('/')} className="text-muted-foreground text-sm hover:text-foreground transition-colors">
          ← חזרה
        </button>
        {!isLast && (
          <button onClick={() => goTo(total - 1, 'next')} className="text-muted-foreground text-xs hover:text-foreground transition-colors">
            דלג →
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="px-6 mb-2 z-10">
        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full progress-bar"
            style={{ width: `${((current + 1) / total) * 100}%` }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground mt-1 text-center">{current + 1} / {total}</p>
      </div>

      {/* Slide content */}
      <div
        className="flex-1 flex flex-col items-center px-4 z-10 overflow-y-auto"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className={cn(
          'w-full max-w-md transition-all duration-200',
          animating && direction === 'next' && 'opacity-0 -translate-x-8',
          animating && direction === 'prev' && 'opacity-0 translate-x-8',
          !animating && 'opacity-100 translate-x-0',
        )}>
          {/* Icon */}
          <div className="text-5xl text-center mb-3 animate-float">{slide.icon}</div>

          {/* Title */}
          <h2 className="text-2xl font-black text-gradient-primary text-center mb-5">
            {slide.title}
          </h2>

          {/* Content */}
          <div className="mb-6">{slide.content}</div>
        </div>
      </div>

      {/* Navigation */}
      <div className="px-4 pb-6 pt-3 z-10 safe-bottom">
        {/* Dots */}
        <div className="flex justify-center gap-1.5 mb-4">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i, i > current ? 'next' : 'prev')}
              className={cn(
                'h-2 rounded-full transition-all duration-300',
                i === current ? 'w-6 bg-gradient-to-l from-purple-500 to-blue-500' : 'w-2 bg-white/15 hover:bg-white/25',
              )}
            />
          ))}
        </div>

        {/* Buttons */}
        <div className="flex gap-3 max-w-md mx-auto">
          {!isFirst && (
            <Button
              variant="outline"
              size="lg"
              onClick={prev}
              className="flex-1 rounded-2xl text-base h-14"
            >
              → הקודם
            </Button>
          )}
          {isLast ? (
            <Button
              variant="glow"
              size="lg"
              onClick={() => router.push('/')}
              className="flex-1 rounded-2xl text-base h-14"
            >
              🎮 התחל לשחק!
            </Button>
          ) : (
            <Button
              variant="glow"
              size="lg"
              onClick={next}
              className="flex-1 rounded-2xl text-base h-14"
            >
              {isFirst ? 'בואו נתחיל! ←' : 'הבא ←'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
