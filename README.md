# 🚀 SDC Boost

<div align="center">

**A powerful browser extension to enhance your SDC.com experience with customizable modules and features**

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/kdirectoryxo/sdc-boost)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Chrome Web Store](https://img.shields.io/badge/Chrome-Web%20Store-4285F4?logo=google-chrome&logoColor=white)](https://chrome.google.com/webstore)

[Features](#-features) • [Installation](#-installation) • [Development](#-development) • [Modules](#-modules) • [Privacy](#-privacy)

</div>

---

## 📖 About

SDC Boost is a modular browser extension designed to enhance your browsing experience on SDC.com. Built with privacy in mind, all data is stored locally on your device. The extension provides a comprehensive suite of customizable modules that you can enable, disable, and configure to match your preferences.

### ✨ Key Highlights

- 🔒 **Privacy-First**: All data stored locally, no external servers
- 🧩 **Modular Architecture**: Enable/disable features as needed
- 🎨 **Modern UI**: Sleek dark-themed interface with smooth animations
- ⚙️ **Highly Configurable**: Customize each module to your preferences
- 🚀 **Lightweight**: Minimal performance impact
- 🔄 **Real-time Updates**: Changes apply instantly

---

## 🎯 Features

### 🔍 Filtering Modules
- **Age Filter**: Hide member cards based on customizable age ranges
- **Age Highlighter**: Highlight member cards that match your preferred age criteria

### 📱 Content Modules
- **Ad Blocker**: Block and hide advertisements on SDC.com for a cleaner browsing experience

### 💬 Chat Modules
- **Chat Scroll Fix**: Prevents auto-scroll to bottom when loading older messages, giving you better control over your chat experience
- **Chat Export**: Export your chat conversations to markdown format for backup or analysis

### 🎨 UI Modules
- **Navbar Boost Button**: Quick access to SDC Boost settings directly from the navigation bar

### ⚙️ Configuration
- **Module Control Panel**: Intuitive interface to manage all modules
- **Category Organization**: Modules organized by type (Filtering, Content, Chat, UI)
- **Real-time Toggle**: Enable/disable modules instantly
- **Settings Panel**: Detailed configuration options for each module

---

## 📦 Installation

### From Chrome Web Store (Coming Soon)
1. Visit the [Chrome Web Store](https://chrome.google.com/webstore) (link will be available after publication)
2. Click "Add to Chrome"
3. Confirm the installation

### Manual Installation (Development)
1. Clone this repository:
   ```bash
   git clone https://github.com/kdirectoryxo/sdc-boost.git
   cd sdc-boost
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Build the extension:
   ```bash
   bun run build
   ```

4. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `.output/chrome-mv3` directory

---

## 🛠️ Development

### Prerequisites
- [Bun](https://bun.sh/) (JavaScript runtime and package manager)
- Chrome browser (for testing)

### Setup

1. **Install dependencies:**
   ```bash
   bun install
   ```

2. **Generate icons** (if you modify the SVG logo):
   ```bash
   bun run generate-icons
   ```

3. **Start development server:**
   ```bash
   bun run dev
   ```
   This will watch for changes and automatically reload the extension.

### Available Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start development server (Chrome) |
| `bun run dev:firefox` | Start development server (Firefox) |
| `bun run build` | Build for production (Chrome) |
| `bun run build:firefox` | Build for production (Firefox) |
| `bun run zip` | Create ZIP file for Chrome Web Store |
| `bun run zip:firefox` | Create ZIP file for Firefox Add-ons |
| `bun run generate-icons` | Generate PNG icons from SVG |
| `bun run generate-store-images` | Generate store listing images |
| `bun run compile` | Type-check TypeScript files |

### Project Structure

```
sdc-boost/
├── assets/                 # Static assets (SVG, CSS)
├── components/             # Vue components
│   ├── ui/                # Reusable UI components
│   └── ...
├── entrypoints/            # Extension entry points
│   ├── background.ts      # Background script
│   ├── content.ts         # Content script
│   ├── popup/             # Popup UI
│   └── options/            # Options page
├── lib/                    # Core library code
│   ├── modules/           # Module implementations
│   ├── sdc-api/           # SDC API utilities
│   └── ...
├── public/                 # Public assets
│   ├── icon/              # Extension icons
│   └── store-images/      # Store listing images
├── scripts/               # Build scripts
├── docs/                  # Documentation
│   └── privacy-policy.html
└── wxt.config.ts          # WXT configuration
```

### IDE Setup

**Recommended:** [Cursor](https://cursor.sh/) (AI-powered code editor) with:
- [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) - Vue 3 support with template type checking
- [TypeScript Vue Plugin](https://marketplace.visualstudio.com/items?itemName=Vue.vscode-typescript-vue-plugin) - Enhanced TypeScript support for Vue
- [Tailwind CSS IntelliSense](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss) - Tailwind CSS autocomplete and syntax highlighting
- [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) - JavaScript/TypeScript linting
- [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) - Code formatter (optional but recommended)

---

## 🧩 Modules

### Creating a New Module

1. Create a new file in `lib/modules/` extending `BaseModule`:
   ```typescript
   import { BaseModule } from './BaseModule';
   
   export class MyModule extends BaseModule {
     id = 'my-module';
     name = 'My Module';
     description = 'Description of what this module does';
     
     async enable() {
       // Module enable logic
     }
     
     async disable() {
       // Module disable logic
     }
   }
   ```

2. Register it in `entrypoints/content.ts`:
   ```typescript
   const myModule = new MyModule();
   moduleManager.register(myModule);
   ```

3. Add it to `lib/modules/moduleDefinitions.ts` for the UI.

### Module Architecture

All modules extend `BaseModule` which provides:
- Lifecycle management (enable/disable)
- Configuration options
- State persistence
- Event handling

---

## 📦 Building & Publishing

### Build for Production

```bash
# Chrome
bun run build
bun run zip

# Firefox
bun run build:firefox
bun run zip:firefox
```

ZIP files will be created in `.output/` directory.

### Publishing to Chrome Web Store

#### Automated Publishing (Recommended)

This project uses an automated release workflow that handles versioning, changelog generation, and publishing.

**Prerequisites:**
- GitHub Actions secrets configured (see `.github/workflows/release.yml`)
- Chrome Web Store API credentials set up

**Release Process:**

1. **Make changes and commit using conventional commits:**
   ```bash
   git commit -m "feat: add new feature"
   git commit -m "fix: resolve bug"
   git commit -m "chore: update dependencies"
   ```

2. **When ready to release, run:**
   ```bash
   bun run release:patch   # For bug fixes (1.0.0 → 1.0.1)
   bun run release:minor   # For new features (1.0.0 → 1.1.0)
   bun run release:major   # For breaking changes (1.0.0 → 2.0.0)
   ```
   
   Or use the interactive version:
   ```bash
   bun run release
   ```

3. **What happens automatically:**
   - Version is bumped in `package.json`
   - Changelog is generated from your commits
   - Git tag is created (e.g., `v1.0.1`)
   - Changes are committed and pushed
   - GitHub Actions workflow triggers:
     - Builds the extension
     - Creates a GitHub release with the ZIP file
     - Submits to Chrome Web Store

**Conventional Commit Format:**
- `feat:` - New features (minor version bump)
- `fix:` - Bug fixes (patch version bump)
- `chore:` - Maintenance tasks (no version bump)
- `docs:` - Documentation changes
- `refactor:` - Code refactoring
- `perf:` - Performance improvements

**Example:**
```bash
git commit -m "feat: add dark mode toggle"
git push
# Later, when ready to release:
bun run release:minor  # Creates v1.1.0 with the new feature in changelog
```

#### Manual Publishing

1. Build and create ZIP:
   ```bash
   bun run build
   bun run zip
   ```

2. Upload `.output/sdc-boost-{version}-chrome.zip` to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)

3. Fill in store listing details (see `store-description.md`)

4. Submit for review

---

## 🔒 Privacy

SDC Boost is designed with privacy as a core principle:

- ✅ All data stored locally on your device
- ✅ No external servers or tracking
- ✅ No data collection or analytics
- ✅ Open and transparent about permissions

**Privacy Policy:** [View Privacy Policy](https://kdirectoryxo.github.io/sdc-boost/privacy-policy.html)

### Permissions

- **Storage**: Required to save your module preferences locally
- **Content Scripts**: Only runs on SDC.com domains to provide functionality

---

## 🛣️ Roadmap

- [ ] Additional filtering options
- [ ] More UI customization features
- [ ] Enhanced chat features
- [ ] Performance optimizations
- [ ] User feedback system

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Built with [WXT](https://wxt.dev/) - The Web Extension Framework
- UI components with [Vue 3](https://vuejs.org/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/kdirectoryxo/sdc-boost/issues)
- **Chrome Web Store**: [Extension Listing](https://chrome.google.com/webstore) (coming soon)

---

<div align="center">

**Made with ❤️ for the SDC.com community**

[⭐ Star this repo](https://github.com/kdirectoryxo/sdc-boost) if you find it helpful!

</div>
