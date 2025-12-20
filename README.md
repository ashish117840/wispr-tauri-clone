

# 🗣️ Wispr Clone (Tauri + React + Deepgram)

A functional desktop prototype inspired by **Wispr Flow**, providing low-latency push-to-talk voice-to-text transcription using **Deepgram streaming**.

This project demonstrates real-time audio capture, IPC between a web frontend and Rust backend, and WebSocket-based speech-to-text streaming.

---
## 🎥 Demo Video

▶️ **Watch the demo video:**  
[https://drive.google.com/file/d/XXXXXXXX/view?usp=sharing](https://drive.google.com/file/d/1ZkHmv-mVkt9D5dugH2u3T9fG64SLJgJF/view?usp=sharing)

> Note: The demo video was recorded in a single take.  
> For best clarity, please increase system volume slightly while watching.

---

## ✨ Features

* 🎙️ **Push-to-Talk**

  * Hold **Space** or click the button to record
* 🔊 **Low-latency audio capture**

  * Web Audio API + AudioWorklet
* ⚡ **Real-time transcription**

  * Streaming audio to Deepgram via WebSocket
* 📝 **Live transcript updates**

  * Partial and final results displayed instantly
* 📋 **Copy-to-clipboard workflow**

  * Paste text into any app
* 🖥️ **Cross-platform desktop app**

  * Built with Tauri (Rust backend)

---

## 🧱 Tech Stack

* **Frontend:** React, Vite
* **Desktop Framework:** Tauri (Rust)
* **Audio:** Web Audio API, AudioWorklet
* **Speech-to-Text:** Deepgram Streaming WebSocket API
* **Concurrency:** Tokio (Rust async runtime)
* **IPC:** Tauri `invoke` + event system

---

## 📁 Project Structure

```text
wispr-tauri-clone/
├─ src/
│  ├─ App.jsx                # UI, push-to-talk logic, transcript display
│  ├─ App.css
│  ├─ audio/
│  │  └─ recorder.js         # Mic capture & audio chunking
│  ├─ worklets/
│  │  └─ pcm-processor.js    # AudioWorklet → PCM16 conversion
│  └─ main.jsx
│
├─ src-tauri/
│  ├─ src/
│  │  ├─ main.rs             # Tauri entry + command registration
│  │  ├─ deepgram.rs         # WebSocket streaming client
│  │  └─ state.rs            # Shared Deepgram connection state
│  ├─ Cargo.toml
│  ├─ tauri.conf.json
│  └─ .env                   # API key (gitignored)
│
├─ public/
├─ package.json
├─ vite.config.js
└─ README.md
```

---

## ⚙️ Setup Instructions

### 1️⃣ Clone the repository

```bash
git clone https://github.com/ashish117840/wispr-tauri-clone.git
cd wispr-tauri-clone
```

---

### 2️⃣ Create environment file (IMPORTANT)

Create **`src-tauri/.env`**:

```env
DEEPGRAM_API_KEY=your_api_key_here
```

⚠️ This file is **gitignored** and must never be committed.

---

### 3️⃣ Install dependencies

```bash
npm install
```

---

### 4️⃣ Run the app (development mode)

```bash
npm run tauri dev
```

---

## 🧠 Architecture & Design Decisions

### 🎧 Audio Capture (Frontend)

* Uses **AudioWorklet** instead of `MediaRecorder` for:

  * Lower latency
  * PCM16 (`linear16`) output required by Deepgram
* Audio is chunked (~20–40ms) to balance:

  * Latency
  * Network overhead
* Audio chunks are sent to Rust via:

  ```js
  invoke("send_audio", { chunk })
  ```

---

### 🦀 Rust Backend (Tauri)

* Maintains a **single active Deepgram WebSocket connection**
* Uses:

  * `tokio-tungstenite` for WebSocket streaming
  * `tokio::sync::Mutex` for shared state
* Receives audio chunks and forwards them directly to Deepgram
* Listens for transcription messages and emits events:

```rust
app.emit_all("deepgram:transcript", payload)?;
```

---

### 🔁 Frontend ↔ Backend Communication

| Direction | Mechanism    | Purpose                           |
| --------- | ------------ | --------------------------------- |
| UI → Rust | `invoke()`   | Start/stop stream, send audio     |
| Rust → UI | `emit_all()` | Transcript updates, status events |

This separation ensures:

* API keys remain **backend-only**
* Audio streaming is isolated from UI logic

---

## ⚠️ Known Limitations

* Only **one active transcription session** at a time
* No automatic reconnect if WebSocket drops
* No background noise suppression (mic raw input)
* Clipboard-only “insert” workflow (no OS-level injection)
* Limited error recovery (prototype focus)

---

## 🔐 Security Notes

* Deepgram API key is:

  * Stored only in `src-tauri/.env`
  * Never exposed to the frontend
* `.env`, `target/`, and `node_modules/` are gitignored
* Rotate the API key if it was ever exposed accidentally

---

## 🧪 Demo Flow Checklist

* [ ] Click record or hold **Space**
* [ ] Speak into microphone
* [ ] Observe live transcript updates
* [ ] Click **Copy Text**
* [ ] Paste into any application

---

## 🛠️ Troubleshooting

### Windows file lock error

```text
failed to remove file ... tauri-app.exe (Access is denied)
```

Fix:

1. Close the app window
2. Stop `npm run tauri dev`
3. Re-run the command

---

## 📌 Status

🚧 **Functional prototype**
Designed to demonstrate:

* Real-time audio streaming
* Desktop IPC
* Speech-to-text integration

Not production-hardened by design.

---

## 👤 Author

**Ashish Kumar**
Full-Stack Developer 
GitHub: [https://github.com/ashish117840](https://github.com/ashish117840)

---


