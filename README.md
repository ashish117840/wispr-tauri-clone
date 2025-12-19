# Wisper Clone (Tauri + React + Deepgram)

Functional prototype of a Wispr Flow-style push-to-talk voice-to-text desktop app.

## Features

- Push-to-talk: hold **Space** to record (or click the button)
- Microphone capture via Web Audio + AudioWorklet
- Real-time-ish transcription streamed to Deepgram over WebSocket
- Transcript displayed live; "Copy Text" provides a simple “insert” workflow
- Status indicator: shows Connecting/Connected/Listening/Disconnected/Error

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
  - Buffers small chunks (~40ms) to keep latency low.
  - Prefers low-latency audio and attempts 16kHz to reduce bandwidth/IPC cost.
  - Sends audio chunks to Rust via `invoke("send_audio")`.

- Deepgram streaming ([src-tauri/src/deepgram.rs](src-tauri/src/deepgram.rs))
  - Connects to Deepgram WebSocket with `encoding=linear16` and the actual device sample rate.
  - Sends audio bytes and reads transcription results.
  - Emits transcript events to the frontend.
  - Emits a `deepgram:connected` event once the WebSocket upgrade succeeds.

## Known limitations / assumptions

- The “insert” workflow is implemented as copy-to-clipboard (you paste wherever needed).
- Assumes a single active Deepgram session at a time.
- Basic error handling is included; production hardening (reconnects, backpressure, etc.) is intentionally minimal.

## Submission checklist

- Confirm `src-tauri/.env` exists locally and is NOT committed.
- Rotate your Deepgram key if it was ever exposed.
- Verify the core demo flow works end-to-end:
  - Start recording (button)
  - Push-to-talk (hold Space)
  - Live text updates
  - Copy Text and paste into any app
- Record a short demo video (30–60s) showing the above.

## Troubleshooting

- Windows: `error: failed to remove file ... tauri-app.exe (Access is denied)`
  - The running app binary is locked.
  - Close the app window (or stop `npm run tauri dev`) and re-run.
  - If stuck, end `tauri-app.exe` in Task Manager.

## Recommended IDE setup

- VS Code + Tauri + rust-analyzer
