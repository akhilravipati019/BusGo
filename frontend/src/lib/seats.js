// seat_map is a flat array of labels: seater "1A","1B",... / sleeper "L1",...,"U1",...
// normalizeSeatMap turns it into decks -> rows -> cells (null = aisle) for rendering.

const chunk = (arr, n) => {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

const withAisle = (rowSeats, gapAfter) => [
  ...rowSeats.slice(0, gapAfter),
  null,
  ...rowSeats.slice(gapAfter),
];

function deck(name, seats, perRow, gapAfter) {
  return { name, rows: chunk(seats, perRow).map((r) => withAisle(r, gapAfter)) };
}

export function normalizeSeatMap(seatMap, busType) {
  if (seatMap && !Array.isArray(seatMap) && Array.isArray(seatMap.decks)) {
    return seatMap; // already structured
  }
  const flat = Array.isArray(seatMap) ? seatMap : [];

  const lower = flat.filter((s) => /^L/i.test(s));
  const upper = flat.filter((s) => /^U/i.test(s));
  if (busType === 'AC_SLEEPER' || (lower.length && upper.length)) {
    return {
      kind: 'sleeper',
      decks: [
        deck('Lower deck', lower.length ? lower : flat.slice(0, Math.ceil(flat.length / 2)), 3, 1),
        deck('Upper deck', upper.length ? upper : flat.slice(Math.ceil(flat.length / 2)), 3, 1),
      ],
    };
  }

  const cols = new Set(flat.map((s) => s.replace(/^\d+/, '')).filter(Boolean));
  const perRow = cols.size === 3 ? 3 : 4;
  return { kind: 'seater', decks: [deck('', flat, perRow, 2)] };
}

export function generateSeatMap(busType, totalSeats, plan) {
  const n = Math.max(0, Number(totalSeats) || 0);
  if (busType === 'AC_SLEEPER') {
    const lowerCount = Math.ceil(n / 2);
    const mk = (p, c) => Array.from({ length: c }, (_, i) => `${p}${i + 1}`);
    return [...mk('L', lowerCount), ...mk('U', n - lowerCount)];
  }
  const perRow = plan === '2+1' ? 3 : 4;
  const letters = 'ABCDEF';
  return Array.from({ length: n }, (_, i) => `${Math.floor(i / perRow) + 1}${letters[i % perRow]}`);
}
