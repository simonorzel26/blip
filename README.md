## Blip RSVP Reader

Read a book in 2 hours.

Blip is a desktop RSVP (Rapid Serial Visual Presentation) reader built for personal use to dramatically speed up reading while keeping focus high. It streams one word at a time with tuned timing, trail words, and ORP highlighting so you can skim less and comprehend more.

![Blip RSVP Reader Screenshot](./Screenshot%202025-08-08%20at%2023.26.10.png)

### Features

- Emphasized Optimal Recognition Point (ORP) highlighting
- Adjustable delays: word, character, and punctuation
- Trail words and letter spacing controls
- Local file library with large-file streaming
- Global shortcuts for hands-off reading

### Local Development

```bash
npm install
npm run dev
```

App runs at `http://localhost:3000` in the browser. For the desktop app shell, use Tauri dev:

```bash
npm run tauri:dev
```

### Build Desktop Bundles

This repo uses Tauri v2. Building will first produce the static Next.js output into `out/`, then Tauri bundles per platform into `src-tauri/target/release/bundle`.

Common command on any platform:

```bash
npm run tauri:build
```

Outputs by platform:

- macOS: `.app` and `.dmg` under `src-tauri/target/release/bundle/macos` and `bundle/dmg`
- Windows: `.msi` by default (WiX). Optional `.exe` installer via NSIS if NSIS is installed

#### Prerequisites

- Rust (via `rustup`)
- Node.js 18+
- macOS: Xcode Command Line Tools (`xcode-select --install`)
- Windows: Visual Studio Build Tools (Desktop C++ + Windows SDK) and either WiX v3 (for `.msi`) or NSIS (for `.exe`)

### What This App Is (and is not)

This is a personal tool to help me read books faster using RSVP. It favors simplicity and local-first files. There’s no cloud sync or login.

### License

Personal use. Ask before redistribution.
