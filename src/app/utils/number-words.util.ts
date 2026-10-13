/**
 * Utility functions for converting spoken number words to numeric values
 * and comparing spoken responses with target numbers.
 */

const ONES_MAP: Record<string, number> = {
  zero: 0,
  oh: 0,
  one: 1,
  won: 1,
  two: 2,
  too: 2,
  three: 3,
  four: 4,
  for: 4,
  fore: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  ate: 8,
  nine: 9,
};

const TEENS_MAP: Record<string, number> = {
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

const TENS_MAP: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fourty: 40, // common phonetic spelling
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

const SCALES_MAP: Record<string, number> = {
  hundred: 100,
  thousand: 1000,
  million: 1000000,
};

/**
 * Converts a spoken English number phrase or digit string into a numeric value.
 * Returns null if the text cannot be interpreted as a valid number.
 */
export function wordsToNumber(input: string): number | null {
  if (!input || typeof input !== 'string') return null;

  let cleaned = input.toLowerCase().trim();

  // Strip leading conversational filler phrases
  cleaned = cleaned.replace(/^(the\s+answer\s+is|it\s+is|it's|i\s+think\s+it's|um|uh)\s+/i, '').trim();

  // Remove common punctuation while preserving minus/hyphens
  cleaned = cleaned.replace(/[.,!?;:()"\u3001\u3002\uff01\uff1f]/g, '').trim();

  if (!cleaned) return null;

  // Direct numeric representation (e.g. "25", "-5", "+12", "0")
  if (/^[+-]?\d+(\.\d+)?$/.test(cleaned)) {
    const num = Number(cleaned);
    return isNaN(num) ? null : num;
  }

  // Handle negative prefixes
  let sign = 1;
  if (cleaned.startsWith('negative ') || cleaned.startsWith('negative-') || cleaned.startsWith('-')) {
    sign = -1;
    cleaned = cleaned.replace(/^(negative[\s-]+|-)/, '').trim();
  } else if (cleaned.startsWith('minus ') || cleaned.startsWith('minus-')) {
    sign = -1;
    cleaned = cleaned.replace(/^minus[\s-]+/, '').trim();
  }

  // If the rest is numeric digits after sign stripping (e.g. "negative 25", "minus 5")
  if (/^\d+(\.\d+)?$/.test(cleaned)) {
    const num = Number(cleaned);
    return isNaN(num) ? null : sign * num;
  }

  // Split into tokens by spaces or hyphens
  const tokens = cleaned.split(/[\s-]+/).filter(t => t.length > 0);
  if (tokens.length === 0) return null;

  // Single word zero check
  if (tokens.length === 1 && (tokens[0] === 'zero' || tokens[0] === 'oh')) {
    return 0;
  }

  let total = 0;
  let current = 0;
  let hasValidToken = false;
  let lastCategory: 'ones' | 'teens' | 'tens' | 'scale' | 'and' | null = null;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token === 'and') {
      if (!hasValidToken || lastCategory === 'and') return null;
      lastCategory = 'and';
      continue;
    }

    if (token === 'a') {
      // "a hundred", "a thousand"
      const next = tokens[i + 1];
      if (next && SCALES_MAP[next]) {
        current = 1;
        hasValidToken = true;
        continue;
      }
      return null;
    }

    if (token in ONES_MAP) {
      if (token === 'zero' || token === 'oh') return null; // zero cannot be part of compound word
      // Cannot follow another ones or teens directly (e.g. "five five" is invalid)
      if (lastCategory === 'ones' || lastCategory === 'teens') return null;
      current += ONES_MAP[token];
      hasValidToken = true;
      lastCategory = 'ones';
    } else if (token in TEENS_MAP) {
      if (lastCategory === 'tens' || lastCategory === 'ones' || lastCategory === 'teens') return null;
      current += TEENS_MAP[token];
      hasValidToken = true;
      lastCategory = 'teens';
    } else if (token in TENS_MAP) {
      if (lastCategory === 'tens' || lastCategory === 'ones' || lastCategory === 'teens') return null;
      current += TENS_MAP[token];
      hasValidToken = true;
      lastCategory = 'tens';
    } else if (token in SCALES_MAP) {
      const scale = SCALES_MAP[token];
      if (current === 0) current = 1;
      if (scale === 100) {
        current = current * 100;
        lastCategory = 'scale';
      } else {
        total += current * scale;
        current = 0;
        lastCategory = 'scale';
      }
      hasValidToken = true;
    } else if (/^\d+$/.test(token)) {
      current += Number(token);
      hasValidToken = true;
      lastCategory = 'ones';
    } else {
      // Unrecognized word
      return null;
    }
  }

  if (!hasValidToken) return null;
  return sign * (total + current);
}

/**
 * Checks whether two values (whether spoken words, digit strings, or a mix)
 * represent the same numeric value.
 * Returns false if either value is not a valid number.
 */
export function areNumberWordsMatching(a: string, b: string): boolean {
  const numA = wordsToNumber(a);
  const numB = wordsToNumber(b);

  if (numA !== null && numB !== null) {
    return numA === numB;
  }

  return false;
}
