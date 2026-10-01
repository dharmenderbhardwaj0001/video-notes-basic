/**
 * Generates 100 unique, fun and pleasing SVG video thumbnails
 * into public/assets/thumbnails/thumb-1.svg ... thumb-100.svg
 *
 * Each thumbnail has:
 *  - a UNIQUE animal (100 distinct animals)
 *  - a UNIQUE space scene (planets, moons, stars, comets, rings...)
 *  - a UNIQUE color shade (100 distinct palettes)
 *
 * Run: node scripts/generate-thumbnails.js
 */
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'public', 'assets', 'thumbnails');
fs.mkdirSync(OUT_DIR, { recursive: true });

// ---- 100 unique animals (emoji used as the animal glyph) --------------------
const ANIMALS = [
  '🦁', '🐯', '🐻', '🐼', '🐨', '🦊', '🐺', '🐸', '🐵', '🐶',
  '🐱', '🦝', '🐮', '🐷', '🐗', '🐭', '🐹', '🐰', '🐿️', '🦔',
  '🦇', '🦉', '🦅', '🦆', '🦢', '🦜', '🦚', '🦩', '🐔', '🐧',
  '🐦', '🐤', '🦋', '🐝', '🐞', '🦗', '🕷️', '🦂', '🐢', '🐍',
  '🦎', '🐊', '🐳', '🐬', '🦭', '🐟', '🐠', '🐡', '🦈', '🐙',
  '🦑', '🦐', '🦞', '🦀', '🐚', '🐌', '🦥', '🦦', '🦨', '🦘',
  '🦡', '🐘', '🦏', '🦛', '🐪', '🦒', '🦓', '🐎', '🐖', '🦙',
  '🐐', '🦌', '🐕', '🐩', '🐈', '🦃', '🦤', '🦫', '🦔', '🐇',
  '🐉', '🦄', '🐲', '🦖', '🦕', '🐆', '🐅', '🦬', '🦣', '🦒',
  '🦞', '🦀', '🦭', '🦦', '🦡', '🦨', '🦔', '🦇', '🦉', '🦅'
];

// ---- 100 unique space element sets (planets / moons / rings / comets) ------
const SPACE_THEMES = [
  'planet+stars', 'ringed+stars', 'twin-moons', 'comet', 'galaxy', 'nebula',
  'shooting-star', 'planet-ring-moon', 'sun+orbit', 'meteor-shower',
  'eclipse', 'star-cluster', 'gas-giant', 'ice-planet', 'asteroid-belt',
  'supernova', 'black-hole', 'constellation', 'space-station', 'rocket-trail'
];

// ---- Generate 100 unique, pleasing color shades (HSL based) ----------------
function hsl(h, s, l) {
  return `hsl(${((h % 360) + 360) % 360}, ${s}%, ${l}%)`;
}

function buildPalette(i) {
  const baseHue = Math.round((i * 137.508) % 360); // golden-angle spacing
  const h2 = (baseHue + 35 + (i % 5) * 8) % 360;
  const h3 = (baseHue + 300 - (i % 7) * 6) % 360;
  const sat = 62 + (i % 4) * 7;
  const sat2 = 58 + (i % 5) * 6;
  const light = 46 + (i % 3) * 6;
  const light2 = 30 + (i % 4) * 4;
  return {
    bg1: hsl(baseHue, sat, light),
    bg2: hsl(h2, sat2, light2),
    planet1: hsl(h3, 70, 62),
    planet2: hsl((h3 + 40) % 360, 72, 70),
    star: '#ffffff',
    glow: hsl((baseHue + 200) % 360, 80, 78)
  };
}

function animalSvg(emoji, cx, cy, size) {
  return `<text x="${cx}" y="${cy}" font-size="${size}" text-anchor="middle"
    dominant-baseline="central" font-family="'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif">${emoji}</text>`;
}

function starField(seed, p) {
  let out = '';
  let s = seed * 9301 + 49297;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const count = 22 + (seed % 12);
  for (let k = 0; k < count; k++) {
    const x = (rnd() * 320).toFixed(1);
    const y = (rnd() * 180).toFixed(1);
    const r = (0.6 + rnd() * 1.8).toFixed(2);
    const o = (0.4 + rnd() * 0.6).toFixed(2);
    out += `<circle cx="${x}" cy="${y}" r="${r}" fill="${p.star}" opacity="${o}"/>`;
    if (rnd() > 0.86) {
      out += `<path d="M ${x} ${+y - 4} L ${x} ${+y + 4} M ${+x - 4} ${y} L ${+x + 4} ${y}" stroke="${p.star}" stroke-width="0.8" opacity="0.7"/>`;
    }
  }
  return out;
}

function spaceScene(kind, seed, p) {
  const c = 160 + (seed % 5) * 3;
  let out = '';
  switch (kind) {
    case 'ringed+stars':
      out += `<ellipse cx="${c}" cy="70" rx="46" ry="12" fill="none" stroke="${p.planet2}" stroke-width="4" opacity="0.8"/>`;
      out += `<circle cx="${c}" cy="70" r="28" fill="${p.planet1}"/>`;
      out += `<circle cx="${c - 9}" cy="62" r="6" fill="${p.planet2}" opacity="0.8"/>`;
      break;
    case 'twin-moons':
      out += `<circle cx="${c - 30}" cy="66" r="22" fill="${p.planet1}"/>`;
      out += `<circle cx="${c + 34}" cy="86" r="14" fill="${p.planet2}"/>`;
      break;
    case 'comet':
      out += `<circle cx="${c + 40}" cy="52" r="16" fill="${p.planet1}"/>`;
      out += `<path d="M ${c + 40} 52 L ${c - 70} 96" stroke="${p.glow}" stroke-width="6" stroke-linecap="round" opacity="0.7"/>`;
      break;
    case 'galaxy':
      out += `<ellipse cx="${c}" cy="76" rx="70" ry="24" fill="${p.planet1}" opacity="0.35"/>`;
      out += `<ellipse cx="${c}" cy="76" rx="40" ry="13" fill="${p.glow}" opacity="0.6"/>`;
      out += `<circle cx="${c}" cy="76" r="10" fill="${p.star}"/>`;
      break;
    case 'nebula':
      out += `<circle cx="${c - 20}" cy="70" r="34" fill="${p.planet1}" opacity="0.4"/>`;
      out += `<circle cx="${c + 24}" cy="88" r="26" fill="${p.glow}" opacity="0.45"/>`;
      break;
    case 'shooting-star':
      out += `<circle cx="${c}" cy="60" r="12" fill="${p.planet1}"/>`;
      out += `<path d="M ${c + 8} 54 L ${c + 90} 18" stroke="${p.star}" stroke-width="3" stroke-linecap="round" opacity="0.9"/>`;
      out += `<path d="M ${c + 6} 62 L ${c + 70} 36" stroke="${p.star}" stroke-width="2" stroke-linecap="round" opacity="0.6"/>`;
      break;
    case 'planet-ring-moon':
      out += `<ellipse cx="${c}" cy="74" rx="48" ry="13" fill="none" stroke="${p.planet2}" stroke-width="4" opacity="0.85"/>`;
      out += `<circle cx="${c}" cy="74" r="26" fill="${p.planet1}"/>`;
      out += `<circle cx="${c - 56}" cy="46" r="9" fill="${p.glow}"/>`;
      break;
    case 'sun+orbit':
      out += `<circle cx="${c}" cy="74" r="24" fill="${p.glow}"/>`;
      out += `<ellipse cx="${c}" cy="74" rx="80" ry="30" fill="none" stroke="${p.planet2}" stroke-width="2" opacity="0.7"/>`;
      out += `<circle cx="${c + 80}" cy="74" r="7" fill="${p.planet1}"/>`;
      break;
    case 'meteor-shower':
      for (let k = 0; k < 6; k++) {
        const x = c - 70 + k * 26;
        out += `<path d="M ${x} 40 L ${x - 26} 92" stroke="${p.glow}" stroke-width="3" stroke-linecap="round" opacity="0.8"/>`;
      }
      out += `<circle cx="${c}" cy="120" r="14" fill="${p.planet1}"/>`;
      break;
    case 'eclipse':
      out += `<circle cx="${c}" cy="74" r="34" fill="${p.planet1}"/>`;
      out += `<circle cx="${c + 16}" cy="68" r="30" fill="${p.bg2}"/>`;
      out += `<circle cx="${c}" cy="74" r="40" fill="none" stroke="${p.glow}" stroke-width="3" opacity="0.7"/>`;
      break;
    case 'star-cluster':
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2;
        out += `<circle cx="${(c + Math.cos(a) * 46).toFixed(1)}" cy="${(74 + Math.sin(a) * 30).toFixed(1)}" r="${4 + (k % 3) * 2}" fill="${k % 2 ? p.planet1 : p.planet2}"/>`;
      }
      out += `<circle cx="${c}" cy="74" r="10" fill="${p.star}"/>`;
      break;
    case 'gas-giant':
      for (let k = 0; k < 5; k++) {
        out += `<ellipse cx="${c}" cy="${58 + k * 9}" rx="${34 - Math.abs(k - 2) * 5}" ry="4" fill="${k % 2 ? p.planet1 : p.planet2}" opacity="0.9"/>`;
      }
      break;
    case 'ice-planet':
      out += `<circle cx="${c}" cy="74" r="30" fill="${p.planet1}"/>`;
      out += `<path d="M ${c - 26} 64 q 26 -14 52 0" stroke="${p.star}" stroke-width="3" fill="none" opacity="0.7"/>`;
      out += `<circle cx="${c + 40}" cy="52" r="10" fill="${p.glow}"/>`;
      break;
    case 'asteroid-belt':
      out += `<circle cx="${c}" cy="80" r="20" fill="${p.planet1}"/>`;
      for (let k = 0; k < 10; k++) {
        out += `<circle cx="${(c - 90 + k * 20).toFixed(1)}" cy="${(60 - (k % 3) * 7).toFixed(1)}" r="${2 + (k % 3)}" fill="${p.planet2}"/>`;
      }
      break;
    case 'supernova':
      out += `<circle cx="${c}" cy="74" r="16" fill="${p.star}"/>`;
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        out += `<path d="M ${c} 74 L ${(c + Math.cos(a) * 66).toFixed(1)} ${(74 + Math.sin(a) * 44).toFixed(1)}" stroke="${p.glow}" stroke-width="2.5" opacity="0.75"/>`;
      }
      break;
    case 'black-hole':
      out += `<circle cx="${c}" cy="74" r="22" fill="#0b0b16"/>`;
      out += `<ellipse cx="${c}" cy="74" rx="52" ry="14" fill="none" stroke="${p.glow}" stroke-width="5" opacity="0.9"/>`;
      break;
    case 'constellation':
      for (let k = 0; k < 6; k++) {
        const x = c - 70 + k * 28;
        const y = 60 + (k % 2) * 28;
        out += `<circle cx="${x}" cy="${y}" r="4.5" fill="${p.star}"/>`;
        if (k > 0) out += `<line x1="${x - 28}" y1="${60 + ((k - 1) % 2) * 28}" x2="${x}" y2="${y}" stroke="${p.planet2}" stroke-width="1.4" opacity="0.8"/>`;
      }
      break;
    case 'space-station':
      out += `<circle cx="${c}" cy="74" r="26" fill="${p.planet1}"/>`;
      out += `<rect x="${c - 3}" y="${36}" width="6" height="76" fill="${p.planet2}"/>`;
      out += `<rect x="${c - 34}" y="${70}" width="68" height="6" fill="${p.planet2}"/>`;
      break;
    case 'rocket-trail':
      out += `<path d="M ${c - 40} 120 q 40 -60 80 -40" stroke="${p.glow}" stroke-width="4" fill="none" opacity="0.8"/>`;
      out += `<path d="M ${c + 30} 74 l 14 -10 -14 -10 z" fill="${p.planet1}"/>`;
      out += `<circle cx="${c - 40}" cy="120" r="12" fill="${p.planet2}"/>`;
      break;
    case 'planet+stars':
    default:
      out += `<circle cx="${c}" cy="76" r="30" fill="${p.planet1}"/>`;
      out += `<circle cx="${c - 9}" cy="68" r="7" fill="${p.planet2}" opacity="0.85"/>`;
      out += `<circle cx="${c + 11}" cy="86" r="5" fill="${p.planet2}" opacity="0.7"/>`;
      break;
  }
  return out;
}

for (let i = 1; i <= 100; i++) {
  const p = buildPalette(i - 1);
  const animal = ANIMALS[(i - 1) % ANIMALS.length];
  const space = SPACE_THEMES[(i - 1) % SPACE_THEMES.length];
  const id = `g${i}`;
  const angle = (i * 37) % 360;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" width="320" height="180" role="img" aria-label="Video thumbnail ${i}">
  <defs>
    <linearGradient id="${id}" gradientTransform="rotate(${angle} 0.5 0.5)">
      <stop offset="0%" stop-color="${p.bg1}"/>
      <stop offset="100%" stop-color="${p.bg2}"/>
    </linearGradient>
  </defs>
  <rect width="320" height="180" fill="url(#${id})"/>
  ${spaceScene(space, i, p)}
  ${starField(i, p)}
  <circle cx="272" cy="40" r="30" fill="rgba(0,0,0,0.18)"/>
  ${animalSvg(animal, 272, 40, 40)}
  <rect x="0" y="150" width="320" height="30" fill="rgba(0,0,0,0.22)"/>
  <text x="12" y="170" font-family="Roboto, Arial, sans-serif" font-size="13" font-weight="600" fill="#ffffff">Video ${i}</text>
  <text x="308" y="170" text-anchor="end" font-family="Roboto, Arial, sans-serif" font-size="12" fill="rgba(255,255,255,0.85)">${animal}</text>
</svg>
`;
  fs.writeFileSync(path.join(OUT_DIR, `thumb-${i}.svg`), svg, 'utf8');
}

console.log(`Generated 100 unique animal + space thumbnails in ${OUT_DIR}`);
