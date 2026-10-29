import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeDigits,
  cleanIranPhone,
  isValidIranPhone,
  sanitizeOtpCode,
  isValidOtpCode,
  cleanSmsApiKey,
  cleanSmsConfigField,
  formatOtpFullError,
} from './otpUtils';

test('normalizeDigits converts Persian and Arabic numerals to ASCII digits', () => {
  assert.equal(normalizeDigits('۰۹۱۲۳۴۵۶۷۸۹'), '09123456789');
  assert.equal(normalizeDigits('٠٩١٢٣٤٥٦٧٨٩'), '09123456789');
  assert.equal(normalizeDigits('کد: ۱۲۳۴۵۶'), 'کد: 123456');
});

test('cleanIranPhone normalizes +98, 0098, 98, and 9 prefixes and Persian digits', () => {
  assert.equal(cleanIranPhone('+989123456789'), '09123456789');
  assert.equal(cleanIranPhone('00989123456789'), '09123456789');
  assert.equal(cleanIranPhone('989123456789'), '09123456789');
  assert.equal(cleanIranPhone('9123456789'), '09123456789');
  assert.equal(cleanIranPhone('۰۹۱۲-۳۴۵-۶۷۸۹'), '09123456789');
});

test('isValidIranPhone validates 11-digit 09xxxxxxxxx format', () => {
  assert.equal(isValidIranPhone('09123456789'), true);
  assert.equal(isValidIranPhone('۰۹۳۵۱۲۳۴۵۶۷'), true);
  assert.equal(isValidIranPhone('+989191112233'), true);
  assert.equal(isValidIranPhone('0912345678'), false);
  assert.equal(isValidIranPhone('08123456789'), false);
});

test('sanitizeOtpCode and isValidOtpCode handle Persian digits and 5/6 digit lengths', () => {
  assert.equal(sanitizeOtpCode('۱ ۲ ۳ ۴ ۵ ۶ ۷', 6), '123456');
  assert.equal(sanitizeOtpCode('۱۲۳۴۵۶', 5), '12345');
  assert.equal(isValidOtpCode('۱۲۳۴۵۶', 6), true);
  assert.equal(isValidOtpCode('۱۲۳۴۵', 5), true);
  assert.equal(isValidOtpCode('1234', 6), false);
});

test('cleanSmsApiKey and cleanSmsConfigField normalize credentials', () => {
  assert.equal(cleanSmsApiKey('  Bearer eyJhbGciOi  '), 'eyJhbGciOi');
  assert.equal(cleanSmsApiKey('"Api-Key: abc123xyz"'), 'abc123xyz');
  assert.equal(cleanSmsConfigField(' ۳۰۰۰۵۰۵ '), '3000505');
});

test('formatOtpFullError extracts HTTP status, validation errors, and raw responses', () => {
  const errPayload = {
    success: false,
    status: 422,
    message: 'اطلاعات ارسالی معتبر نیست',
    errorDetails: {
      httpStatus: 422,
      statusText: 'Unprocessable Entity',
      endpoint: 'https://api.iranpayamak.com/ws/v1/sms/pattern',
      method: 'POST',
      sendMode: 'pattern',
      providerMessage: 'The given data was invalid.',
      validationErrors: {
        code: ['کد الگو یافت نشد'],
        line_number: ['شماره خط نامعتبر است']
      },
      rawResponse: {
        status: 'error',
        message: 'The given data was invalid.',
        errors: { code: ['کد الگو یافت نشد'] }
      }
    }
  };

  const formatted = formatOtpFullError(errPayload);
  assert.equal(formatted.hasTechnicalDetails, true);
  assert.ok(formatted.summary.includes('422'));
  assert.ok(formatted.summary.includes('کد الگو یافت نشد'));
  assert.equal(formatted.validationLines.length, 2);
  assert.ok(formatted.technicalReport.includes('https://api.iranpayamak.com/ws/v1/sms/pattern'));
  assert.ok(formatted.technicalReport.includes('The given data was invalid.'));
});

