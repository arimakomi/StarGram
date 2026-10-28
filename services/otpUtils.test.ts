import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeDigits,
  cleanIranPhone,
  isValidIranPhone,
  sanitizeOtpCode,
  isValidOtpCode,
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
