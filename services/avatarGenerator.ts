/**
 * Local offline SVG avatar generator.
 * Produces 100% self-contained data:image/svg+xml URIs.
 * Never connects to any external network or CDN.
 */

const PALETTES = [
  ['#2A75D3', '#1F5BB5'], // Classic Telegram Blue
  ['#00A884', '#008769'], // Teal
  ['#8E44AD', '#71368A'], // Purple
  ['#D35400', '#B34200'], // Coral
  ['#16A085', '#117A65'], // Emerald
  ['#2980B9', '#1C6391'], // Steel Blue
  ['#C0392B', '#992D22'], // Crimson
  ['#2C3E50', '#1A252F']  // Slate
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function generateLocalAvatarSvg(name: string, seed?: string): string {
  const safeName = (name || 'کاربر').trim();
  const safeSeed = seed || safeName;
  const index = hashString(safeSeed) % PALETTES.length;
  const [color1, color2] = PALETTES[index];

  // Extract up to 2 initials (supports Persian/Arabic and English)
  const parts = safeName.split(/\s+/).filter(Boolean);
  let initials = '';
  if (parts.length >= 2) {
    initials = (parts[0][0] + parts[1][0]).toUpperCase();
  } else if (parts.length === 1 && parts[0].length > 0) {
    initials = parts[0].slice(0, Math.min(2, parts[0].length)).toUpperCase();
  } else {
    initials = 'استارلی';
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
    <defs>
      <linearGradient id="g_${index}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${color1}" />
        <stop offset="100%" stop-color="${color2}" />
      </linearGradient>
    </defs>
    <rect width="128" height="128" rx="64" fill="url(#g_${index})" />
    <text x="64" y="72" font-family="-apple-system, BlinkMacSystemFont, 'Vazirmatn', 'Segoe UI', Roboto, sans-serif" font-size="44" font-weight="600" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${initials}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const DEFAULT_LOCAL_AVATAR = generateLocalAvatarSvg('استارلی', 'default_starly');
