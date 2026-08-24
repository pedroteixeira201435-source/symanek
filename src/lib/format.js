// Symanek Suite — shared formatting/helpers (pure logic, no mock data).

// Namibian Dollar formatter. Whole numbers show no decimals; fractional amounts
// show two. e.g. fmtN(1500) -> "N$ 1,500", fmtN(12.5) -> "N$ 12.50".
export const fmtN = (n) =>
  'N$ ' + Number(n || 0).toLocaleString('en-NA', { maximumFractionDigits: (n % 1) ? 2 : 0 });

// Derive a house-style email from a person's name (fallback when none on file).
export const staffEmail = (name) =>
  String(name || '').toLowerCase().replace(/[^a-z ]/g, '').trim().split(/ +/).join('.') + '@symanekacademy.com';
