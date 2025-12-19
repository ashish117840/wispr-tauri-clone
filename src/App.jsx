import { useEffect, useRef, useState } from "react";
import { startRecording, stopRecording } from "./audio/recorder";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "./App.css";

function normalizeToken(token) {
  return token.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

function smoothTranscript(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return "";

  const tokens = trimmed.split(/\s+/g);
  const out = [];

  let prevNorm = "";
  for (const token of tokens) {
    const norm = normalizeToken(token);
    if (norm && norm === prevNorm) continue;
    out.push(token);
    prevNorm = norm;
  }

  return out.join(" ");
}

function formatUserError(err) {
  const message =
    typeof err === "string"
      ? err
      : err && typeof err.message === "string"
      ? err.message
      : String(err);

  // Browser mic errors.
  const name = err && typeof err.name === "string" ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Microphone permission denied. Please allow mic access and try again.";
  }
  if (name === "NotFoundError") {
    return "No microphone device found. Please connect a mic and try again.";
  }
  if (name === "NotReadableError") {
    return "Microphone is in use by another app. Close other apps using the mic and try again.";
  }
  if (name === "OverconstrainedError") {
    return "Your microphone settings are not supported on this device.";
  }

  // Deepgram / backend errors.
  if (/DEEPGRAM_API_KEY/i.test(message)) {
    return "Deepgram API key not found. Set DEEPGRAM_API_KEY in src-tauri/.env and restart the app.";
  }
  if (/handshake failed/i.test(message) || /HTTP\s+\d{3}/i.test(message)) {
    return `Deepgram connection failed. ${message}`;
  }
  if (/socket closed/i.test(message)) {
    return "Connection closed unexpectedly. Please try again.";
  }

  // Network hints.
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "You appear to be offline. Check your internet connection and try again.";
  }

  return message;
}

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [status, setStatus] = useState("Idle");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState("");
  const isRecordingRef = useRef(false);
  const busyRef = useRef(false);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    let disposed = false;
    let unlistenTranscript = null;
    let unlistenClosed = null;
    let unlistenConnected = null;

    const unlistenTranscriptPromise = listen("deepgram:transcript", (event) => {
      const payload = event.payload;
      if (!payload || typeof payload.transcript !== "string") return;

      // Deepgram interim/final messages commonly contain the full utterance-so-far.
      // We only "commit" to the final transcript when Deepgram marks the utterance as speech_final.
      const nextUtterance = smoothTranscript(payload.transcript);
      const speechFinal = Boolean(payload.speech_final);

      if (speechFinal) {
        setFinalTranscript(
          (prev) => `${prev}${prev.trim() ? " " : ""}${nextUtterance}`
        );
        setInterimTranscript("");
      } else {
        setInterimTranscript(nextUtterance);
      }
    });

    const unlistenClosedPromise = listen("deepgram:closed", () => {
      // If Deepgram disconnects mid-session, surface it as a status change.
      setStatus((prev) =>
        prev === "Listening" || prev === "Connected" ? "Disconnected" : prev
      );
    });

    const unlistenConnectedPromise = listen("deepgram:connected", () => {
      setStatus("Connected");
    });

    unlistenTranscriptPromise
      .then((fn) => {
        if (disposed) {
          fn();
          return;
        }
        unlistenTranscript = fn;
      })
      .catch(() => {
        // ignore
      });

    unlistenClosedPromise
      .then((fn) => {
        if (disposed) {
          fn();
          return;
        }
        unlistenClosed = fn;
      })
      .catch(() => {
        // ignore
      });

    unlistenConnectedPromise
      .then((fn) => {
        if (disposed) {
          fn();
          return;
        }
        unlistenConnected = fn;
      })
      .catch(() => {
        // ignore
      });

    return () => {
      disposed = true;
      if (unlistenTranscript) unlistenTranscript();
      if (unlistenClosed) unlistenClosed();
      if (unlistenConnected) unlistenConnected();
    };
  }, []);

  async function start() {
    if (busyRef.current) return;
    busyRef.current = true;
    setIsBusy(true);

    setStatus("Starting...");

    setError("");
    setFinalTranscript("");
    setInterimTranscript("");

    try {
      await startRecording({
        onSampleRate: async (sampleRate) => {
          await invoke("start_deepgram", { sampleRate });
        },
      });
      setIsRecording(true);
      // Prefer "Connected" once Deepgram confirms; fall back to "Listening".
      setStatus((prev) => (prev === "Connected" ? "Connected" : "Listening"));
    } catch (e) {
      setError(formatUserError(e));
      setStatus("Error");
      setIsRecording(false);
      try {
        await stopRecording();
      } catch {
        // ignore
      }
      try {
        await invoke("stop_deepgram");
      } catch {
        // ignore
      }
    } finally {
      busyRef.current = false;
      setIsBusy(false);
    }
  }

  async function stop() {
    if (busyRef.current) return;
    busyRef.current = true;
    setIsBusy(true);

    setStatus("Stopping...");

    setError("");
    try {
      await stopRecording();
    } finally {
      try {
        await invoke("stop_deepgram");
      } catch (e) {
        setError(formatUserError(e));
        setStatus("Error");
      }
      setIsRecording(false);

      if (!error) {
        setStatus("Idle");
      }

      busyRef.current = false;
      setIsBusy(false);
    }
  }

  async function toggleRecording() {
    if (busyRef.current) return;
    if (!isRecording) {
      await start();
    } else {
      await stop();
    }
  }

  useEffect(() => {
    function shouldIgnoreHotkeyTarget(target) {
      if (!target) return false;
      const tag = target.tagName?.toLowerCase?.();
      return tag === "input" || tag === "textarea" || target.isContentEditable;
    }

    async function onKeyDown(e) {
      if (e.code !== "Space") return;
      if (e.repeat) return;
      if (shouldIgnoreHotkeyTarget(e.target)) return;

      e.preventDefault();
      if (!isRecordingRef.current) {
        await start();
      }
    }

    async function onKeyUp(e) {
      if (e.code !== "Space") return;
      if (shouldIgnoreHotkeyTarget(e.target)) return;

      e.preventDefault();
      if (isRecordingRef.current) {
        await stop();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  async function copyTranscript() {
    const text = `${finalTranscript}${
      interimTranscript ? " " + interimTranscript : ""
    }`.trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      setError(`Copy failed: ${String(e)}`);
    }
  }

  const transcript = `${finalTranscript}${
    interimTranscript ? " " + interimTranscript : ""
  }`.trim();

  return (
    <main className="container">
      <h1>Wisper</h1>
      <p className="subtitle">AI Voice to Text</p>

      <button
        className={`mic-button ${isRecording ? "recording" : ""}`}
        onClick={toggleRecording}
        disabled={isBusy}
      >
        {isBusy
          ? "Working..."
          : isRecording
          ? "Stop Recording"
          : "Start Recording"}
      </button>

      <div className="output">
        <p className="recording-hint">Status: {error ? "Error" : status}</p>
        <p>
          {error
            ? error
            : transcript ||
              (isRecording ? "Listening..." : "Hold Space or click to start")}
        </p>
        <button
          className="clear-button"
          onClick={copyTranscript}
          disabled={!transcript}
        >
          Copy Text
        </button>
      </div>
    </main>
  );
}

export default App;
