const CITY_KEY_ALIASES: Record<string, string> = {
  tirane: 'tirana',
};

export function cityMatchKey(city: string): string {
  let k = city
    .trim()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
  k = CITY_KEY_ALIASES[k] ?? k;
  return k;
}
