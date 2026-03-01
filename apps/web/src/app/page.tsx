'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';

function Sparkle({ style, size, color, delay }: { style: React.CSSProperties; size: number; color: string; delay: number }) {
  return (
    <div
      className="absolute rounded-full pointer-events-none animate-sparkle"
      style={{
        ...style,
        width: size,
        height: size,
        background: color,
        boxShadow: `0 0 ${size * 2}px ${color}`,
        animationDelay: `${delay}s`,
      }}
    />
  );
}

const SPARKLES = [
  { top: '8%', left: '15%', size: 3, color: '#f59e0b', delay: 0 },
  { top: '12%', left: '78%', size: 2, color: '#a78bfa', delay: 0.5 },
  { top: '6%', left: '45%', size: 2.5, color: '#34d399', delay: 1.2 },
  { top: '18%', left: '88%', size: 2, color: '#f472b6', delay: 0.3 },
  { top: '25%', left: '8%', size: 3, color: '#38bdf8', delay: 1.5 },
  { top: '22%', left: '92%', size: 2, color: '#fbbf24', delay: 0.8 },
  { top: '35%', left: '5%', size: 2, color: '#a78bfa', delay: 2.0 },
  { top: '40%', left: '95%', size: 2.5, color: '#34d399', delay: 0.2 },
  { top: '55%', left: '3%', size: 2, color: '#f59e0b', delay: 1.0 },
  { top: '60%', left: '92%', size: 3, color: '#38bdf8', delay: 1.8 },
  { top: '70%', left: '10%', size: 2, color: '#f472b6', delay: 0.6 },
  { top: '75%', left: '88%', size: 2, color: '#fbbf24', delay: 1.4 },
  { top: '85%', left: '15%', size: 3, color: '#a78bfa', delay: 0.9 },
  { top: '90%', left: '82%', size: 2.5, color: '#34d399', delay: 1.7 },
  { top: '15%', left: '30%', size: 1.5, color: '#fbbf24', delay: 2.2 },
  { top: '45%', left: '12%', size: 1.5, color: '#38bdf8', delay: 0.4 },
  { top: '50%', left: '85%', size: 2, color: '#f59e0b', delay: 1.1 },
  { top: '30%', left: '70%', size: 1.5, color: '#a78bfa', delay: 1.6 },
  { top: '65%', left: '20%', size: 2, color: '#34d399', delay: 0.7 },
  { top: '80%', left: '60%', size: 1.5, color: '#f472b6', delay: 2.1 },
  { top: '10%', left: '60%', size: 2, color: '#fbbf24', delay: 1.3 },
  { top: '48%', left: '50%', size: 1.5, color: '#38bdf8', delay: 0.1 },
];

export default function HomePage() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] p-6 text-center relative overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 50% 30%, hsl(228, 30%, 12%) 0%, hsl(228, 25%, 6%) 70%)' }}>

      {/* Sparkles */}
      {SPARKLES.map((s, i) => (
        <Sparkle key={i} style={{ top: s.top, left: s.left }} size={s.size} color={s.color} delay={s.delay} />
      ))}

      {/* Logo image */}
      <div className="relative z-10 animate-scale-in">
        <Image
          src="/logo-358.png"
          alt="3-5-8"
          width={700}
          height={600}
          className="w-[68vw] sm:w-[40vw] max-w-[450px] h-auto drop-shadow-2xl"
          priority
        />
      </div>

      {/* Subtitle */}
      <p className="text-muted-foreground text-base sm:text-lg tracking-wide mb-8 mt-1 z-10">משחק קלפים לשלושה שחקנים</p>

      {/* Buttons */}
      <div className="w-full max-w-sm flex flex-col gap-3.5 relative z-10">
        <Button size="lg" variant="glow" className="w-full text-lg h-16 rounded-2xl" onClick={() => router.push('/local/vs-computer')}>
          שחק סולו
        </Button>

        <Button size="lg" variant="outline" className="w-full text-lg h-16 rounded-2xl" onClick={() => router.push('/online')}>
          שחק עם חברים
        </Button>

        <button
          onClick={() => router.push('/rules')}
          className="w-full h-12 rounded-2xl text-base font-medium text-muted-foreground hover:text-foreground transition-all active:scale-[0.97] flex items-center justify-center gap-2"
        >
          חוקי המשחק
        </button>
      </div>
    </div>
  );
}
