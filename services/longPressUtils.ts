export interface TouchPoint {
  x: number;
  y: number;
}

export const LONG_PRESS_DELAY_MS = 480;
export const TOUCH_MOVE_THRESHOLD_PX = 10;
export const CLICK_SUPPRESSION_WINDOW_MS = 650;

/**
 * Determines whether finger movement between touchstart and touchmove
 * exceeds the allowed jitter threshold and should cancel a pending long-press.
 */
export function shouldCancelLongPressOnMove(
  start: TouchPoint | null,
  current: TouchPoint,
  thresholdPx: number = TOUCH_MOVE_THRESHOLD_PX
): boolean {
  if (!start) return true;
  const dx = Math.abs(current.x - start.x);
  const dy = Math.abs(current.y - start.y);
  if (dx > thresholdPx || dy > thresholdPx) return true;
  return Math.hypot(dx, dy) > thresholdPx;
}

/**
 * Determines whether container scroll displacement should cancel a pending long-press.
 */
export function shouldCancelLongPressOnScroll(
  initialScrollTop: number | null,
  currentScrollTop: number,
  tolerancePx: number = 2
): boolean {
  if (initialScrollTop === null) return true;
  return Math.abs(currentScrollTop - initialScrollTop) > tolerancePx;
}

/**
 * Determines whether a synthetic click event firing after touchend
 * should be suppressed because a long-press was just triggered.
 */
export function shouldSuppressClickAfterLongPress(
  isLongPressActive: boolean,
  lastLongPressTimestamp: number,
  now: number = Date.now(),
  suppressionWindowMs: number = CLICK_SUPPRESSION_WINDOW_MS
): boolean {
  if (isLongPressActive) return true;
  if (lastLongPressTimestamp > 0 && now - lastLongPressTimestamp >= 0 && now - lastLongPressTimestamp < suppressionWindowMs) {
    return true;
  }
  return false;
}

/**
 * Determines whether a contextmenu event should open the custom context menu.
 * Blocks opening if a touch gesture has already transitioned into a scroll/move,
 * or if the menu is already open for the same item.
 */
export function shouldAllowContextMenuEvent(
  isTouchActive: boolean,
  hasTouchMoved: boolean,
  isAlreadyOpenForTarget: boolean
): boolean {
  if (isTouchActive && hasTouchMoved) return false;
  if (isAlreadyOpenForTarget) return false;
  return true;
}

/**
 * Clamps context menu coordinates so the menu stays fully within the viewport.
 */
export function clampContextMenuPosition(
  point: TouchPoint,
  menuSize: { width: number; height: number },
  viewport: { width: number; height: number },
  margin: number = 12
): TouchPoint {
  const maxX = Math.max(margin, viewport.width - menuSize.width - margin);
  const maxY = Math.max(margin, viewport.height - menuSize.height - margin);
  return {
    x: Math.max(margin, Math.min(point.x, maxX)),
    y: Math.max(margin, Math.min(point.y, maxY)),
  };
}
