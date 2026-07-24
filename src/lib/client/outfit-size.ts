// Meest voorkomende maat uit een lijst; leeg bij 0 items of een gelijkspel voor de eerste plek.
export function mostCommonSize(sizes: string[]): string {
  if (sizes.length === 0) return '';
  const counts = new Map<string, number>();
  for (const s of sizes) counts.set(s, (counts.get(s) ?? 0) + 1);
  let best = '';
  let bestN = 0;
  let tie = false;
  for (const [s, n] of counts) {
    if (n > bestN) {
      best = s;
      bestN = n;
      tie = false;
    } else if (n === bestN) {
      tie = true;
    }
  }
  return tie ? '' : best;
}
