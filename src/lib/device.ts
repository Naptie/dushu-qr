import { browser } from '$app/env';

type SafariNavigator = Navigator & { standalone?: boolean };

/**
 * True when the page runs as an installed web app (standalone window) —
 * manifest installs on desktop/Android report it via the `display-mode`
 * media query, iOS home-screen web apps (any browser) via WebKit's
 * `navigator.standalone`. A regular tab can never match either, so this
 * is deterministic. A tab never becomes standalone mid-session, so the
 * result only needs to be evaluated once at mount.
 */
export function isStandalone(): boolean {
  if (!browser) return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as SafariNavigator).standalone === true
  );
}

/**
 * Best-effort "touch-first device" (phone/tablet) detection: the primary
 * pointer is a touchscreen AND real touch hardware is present. Requiring
 * both keeps touch-screen laptops (primary pointer: trackpad/`fine`) on the
 * desktop side. No OS-level flag exists, so this is a heuristic — but a
 * phone always matches and a desktop never does. Tablets also match, which
 * is the wanted side for guide/scan flows. Note the media query reflects
 * hardware, not the UA: "desktop site" mode on a phone still classifies as
 * a phone, which is correct here.
 */
export function isPhone(): boolean {
  if (!browser) return false;
  return window.matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0;
}
