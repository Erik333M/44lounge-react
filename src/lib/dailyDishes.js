// "Dishes of the day": a set of kitchen dishes that changes once a day and is the same for every visitor.
// The day starts at 06:00 Yerevan time (not midnight), so the set never changes while the lounge is
// still open after midnight.

const DAY_STARTS_AT = 6; // hour, Yerevan time

// Yerevan "service day" as YYYY-MM-DD.
export function serviceDay(date = new Date()) {
  const shifted = new Date(date.getTime() - DAY_STARTS_AT * 3600 * 1000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Yerevan' }).format(shifted);
}

// Small deterministic random generator seeded from a string.
function seeded(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/**
 * Picks `count` dishes from the kitchen menu for `day`. Only dishes with a photo and a price take part.
 * Dishes come from as many different categories as possible, so a day is never "all pizza".
 */
export function dishesOfTheDay(kitchen, count = 6, day = serviceDay()) {
  const rand = seeded(`44lounge-${day}`);
  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const groups = shuffle(
    (kitchen?.categories || [])
      .map((c) => shuffle(c.items.filter((it) => it.image && it.price).map((it) => ({ ...it, category: c.title }))))
      .filter((g) => g.length)
  );
  // take one dish from each category in turn until there are enough
  const picked = [];
  for (let round = 0; picked.length < count && groups.some((g) => g.length > round); round++) {
    for (const g of groups) if (g[round] && picked.length < count) picked.push(g[round]);
  }
  return picked;
}
