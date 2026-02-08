# Restorative Pathways (PWA)

Mobile-friendly, offline-first Restorative Pathways app (people → sessions → pathways → restoration runner), with an optional in-app AI assistant.

## Run locally

```bash
cd restorative-pathways
npm install
npm run dev
```

Then open the printed URL:
- On your laptop: `http://localhost:5173`
- On your iPhone (same Wi‑Fi): use your laptop’s LAN IP, e.g. `http://192.168.1.50:5173`

## “Install” on iPhone (Add to Home Screen)

1. Open the app in Safari on your iPhone.
2. Tap Share → **Add to Home Screen**.

Tip: for the most “app-like” install/offline behavior, run a production build:

```bash
npm run build
npm run preview -- --host
```

## Optional: Local AI proxy (recommended for multi-device use)

Instead of storing an API key on each device, you can run a tiny local proxy on your computer.
Your phone uses AI through your computer over Wi‑Fi; the API key stays only on your computer.

Run this in one terminal:

```bash
cd restorative-pathways
export OPENAI_API_KEY="YOUR_KEY_HERE"
npm run ai-proxy
```

Run the app in a second terminal:

```bash
npm run dev
```

Then open the app on your phone via your LAN IP (same Wi‑Fi), e.g. `http://192.168.68.116:5173/`.

### Optional: Framework guide file (improves AI alignment + in-app Guide)

If you copy your canonical framework guide into:

`public/rp/framework_guide.txt`

Then the app will show it under the **Guide** tab, and the local AI proxy will automatically pull relevant excerpts
from it to keep AI answers aligned with your framework posture.

## Where your data is stored

Data is stored **locally in the browser on the device you’re using** (IndexedDB).
- Using it on your iPhone stores data on your iPhone.
- Using it on your laptop stores data on your laptop.

Use **Settings → Export JSON** and **Import JSON** to back up or move data between devices.

## Notes

This project intentionally ships with only a small starter chart. Add your own categories/items as needed (chart editing UI can be added next).

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
