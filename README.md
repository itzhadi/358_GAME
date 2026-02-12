# 3-5-8 משחק קלפים 🃏

משחק קלפים דיגיטלי מלא של **3-5-8** לשלושה שחקנים, כולל חוקים רשמיים, ניקוד מצטבר, החלפות, חותך, וקופה.

## ✨ תכונות

- 🎮 **משחק מקומי** (Pass-and-Play) — שלושה שחקנים על אותו מכשיר
- 🌐 **משחק אונליין** — חדרים עם קוד, Socket.io בזמן אמת
- 📱 **PWA** — התקנה למסך הבית, מסך מלא, עבודה אופליין
- 📖 **דף חוקים** מובנה
- 📊 **ייצוא** JSON/CSV של היסטוריית ידיים
- 🇮🇱 **עברית RTL** מלאה, Mobile-first

## 🛠️ Tech Stack

| שכבה | טכנולוגיה |
|------|-----------|
| Frontend | Next.js 14 (App Router) + TypeScript |
| UI | TailwindCSS |
| State | Zustand |
| Realtime | Socket.io |
| Backend | Fastify + TypeScript |
| DB | PostgreSQL + Prisma |
| Validation | Zod |
| Auth | JWT (guest sessions) |
| Tests | Vitest (unit) |
| Monorepo | pnpm workspaces |

## 📁 מבנה פרויקט

```
/
├── apps/
│   ├── web/          # Next.js frontend
│   └── api/          # Fastify backend + Socket.io
├── packages/
│   └── shared/       # Game engine + types + Zod schemas
├── infra/
│   └── docker-compose.yml
└── README.md
```

## 🚀 הרצה מקומית

### דרישות מוקדמות
- Node.js >= 18
- pnpm >= 8
- Docker (אופציונלי, ל-PostgreSQL)

### 1. התקנת dependencies

```bash
pnpm install
```

### 2. הרצת DB (אופציונלי — רק לאונליין)

```bash
cd infra
docker-compose up -d
cd ../apps/api
npx prisma db push
```

### 3. הרצת פיתוח

**Frontend בלבד (משחק מקומי):**
```bash
cd apps/web
pnpm dev
```

**Backend + Frontend (אונליין):**
```bash
# Terminal 1: API
cd apps/api
pnpm dev

# Terminal 2: Web
cd apps/web
pnpm dev
```

### 4. גישה
- Frontend: http://localhost:3000
- API: http://localhost:3001
- Health: http://localhost:3001/health

## 🧪 טסטים

```bash
# Unit tests (game engine)
pnpm test:shared

# All tests
pnpm test
```

## 📊 ייצוא נתונים (אונליין)

- `GET /api/rooms/:code/export.json` — כל מבנה המשחק
- `GET /api/rooms/:code/export.csv` — שורה לכל יד

## 📱 PWA

- **Android/Chrome:** כפתור "התקן אפליקציה" מופיע אוטומטית
- **iPhone/Safari:** שתף → "הוסף למסך הבית"
- **Offline:** דף "אין חיבור" + משחק מקומי עובד בלי אינטרנט

## 📋 Checklist ידני

- [ ] Android Chrome — בדיקת UI + PWA install
- [ ] iPhone Safari — בדיקת UI + Add to Home Screen
- [ ] Tablet — layout לא נשבר
- [ ] משחק מקומי מלא: חלוקה → חותך → זריקה → קופה → 16 לקיחות → ניקוד → יד הבאה
- [ ] החלפות (מיד 2+)
- [ ] שוברי שוויון
- [ ] משחק אונליין: 3 חלונות, הצטרפות, משחק מלא

## 📜 חוקי המשחק

ראו את דף החוקים המלא באפליקציה (כפתור "חוקי המשחק" במסך הבית).

## 🪪 רישיון

פרויקט פרטי.
