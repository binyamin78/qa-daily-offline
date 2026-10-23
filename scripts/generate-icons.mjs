// Generates every app icon / splash image from the clipboard logo below.
// Run: npm run icons
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const GREEN = '#16a34a';
const RES = 'android/app/src/main/res';

// The logo artwork on a 108x108 canvas (Android adaptive-icon units).
// Everything stays inside the central 66-unit safe zone so no launcher mask clips it.
const ART = `
  <rect x="35" y="32" width="38" height="48" rx="5" fill="#ffffff"/>
  <rect x="45.5" y="27.5" width="17" height="8.5" rx="2.5" fill="#facc15"/>
  <path d="M40 45 L44 49 L50.5 41.5" fill="none" stroke="${GREEN}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="54.5" y1="45.5" x2="67" y2="45.5" stroke="#86efac" stroke-width="3" stroke-linecap="round"/>
  <path d="M40 57 L44 61 L50.5 53.5" fill="none" stroke="${GREEN}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="54.5" y1="57.5" x2="67" y2="57.5" stroke="#86efac" stroke-width="3" stroke-linecap="round"/>
  <rect x="40" y="68" width="28" height="4.5" rx="2.25" fill="#dcfce7"/>
  <rect x="40" y="68" width="19" height="4.5" rx="2.25" fill="${GREEN}"/>`;

const svg = (viewBox, body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${body}</svg>`);

// Adaptive foreground: transparent, full 108 canvas
const foreground = svg('0 0 108 108', ART);
// Full-bleed square (PWA maskable icon)
const maskable = svg('0 0 108 108', `<rect width="108" height="108" fill="${GREEN}"/>${ART}`);
// Legacy launcher icons: crop to the central 72 units so the artwork reads larger
const square = svg('18 18 72 72', `<rect x="18" y="18" width="72" height="72" rx="16" fill="${GREEN}"/>${ART}`);
const round = svg('18 18 72 72', `<circle cx="54" cy="54" r="36" fill="${GREEN}"/>${ART}`);

const png = (input, size, out) => {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  return sharp(input, { density: 600 }).resize(size, size).png().toFile(out);
};

const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

const jobs = [];
for (const [name, scale] of Object.entries(DENSITIES)) {
  const dir = `${RES}/mipmap-${name}`;
  jobs.push(png(square, 48 * scale, `${dir}/ic_launcher.png`));
  jobs.push(png(round, 48 * scale, `${dir}/ic_launcher_round.png`));
  jobs.push(png(foreground, 108 * scale, `${dir}/ic_launcher_foreground.png`));
}

// Splash screens: keep each existing file's size, green background with the logo centered
const splashFiles = fs.readdirSync(RES)
  .filter(d => d.startsWith('drawable'))
  .map(d => `${RES}/${d}/splash.png`)
  .filter(f => fs.existsSync(f));

for (const file of splashFiles) {
  const { width, height } = await sharp(file).metadata();
  const logoSize = Math.round(Math.min(width, height) * 0.45);
  const logo = await sharp(foreground, { density: 600 }).resize(logoSize, logoSize).png().toBuffer();
  jobs.push(
    sharp({ create: { width, height, channels: 3, background: GREEN } })
      .composite([{ input: logo, gravity: 'center' }])
      .png()
      .toFile(file + '.tmp')
      .then(() => fs.renameSync(file + '.tmp', file))
  );
}

// PWA / browser icons
jobs.push(png(square, 192, 'public/icons/icon-192.png'));
jobs.push(png(maskable, 512, 'public/icons/icon-512.png'));

// Editable source for designers
fs.mkdirSync('assets/logo', { recursive: true });
fs.writeFileSync('assets/logo/logo.svg', square.toString());
fs.writeFileSync('assets/logo/logo-maskable.svg', maskable.toString());

await Promise.all(jobs);
console.log(`Generated ${jobs.length} images (${splashFiles.length} splash screens).`);
