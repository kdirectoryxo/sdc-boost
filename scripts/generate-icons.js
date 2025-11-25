import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Resvg } from '@resvg/resvg-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sizes = [16, 32, 48, 96, 128];
const svgPath = join(__dirname, '../assets/sdc-boost-logo.svg');
const outputDir = join(__dirname, '../public/icon');

// Read SVG file
const svgContent = readFileSync(svgPath, 'utf-8');

console.log('Generating PNG icons from SVG...');

sizes.forEach((size) => {
  try {
    // Render SVG to PNG
    const resvg = new Resvg(svgContent, {
      fitTo: {
        mode: 'width',
        value: size,
      },
    });
    
    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();
    
    const outputPath = join(outputDir, `${size}.png`);
    writeFileSync(outputPath, pngBuffer);
    console.log(`✓ Generated ${size}x${size}.png`);
  } catch (error) {
    console.error(`✗ Failed to generate ${size}x${size}.png:`, error.message);
  }
});

console.log('Icon generation complete!');

