const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/**
 * Converts Persian and Arabic numerals in a string to standard ASCII digits (0-9).
 */
export function normalizeDigits(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  let result = raw;
  for (let i = 0; i < 10; i++) {
    result = result
      .split(PERSIAN_DIGITS[i])
      .join(String(i))
      .split(ARABIC_DIGITS[i])
      .join(String(i));
  }
  return result;
}

/**
 * Cleans and normalizes an Iranian mobile number into standard 11-digit `09xxxxxxxxx` format.
 * Returns normalized string (even if partial) for input helpers, or use `isValidIranPhone` to validate.
 */
export function cleanIranPhone(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  let val = normalizeDigits(raw).trim();
  val = val.replace(/[^0-9+]/g, '');
  if (val.startsWith('+98')) val = '0' + val.slice(3);
  else if (val.startsWith('0098')) val = '0' + val.slice(4);
  else if (val.startsWith('98') && val.length >= 11) val = '0' + val.slice(2);
  else if (val.startsWith('9') && val.length === 10) val = '0' + val;
  return val;
}

/**
 * Checks whether the given string is a valid Iranian mobile phone number (`09xxxxxxxxx`).
 */
export function isValidIranPhone(raw: string): boolean {
  const cleaned = cleanIranPhone(raw);
  return /^09\d{9}$/.test(cleaned);
}

/**
 * Normalizes Persian/Arabic digits in an OTP code input and strips non-digits up to maxLength.
 */
export function sanitizeOtpCode(raw: string, maxLength: number = 6): string {
  if (!raw || typeof raw !== 'string') return '';
  const limit = maxLength === 5 ? 5 : 6;
  return normalizeDigits(raw).replace(/[^0-9]/g, '').slice(0, limit);
}

/**
 * Checks if an OTP code meets the expected length (5 or 6 digits).
 */
export function isValidOtpCode(raw: string, expectedLength?: number): boolean {
  const normalized = normalizeDigits(raw).replace(/[^0-9]/g, '');
  if (expectedLength === 5) return normalized.length === 5;
  if (expectedLength === 6) return normalized.length === 6;
  return normalized.length === 5 || normalized.length === 6;
}
