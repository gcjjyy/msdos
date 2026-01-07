# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a js-dos 7.xx template project that runs MS-DOS applications in a web browser using WebAssembly-based DOSBox emulation. Built with React Router v7 Framework Mode.

## Architecture

- `app/` - React Router application
  - `root.tsx` - Root layout with js-dos script loading
  - `routes.ts` - Route definitions
  - `app.css` - Global styles
  - `routes/` - Route modules
    - `home.tsx` - Home page
    - `emulator.tsx` - DOS emulator page
  - `components/` - React components
    - `DosEmulator.tsx` - js-dos wrapper component
- `public/` - Static assets served by Vite
  - `js-dos/` - js-dos library files (JS, CSS, WASM)
  - `bundle.jsdos` - Packaged DOS filesystem bundle
- `dos/` - DOS filesystem contents that get packaged into bundle.jsdos
  - `AUTOEXEC.BAT` - DOS startup script
  - DOS applications and files go here

## Commands

```bash
# Install dependencies
npm install

# Build bundle.jsdos from dos/ folder
npm run build:bundle

# Start development server (http://localhost:5173)
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Type check
npm run typecheck
```

## Workflow

1. Place DOS programs/files in `dos/` directory
2. Run `npm run build:bundle` to package into `public/bundle.jsdos`
3. Run `npm run dev` to start development server
4. Open http://localhost:5173 for home page
5. Navigate to /emulator for DOS emulator

## Routes

- `/` - Home page with introduction and launch button
- `/emulator` - DOS emulator page (full screen)

## js-dos Integration

The emulator is initialized via the `DosEmulator` React component:
```tsx
<DosEmulator bundleUrl="/bundle.jsdos" />
```

The component:
- Sets `window.emulators.pathPrefix = "/js-dos/"` for WASM file resolution
- Uses `window.Dos()` to initialize the emulator
- Handles loading and error states

## Tech Stack

- React 19 + React Router 7.10.1
- Vite 7.1.7
- TypeScript 5.9.2
- SPA mode (SSR disabled for js-dos compatibility)
