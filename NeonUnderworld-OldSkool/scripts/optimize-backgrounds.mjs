import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(__dirname, '../public/images/game-backgrounds');

for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.png'))) {
  const input = path.join(dir, file);
  const output = path.join(dir, file.replace(/\.png$/, '.webp'));
  const before = fs.statSync(input).size;
  await sharp(input)
    .resize(1920, null, { withoutEnlargement: true })
    .webp({ quality: 82, effort: 4 })
    .toFile(output);
  const after = fs.statSync(output).size;
  console.log(`${file} → ${path.basename(output)} (${Math.round(before / 1024)}KB → ${Math.round(after / 1024)}KB)`);
}
