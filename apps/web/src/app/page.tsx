'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] p-6 text-center relative overflow-hidden">
      <div className="absolute top-[-20%] right-[-10%] w-[400px] h-[400px] rounded-full bg-purple-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[400px] h-[400px] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />

      <div className="mb-10 relative z-10">
        <div className="text-7xl mb-5 animate-float">🃏</div>
        <h1 className="text-6xl font-black text-gradient-primary tracking-tight">
          3-5-8
        </h1>
        <p className="text-muted-foreground mt-3 text-lg tracking-wide">משחק קלפים לשלושה שחקנים</p>
      </div>

      <div className="w-full max-w-xs flex flex-col gap-4 relative z-10">
        <Button size="lg" variant="glow" className="w-full text-lg h-16 rounded-2xl" onClick={() => router.push('/local/vs-computer')}>
          <span className="ml-2">🤖</span> נגד המחשב
        </Button>

        <Button size="lg" variant="outline" className="w-full text-lg h-16 rounded-2xl" onClick={() => router.push('/online')}>
          <span className="ml-2">👥</span> שחק עם חברים
        </Button>

        <Button size="lg" variant="ghost" className="w-full text-base h-12 rounded-2xl" onClick={() => router.push('/rules')}>
          <span className="ml-2">📖</span> חוקי המשחק
        </Button>
      </div>

    </div>
  );
}
