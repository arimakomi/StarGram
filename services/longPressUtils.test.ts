import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LONG_PRESS_DELAY_MS,
  TOUCH_MOVE_THRESHOLD_PX,
  shouldCancelLongPressOnMove,
  shouldCancelLongPressOnScroll,
  shouldSuppressClickAfterLongPress,
  shouldAllowContextMenuEvent,
  clampContextMenuPosition,
} from './longPressUtils';

test('shouldCancelLongPressOnMove tolerates micro-jitter and cancels on scroll movement', () => {
  const start = { x: 100, y: 200 };
  // Micro-jitter within threshold (e.g., 3px x, 4px y => hypot 5px <= 10px)
  assert.equal(shouldCancelLongPressOnMove(start, { x: 103, y: 204 }), false);
  // Movement exceeding vertical threshold during scroll start
  assert.equal(shouldCancelLongPressOnMove(start, { x: 100, y: 212 }), true);
  // Movement exceeding horizontal threshold
  assert.equal(shouldCancelLongPressOnMove(start, { x: 115, y: 200 }), true);
  // Diagonal movement exceeding Euclidean threshold (8px x, 8px y => hypot ~11.3px > 10px)
  assert.equal(shouldCancelLongPressOnMove(start, { x: 108, y: 208 }), true);
  // Null start position always cancels safely
  assert.equal(shouldCancelLongPressOnMove(null, { x: 100, y: 200 }), true);
});

test('shouldCancelLongPressOnScroll detects container scroll displacement', () => {
  assert.equal(shouldCancelLongPressOnScroll(150, 151, 2), false);
  assert.equal(shouldCancelLongPressOnScroll(150, 160, 2), true);
  assert.equal(shouldCancelLongPressOnScroll(null, 150, 2), true);
});

test('shouldSuppressClickAfterLongPress blocks synthetic clicks after long press', () => {
  const t0 = 10000;
  // Active flag suppresses click immediately
  assert.equal(shouldSuppressClickAfterLongPress(true, 0, t0), true);
  // Within suppression window after touchend
  assert.equal(shouldSuppressClickAfterLongPress(false, t0, t0 + 120), true);
  // Outside suppression window allows normal tap clicks
  assert.equal(shouldSuppressClickAfterLongPress(false, t0, t0 + 800), false);
  // Never long-pressed allows normal tap clicks
  assert.equal(shouldSuppressClickAfterLongPress(false, 0, t0), false);
});

test('shouldAllowContextMenuEvent prevents context menu when touch has scrolled', () => {
  // Desktop right-click (touch not active)
  assert.equal(shouldAllowContextMenuEvent(false, false, false), true);
  // Stationary touch long-press (not yet opened)
  assert.equal(shouldAllowContextMenuEvent(true, false, false), true);
  // Touch moved/scrolled -> must block context menu
  assert.equal(shouldAllowContextMenuEvent(true, true, false), false);
  // Already open for target -> avoid duplicate re-open
  assert.equal(shouldAllowContextMenuEvent(true, false, true), false);
});

test('clampContextMenuPosition keeps menu inside viewport bounds', () => {
  const viewport = { width: 390, height: 844 };
  const menuSize = { width: 240, height: 300 };
  const clamped = clampContextMenuPosition({ x: 350, y: 780 }, menuSize, viewport, 12);
  assert.equal(clamped.x, 390 - 240 - 12);
  assert.equal(clamped.y, 844 - 300 - 12);
  assert.ok(LONG_PRESS_DELAY_MS >= 400);
  assert.ok(TOUCH_MOVE_THRESHOLD_PX <= 12);
});
