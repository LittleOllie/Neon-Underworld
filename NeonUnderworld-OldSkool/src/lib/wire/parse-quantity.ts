const UNITS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};

const TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

const SCALES: Record<string, number> = {
  hundred: 100,
  thousand: 1_000,
  million: 1_000_000,
};

const NUMBER_WORDS = new Set([
  ...Object.keys(UNITS),
  ...Object.keys(TENS),
  ...Object.keys(SCALES),
  'a',
  'an',
  'and',
]);

function isNumberWord(word: string): boolean {
  return NUMBER_WORDS.has(word);
}

/** Parse comma-separated digit strings such as `10,000`. */
export function parseDigitQuantity(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!/^[\d,]+$/.test(trimmed)) return null;

  const normalized = trimmed.replace(/,/g, '');
  if (!/^\d+$/.test(normalized)) return null;

  const value = Number(normalized);
  if (!Number.isSafeInteger(value) || value < 1) return null;
  return value;
}

/** Parse common English number phrases deterministically. */
export function parseSpokenNumberPhrase(raw: string): number | null {
  const words = raw
    .trim()
    .toLowerCase()
    .replace(/-/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0 && word !== 'and');

  if (words.length === 0) return null;

  let total = 0;
  let current = 0;

  for (const word of words) {
    if (word === 'a' || word === 'an') {
      current += 1;
      continue;
    }

    if (word in UNITS) {
      current += UNITS[word];
      continue;
    }

    if (word in TENS) {
      current += TENS[word];
      continue;
    }

    if (word in SCALES) {
      const scale = SCALES[word];
      if (current === 0) current = 1;
      current *= scale;
      if (scale >= 1_000) {
        total += current;
        current = 0;
      }
      continue;
    }

    return null;
  }

  const value = total + current;
  if (!Number.isSafeInteger(value) || value < 1) return null;
  return value;
}

/**
 * Consume a leading quantity from text — digits with commas or spoken-number words.
 * Returns the parsed quantity and the remaining item phrase.
 */
export function parseLeadingQuantity(text: string): { quantity: number; rest: string } | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const digitMatch = trimmed.match(/^([\d,]+)\s+(.+)$/);
  if (digitMatch) {
    const quantity = parseDigitQuantity(digitMatch[1]);
    if (quantity === null) return null;
    return { quantity, rest: digitMatch[2].trim() };
  }

  const words = trimmed.split(/\s+/);
  let index = 0;
  while (index < words.length && isNumberWord(words[index]!.toLowerCase())) {
    index += 1;
  }

  if (index === 0) return null;

  const spoken = parseSpokenNumberPhrase(words.slice(0, index).join(' '));
  if (spoken === null) return null;

  const rest = words.slice(index).join(' ').trim();
  if (!rest) return null;

  return { quantity: spoken, rest };
}

export function isMaxQuantityKeyword(word: string): boolean {
  const normalized = word.toLowerCase();
  return normalized === 'max' || normalized === 'maximum';
}
