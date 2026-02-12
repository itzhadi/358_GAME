'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function RulesPage() {
  const router = useRouter();

  return (
    <div className="max-w-lg mx-auto p-4 pb-20 relative">
      <div className="absolute top-0 right-[-20%] w-[300px] h-[300px] rounded-full bg-purple-600/5 blur-[100px] pointer-events-none" />

      <Button variant="ghost" onClick={() => router.push('/')} className="mb-4 text-muted-foreground">
        ← חזרה
      </Button>

      <h1 className="text-3xl font-black text-gradient-primary mb-8 text-center">📖 חוקי 3-5-8</h1>

      <div className="space-y-4 text-sm leading-relaxed">
        <Section title="🃏 מה צריך" num="1">
          <p>3 שחקנים בדיוק, חפיסה רגילה של 52 קלפים. כיוון המשחק: עם כיוון השעון.</p>
        </Section>

        <Section title="📊 דירוג קלפים" num="2">
          <p>בכל צבע: <span className="font-mono text-purple-400">A</span> (הכי גבוה) → K → Q → J → 10 → ... → <span className="font-mono text-purple-400">2</span> (הכי נמוך)</p>
        </Section>

        <Section title="📝 מונחים" num="3">
          <ul className="space-y-2">
            <li className="flex gap-2"><span className="text-purple-400">◆</span><span><strong>לקיחה (Trick):</strong> כל שחקן שם קלף אחד (3 קלפים). הגבוה מנצח.</span></li>
            <li className="flex gap-2"><span className="text-purple-400">◆</span><span><strong>צבע מוביל:</strong> הצבע של הקלף הראשון בלקיחה.</span></li>
            <li className="flex gap-2"><span className="text-purple-400">◆</span><span><strong>חותך:</strong> צבע מיוחד שמנצח כל צבע אחר.</span></li>
            <li className="flex gap-2"><span className="text-purple-400">◆</span><span><strong>קופה:</strong> 4 קלפים שנשארים בצד אחרי החלוקה.</span></li>
          </ul>
        </Section>

        <Section title="🎯 תפקידים (3-5-8)" num="4">
          <div className="grid grid-cols-3 gap-2 my-2">
            <div className="glass rounded-xl p-3 text-center">
              <div className="text-2xl font-black text-gradient-primary">8</div>
              <div className="text-xs text-muted-foreground">דילר</div>
            </div>
            <div className="glass rounded-xl p-3 text-center">
              <div className="text-2xl font-black text-gradient-primary">5</div>
              <div className="text-xs text-muted-foreground">שמאל</div>
            </div>
            <div className="glass rounded-xl p-3 text-center">
              <div className="text-2xl font-black text-gradient-primary">3</div>
              <div className="text-xs text-muted-foreground">ימין</div>
            </div>
          </div>
          <p className="text-muted-foreground">הדילר מתחלף בסוף כל יד (עם כיוון השעון).</p>
        </Section>

        <Section title="🎴 חלוקה + קופה" num="5">
          <p>הדילר מחלק 16 קלפים לכל שחקן (=48). 4 קלפים נשארים סגורים — זו ה&quot;קופה&quot;.</p>
        </Section>

        <Section title="🔄 החלפות (מהיד השנייה)" num="6">
          <p>מי שסיים מעל היעד (+) נותן קלפים למי שסיים מתחת (-).</p>
          <p className="text-amber-400/80 mt-1 font-medium">מי שקיבל חייב להחזיר: את הקלף <strong>הגבוה ביותר</strong> באותו צבע!</p>
        </Section>

        <Section title="✂️ חותך + קופה" num="7">
          <p>הדילר בוחר צבע חותך, זורק 4 קלפים, ולוקח את 4 קלפי הקופה.</p>
        </Section>

        <Section title="▶️ מי מתחיל?" num="8">
          <p className="font-bold text-purple-400">השחקן עם יעד 5 (שמאל הדילר) מתחיל את הלקיחה הראשונה.</p>
          <p className="text-muted-foreground">אחרי כן: מי שמנצח לקיחה מתחיל את הבאה.</p>
        </Section>

        <Section title="🎨 חובה לענות צבע" num="9">
          <p>אם יש לך קלף בצבע המוביל — <strong>חייב לשים אותו צבע</strong>. אם אין — מותר כל קלף.</p>
          <p className="text-muted-foreground">אין חובה לשים קלף חזק יותר.</p>
        </Section>

        <Section title="🏆 מי מנצח לקיחה?" num="10">
          <ul className="space-y-1">
            <li className="flex gap-2"><span className="text-amber-400">•</span>חותך? → החותך הגבוה ביותר מנצח.</li>
            <li className="flex gap-2"><span className="text-amber-400">•</span>בלי חותך? → הגבוה ביותר בצבע המוביל מנצח.</li>
          </ul>
        </Section>

        <Section title="📈 ניקוד (שיטה 2)" num="11">
          <div className="glass rounded-xl p-3 text-center my-2">
            <span className="text-lg font-mono font-bold text-purple-400">נקודות = לקיחות − יעד</span>
          </div>
          <p className="text-muted-foreground">דוגמה: יעד 5, לקחת 7 ⇒ +2 | הראשון שמגיע ל-10 מנצח!</p>
        </Section>

        <Section title="⚖️ שוברי שוויון" num="12">
          <ol className="list-decimal list-inside space-y-1">
            <li>מי שהרוויח יותר ביד האחרונה.</li>
            <li>אם שווה — מי שלקח את הלקיחה האחרונה.</li>
            <li>אם שניים שווים — מי שלקח לקיחה מאוחרת יותר.</li>
          </ol>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, num, children }: { title: string; num: string; children: React.ReactNode }) {
  return (
    <div className="glass-card rounded-2xl p-5 animate-fade-in">
      <h2 className="text-base font-bold mb-2">{title}</h2>
      {children}
    </div>
  );
}
