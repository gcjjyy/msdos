# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Browser-based MS-DOS emulator using js-dos 7.xx (WebAssembly DOSBox). Built with React Router v7 Framework Mode with SSR enabled.

## Commands

```bash
npm install           # Install dependencies
npm run build:bundle  # Build bundle.jsdos from dos/ folder
npm run dev           # Start dev server (http://localhost:5173)
npm run build         # Build for production (includes bundle build)
npm run start         # Start production server
npm run typecheck     # Type check
```

## Architecture

### Frontend
- `app/routes/dosbox.tsx` - Main page with DOSBox emulator and Admin tabs
- `app/components/DosEmulator.tsx` - js-dos wrapper with boot screen animation
- `app/components/AdminPanel.tsx` - File management UI with folder upload, deletion, and emulator sync

### API Routes
- `api/folders` - Lists DOS filesystem tree
- `api/upload` - Upload files to DOS filesystem
- `api/apply` - Apply pending deletions/additions (requires password)
- `api/sync` - Sync emulator filesystem changes back to server (requires password)
- `api/bundle` - Rebuild bundle.jsdos

### Bundle System
- `dos/` - Source DOS files (8.3 filename convention enforced)
- `public/bundle.jsdos` - Packaged ZIP containing DOS files + `.jsdos/dosbox.conf`
- `build-bundle.ts` - CLI bundle builder
- `app/lib/build-bundle.server.ts` - Server-side bundle builder (used by API routes)

### Key Patterns
- `window.dosCI` - Global CommandInterface for accessing emulator from any component
- Password protection via `ADMIN_PASSWORD` env var for destructive operations
- 8.3 filename validation in `app/lib/validation.ts`

## Workflow

1. Place DOS programs in `dos/` directory (8.3 filenames required)
2. Run `npm run build:bundle` to create `public/bundle.jsdos`
3. Run `npm run dev` to start server
4. Use Admin tab to manage files at runtime (changes rebuild bundle automatically)
