import { defineWebExtConfig } from 'wxt';
import { resolve } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';

// Ensure the chrome-data directory exists before Chrome launches
const chromeDataDir = resolve('.wxt/chrome-data');
if (!existsSync(chromeDataDir)) {
    mkdirSync(chromeDataDir, { recursive: true });
}

export default defineWebExtConfig({
    // Persist browser profile data between dev sessions
    // On Windows, the path must be absolute
    chromiumProfile: chromeDataDir,
    keepProfileChanges: true,
    // Open videowall page when browser starts during development
    startUrls: ['https://www.sdc.com/react/#/search-options'],
});

