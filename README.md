# 44 Lounge — website

React + Vite site for 44 Lounge (hookah, kitchen and bar on Abovyan Street, Yerevan), with a local admin panel.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173  ·  admin: http://localhost:5173/admin
```

Build for hosting: `npm run build` → upload the `dist/` folder.
`public/_redirects` (Netlify) and `vercel.json` (Vercel) make page refreshes on `/menu/bar` etc. work.

## Pages

| Route | Page |
|---|---|
| `/` | Home: "44" fly-through hero, intro, moving words, three menus, statement, popular dishes, hours, photo strip |
| `/menu/hookah`, `/menu/kitchen`, `/menu/bar` | Menu with tabs and category shortcuts (`/menu` opens Hookah) |
| `/about` | About |
| `/visit` | Address, hours with live open/closed status, phone, map |
| anything else | 404 page |

## Design

- Colors and fonts are CSS variables (`src/styles/site.css`), set from the admin through `src/content/theme.js`.
- Fonts: Unbounded (headings), Manrope (text), JetBrains Mono (labels), from Google Fonts.
- Motion: GSAP + ScrollTrigger, smooth scrolling with Lenis (`src/lib/motion.js`). Everything respects
  "reduce motion" in the system settings. Animations are code-only, not editable in the admin.
- Photos: `public/images/` (`menu/` dish cut-outs, `venue/` photos of the lounge).
- Open/closed status uses Yerevan time and the hours set in the admin.

## Table bookings (Telegram)

Every "Book a table" button opens a form (name, phone, guests, date, time). Requests are sent to
your Telegram chat by a bot, through `POST /api/book` (`server/booking.js`).

1. In Telegram open **@BotFather**, send `/newbot`, follow the steps and copy the **token**.
2. Send any message to your new bot (or add the bot to your staff group and write there).
3. Open `https://api.telegram.org/bot<TOKEN>/getUpdates` in a browser and copy the number after `"chat":{"id":`.
4. Copy `.env.example` to `.env.local` and fill in `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`, then restart `npm run dev`.

When hosting on Vercel, add the same two values under Project → Settings → Environment Variables
(`api/book.js` is the hosted endpoint). Until they are set, the form tells guests to call instead.

## Languages (English, Armenian, Russian)

- Switch with EN / ՀԱՅ / РУ in the top bar. The choice is remembered; first-time visitors get their browser's
  language when it is Armenian or Russian. A link can force one: `/?lang=ru`.
- English is the main text in `src/content/site.json`. Armenian and Russian translations live in the same file under
  `translations`, keyed by the English text, and are edited in the admin under **Languages**.
- A text with no translation shows in English (used on purpose for brand names such as Jameson or Al Fakher).
- Prices show `֏` in Armenian and `драм` in Russian. Armenian letters use Noto Sans Armenian.

## Dishes of the day

The home page shows a set of kitchen dishes that changes every day at 06:00 Yerevan time and is the same for every
visitor. Dishes with a photo and a price take part, one per category where possible (`src/lib/dailyDishes.js`).
The number of dishes is set in the admin under Home → Dishes of the day.

## Admin panel (texts, images, colors, fonts)

Open **http://localhost:5173/admin** while `npm run dev` is running.

- **Colors / Fonts**: six theme colors and three fonts (any Google Fonts name, or upload a font file).
- **Texts and images**: every section of every page, the full menus (categories, items, prices), hours, contacts.
  Images can be uploaded (saved to `public/uploads/`) or picked from the library.
- The right side is a live preview of unsaved changes. **Save** (or ⌘S) writes everything to `src/content/site.json`.
  The previous version is kept in `content-backups/` (last 30).

The admin and its save API only exist in `npm run dev`. `npm run build` bakes the saved content into the site and
leaves the admin out, so the deployed site has no admin page.
