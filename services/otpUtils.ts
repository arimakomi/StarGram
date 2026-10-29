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

/**
 * Strips accidental prefixes ("Bearer ", "Api-Key:"), quotes, and whitespace from an SMS API key.
 */
export function cleanSmsApiKey(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return '';
  let val = raw.trim();
  val = val.replace(/^["']+|["']+$/g, '').trim();
  val = val.replace(/^(Bearer|Api-Key)\s*:?\s*/i, '').trim();
  return val;
}

/**
 * Normalizes Persian/Arabic digits and trims SMS line numbers or pattern codes.
 */
export function cleanSmsConfigField(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return '';
  return normalizeDigits(raw).trim();
}

export interface OtpErrorDetails {
  httpStatus?: number;
  statusText?: string;
  endpoint?: string;
  method?: string;
  sendMode?: string;
  providerMessage?: string;
  validationErrors?: Record<string, any> | string[] | string | null;
  networkError?: {
    name?: string;
    message?: string;
    code?: string;
    cause?: string;
  } | null;
  requestSummary?: Record<string, any> | null;
  rawResponse?: any;
  timestamp?: string;
}

export interface FormattedOtpError {
  summary: string;
  statusLine: string;
  validationLines: string[];
  technicalReport: string;
  hasTechnicalDetails: boolean;
}

/**
 * Formats any API/Gateway/Network error response from OTP endpoints into a complete,
 * unabridged diagnostic report so neither the user nor the admin is left guessing why SMS failed.
 */
export function formatOtpFullError(responseOrError: any): FormattedOtpError {
  if (!responseOrError) {
    return {
      summary: 'خطای نامشخص در ارتباط با سرویس پیامک',
      statusLine: '',
      validationLines: [],
      technicalReport: 'No error object provided.',
      hasTechnicalDetails: false
    };
  }

  if (typeof responseOrError === 'string') {
    return {
      summary: responseOrError,
      statusLine: '',
      validationLines: [],
      technicalReport: responseOrError,
      hasTechnicalDetails: false
    };
  }

  const details: OtpErrorDetails = responseOrError.errorDetails || responseOrError.details || {};
  const httpStatus = details.httpStatus ?? responseOrError.httpStatus ?? responseOrError.status ?? 0;
  const statusText = details.statusText || responseOrError.statusText || '';
  const endpoint = details.endpoint || responseOrError.endpoint || '';
  const method = details.method || 'POST';
  const sendMode = details.sendMode || '';

  // Extract validation errors if present (e.g. IranPayamak 422 { errors: { code: [...], line_number: [...] } })
  const validationLines: string[] = [];
  const rawValErrors =
    details.validationErrors ??
    responseOrError.validationErrors ??
    responseOrError.errors ??
    (details.rawResponse && typeof details.rawResponse === 'object' ? details.rawResponse.errors : null);

  if (rawValErrors) {
    if (Array.isArray(rawValErrors)) {
      for (const item of rawValErrors) {
        if (item) validationLines.push(typeof item === 'string' ? item : JSON.stringify(item));
      }
    } else if (typeof rawValErrors === 'object') {
      for (const [field, msgs] of Object.entries(rawValErrors)) {
        if (Array.isArray(msgs)) {
          validationLines.push(`${field}: ${msgs.join(' ، ')}`);
        } else if (msgs !== undefined && msgs !== null) {
          validationLines.push(`${field}: ${typeof msgs === 'string' ? msgs : JSON.stringify(msgs)}`);
        }
      }
    } else if (typeof rawValErrors === 'string') {
      validationLines.push(rawValErrors);
    }
  }

  const primaryMessage =
    responseOrError.gatewayError ||
    responseOrError.error ||
    responseOrError.message ||
    details.providerMessage ||
    (details.networkError?.message ? `خطای شبکه: ${details.networkError.message}` : '') ||
    'خطا در ارسال یا بررسی کد تایید پیامکی';

  let summary = String(primaryMessage);
  if (validationLines.length > 0 && !summary.includes(validationLines[0])) {
    summary = `${summary} (${validationLines.join(' | ')})`;
  }
  if (httpStatus && httpStatus > 0 && !summary.includes(String(httpStatus))) {
    summary = `${summary} [کد وضعیت HTTP: ${httpStatus}${statusText ? ` ${statusText}` : ''}]`;
  }

  const statusParts: string[] = [];
  if (httpStatus && httpStatus > 0) statusParts.push(`HTTP ${httpStatus}${statusText ? ` (${statusText})` : ''}`);
  if (sendMode) statusParts.push(`Mode: ${sendMode}`);
  if (endpoint) statusParts.push(`${method} ${endpoint}`);
  if (details.networkError?.code) statusParts.push(`Code: ${details.networkError.code}`);
  const statusLine = statusParts.join(' • ');

  const reportLines: string[] = [];
  reportLines.push(`پیام خطا: ${primaryMessage}`);
  if (statusLine) reportLines.push(`وضعیت درخواست: ${statusLine}`);
  if (details.providerMessage && details.providerMessage !== primaryMessage) {
    reportLines.push(`پاسخ درگاه: ${details.providerMessage}`);
  }
  if (validationLines.length > 0) {
    reportLines.push(`خطاهای اعتبارسنجی فیلدها:\n  - ${validationLines.join('\n  - ')}`);
  }
  if (details.networkError) {
    const netParts = [
      details.networkError.name,
      details.networkError.code ? `(${details.networkError.code})` : '',
      details.networkError.message,
      details.networkError.cause ? `Cause: ${details.networkError.cause}` : ''
    ].filter(Boolean);
    if (netParts.length > 0) {
      reportLines.push(`جزئیات خطای شبکه: ${netParts.join(' - ')}`);
    }
  }
  if (details.requestSummary) {
    try {
      reportLines.push(`خلاصه درخواست ارسالی:\n${JSON.stringify(details.requestSummary, null, 2)}`);
    } catch {
      // ignore
    }
  }
  const rawBody = details.rawResponse ?? responseOrError.rawBody;
  if (rawBody !== undefined && rawBody !== null && rawBody !== '') {
    try {
      const formattedRaw = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody, null, 2);
      reportLines.push(`پاسخ کامل دریافتی (Raw Response):\n${formattedRaw}`);
    } catch {
      reportLines.push(`پاسخ کامل دریافتی: ${String(rawBody)}`);
    }
  }

  const hasTechnicalDetails = Boolean(
    details.httpStatus ||
      details.endpoint ||
      details.providerMessage ||
      validationLines.length > 0 ||
      details.networkError ||
      details.requestSummary ||
      rawBody ||
      (httpStatus && httpStatus > 0)
  );

  return {
    summary,
    statusLine,
    validationLines,
    technicalReport: reportLines.join('\n'),
    hasTechnicalDetails
  };
}

