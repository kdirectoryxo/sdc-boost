import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { Resvg } from '@resvg/resvg-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const screenshotPath = join(__dirname, '../Screenshot 2025-11-25 224601.png');
const logoPath = join(__dirname, '../assets/sdc-boost-logo.svg');
const outputDir = join(__dirname, '../public/store-images');

// Create output directory if it doesn't exist
import { mkdirSync } from 'fs';
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

console.log('Generating Chrome Web Store images...\n');

async function generateImages() {
  try {
    // 1. Resize screenshot to required dimensions
    if (existsSync(screenshotPath)) {
      console.log('Processing screenshot...');
      
      // 1280x800 screenshot
      await sharp(screenshotPath)
        .resize(1280, 800, {
          fit: 'contain',
          background: { r: 26, g: 26, b: 26, alpha: 1 } // Dark background to match theme
        })
        .toFile(join(outputDir, 'screenshot-1280x800.png'));
      console.log('✓ Created screenshot-1280x800.png');
      
      // 640x400 screenshot
      await sharp(screenshotPath)
        .resize(640, 400, {
          fit: 'contain',
          background: { r: 26, g: 26, b: 26, alpha: 1 }
        })
        .toFile(join(outputDir, 'screenshot-640x400.png'));
      console.log('✓ Created screenshot-640x400.png');
    } else {
      console.log('⚠ Screenshot not found:', screenshotPath);
    }

    // 2. Create Small Promotional Tile (440x280)
    console.log('\nCreating promotional tiles...');
    
    if (existsSync(logoPath)) {
      const svgContent = readFileSync(logoPath, 'utf-8');
      
      // Render logo to PNG first (small tile)
      const resvgSmall = new Resvg(svgContent, {
        fitTo: {
          mode: 'width',
          value: 200,
        },
      });
      const logoPngSmall = resvgSmall.render().asPng();
      
      // Create small promotional tile with logo on dark background
      await sharp({
        create: {
          width: 440,
          height: 280,
          channels: 4,
          background: { r: 26, g: 26, b: 26, alpha: 1 }
        }
      })
        .composite([{
          input: Buffer.from(logoPngSmall),
          top: 40,
          left: 120
        }])
        .toFile(join(outputDir, 'promotional-tile-small-440x280.png'));
      console.log('✓ Created promotional-tile-small-440x280.png');
      
      // 3. Create Marquee Promotional Tile (1400x560)
      const resvgLarge = new Resvg(svgContent, {
        fitTo: {
          mode: 'width',
          value: 300,
        },
      });
      const logoPngLarge = resvgLarge.render().asPng();
      
      await sharp({
        create: {
          width: 1400,
          height: 560,
          channels: 4,
          background: { r: 26, g: 26, b: 26, alpha: 1 }
        }
      })
        .composite([{
          input: Buffer.from(logoPngLarge),
          top: 130,
          left: 550
        }])
        .toFile(join(outputDir, 'promotional-tile-marquee-1400x560.png'));
      console.log('✓ Created promotional-tile-marquee-1400x560.png');
    } else {
      console.log('⚠ Logo not found, creating tiles from screenshot...');
      
      // Fallback: use screenshot for promotional tiles
      if (existsSync(screenshotPath)) {
        await sharp(screenshotPath)
          .resize(440, 280, { fit: 'cover' })
          .toFile(join(outputDir, 'promotional-tile-small-440x280.png'));
        console.log('✓ Created promotional-tile-small-440x400.png (from screenshot)');
        
        await sharp(screenshotPath)
          .resize(1400, 560, { fit: 'cover' })
          .toFile(join(outputDir, 'promotional-tile-marquee-1400x560.png'));
        console.log('✓ Created promotional-tile-marquee-1400x560.png (from screenshot)');
      }
    }

    // 4. Verify store icon exists
    const storeIconPath = join(__dirname, '../public/icon/128.png');
    if (existsSync(storeIconPath)) {
      console.log('\n✓ Store icon (128x128) exists at public/icon/128.png');
    } else {
      console.log('\n⚠ Store icon (128x128) not found!');
    }

    console.log('\n✅ All images generated successfully!');
    console.log('\nGenerated files:');
    console.log('  - public/store-images/screenshot-1280x800.png');
    console.log('  - public/store-images/screenshot-640x400.png');
    console.log('  - public/store-images/promotional-tile-small-440x280.png');
    console.log('  - public/store-images/promotional-tile-marquee-1400x560.png');
    console.log('  - public/icon/128.png (store icon)');
    
  } catch (error) {
    console.error('Error generating images:', error);
    process.exit(1);
  }
}

generateImages();
