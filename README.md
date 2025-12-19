# Wisper Clone (Tauri + React + Deepgram)

Functional prototype of a Wispr Flow-style push-to-talk voice-to-text desktop app.

## Features

- Push-to-talk: hold **Space** to record (or click the button)
- Microphone capture via Web Audio + AudioWorklet
- Real-time-ish transcription streamed to Deepgram over WebSocket
- Transcript displayed live; "Copy Text" provides a simple “insert” workflow

## Setup

1. Create `src-tauri/.env`:

   - `DEEPGRAM_API_KEY=...`

2. Install deps:

   - `npm install`

3. Run:

   - `npm run tauri dev`

## Architecture

- Frontend ([src/App.jsx](src/App.jsx))

  - Owns UI state, push-to-talk hotkey, and listens for transcript events.
  - Receives transcript updates through `deepgram:transcript` events.

- Audio capture ([src/audio/recorder.js](src/audio/recorder.js) + [src/worklets/pcm-processor.js](src/worklets/pcm-processor.js))

  - Captures mic audio and converts it to PCM16 (linear16).
  - Buffers ~100ms chunks to reduce invoke overhead.
  - Sends audio chunks to Rust via `invoke("send_audio")`.

- Deepgram streaming ([src-tauri/src/deepgram.rs](src-tauri/src/deepgram.rs))
  - Connects to Deepgram WebSocket with `encoding=linear16` and the actual device sample rate.
  - Sends audio bytes and reads transcription results.
  - Emits transcript events to the frontend.

## Known limitations / assumptions

- The “insert” workflow is implemented as copy-to-clipboard (you paste wherever needed).
- Assumes a single active Deepgram session at a time.
- Basic error handling is included; production hardening (reconnects, backpressure, etc.) is intentionally minimal.

## Recommended IDE setup

- VS Code + Tauri + rust-analyzer
