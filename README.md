## Blip RSVP Reader

Read a book in 2 hours.

Blip is a desktop RSVP (Rapid Serial Visual Presentation) reader built for personal use to dramatically speed up reading while keeping focus high. It streams one word at a time with tuned timing, trail words, and ORP highlighting so you can skim less and comprehend more.

![Blip RSVP Reader Screenshot](./Screenshot%202025-08-08%20at%2023.26.10.png)

### Install

- **Download**: Get the latest installers from the Tagged builds page: [blip tags](https://github.com/simonorzel26/blip/tags).
- **macOS (DMG)**:
  - Download the `.dmg` from the latest tag and drag `Blip RSVP Reader.app` to Applications.
  - If Gatekeeper says the app is damaged, remove quarantine and open:
    ```bash
    xattr -dr com.apple.quarantine "/Applications/Blip RSVP Reader.app"
    open "/Applications/Blip RSVP Reader.app"
    ```
- **Windows (EXE)**:
  - Download the `.exe` from the latest tag and run the installer.
  - If SmartScreen warns, choose More info → Run anyway.

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

### Install on macOS

Unsigned builds are quarantined by Gatekeeper. After moving the app to Applications, remove quarantine once:

```bash
xattr -dr com.apple.quarantine "/Applications/Blip RSVP Reader.app"
```

Then open it normally from Applications. Signed/notarized builds from Releases won’t require this step.

#### Prerequisites

- Rust (via `rustup`)
- Node.js 18+
- macOS: Xcode Command Line Tools (`xcode-select --install`)
- Windows: Visual Studio Build Tools (Desktop C++ + Windows SDK) and either WiX v3 (for `.msi`) or NSIS (for `.exe`)

### What This App Is (and is not)

This is a personal tool to help me read books faster using RSVP. It favors simplicity and local-first files. There’s no cloud sync or login.

### License

Personal use. Ask before redistribution.
