import { useEffect, useRef, useState } from "react";
import { startRecording, stopRecording } from "./audio/recorder";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "./App.css";

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [finalTranscript, setFinalTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState("");
  const isRecordingRef = useRef(false);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    let disposed = false;
    let unlisten = null;

    const unlistenPromise = listen("deepgram:transcript", (event) => {
      const payload = event.payload;
      if (!payload || typeof payload.transcript !== "string") return;

      // Deepgram interim/final messages commonly contain the full utterance-so-far.
      // We only "commit" to the final transcript when Deepgram marks the utterance as speech_final.
      const nextUtterance = payload.transcript;
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

    unlistenPromise
      .then((fn) => {
        if (disposed) {
          fn();
          return;
        }
        unlisten = fn;
      })
      .catch(() => {
        // ignore
      });

    return () => {
      disposed = true;
      if (unlisten) unlisten();
    };
  }, []);

  async function start() {
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
    } catch (e) {
      setError(String(e));
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
    }
  }

  async function stop() {
    setError("");
    try {
      await stopRecording();
    } finally {
      try {
        await invoke("stop_deepgram");
      } catch (e) {
        setError(String(e));
      }
      setIsRecording(false);
    }
  }

  async function toggleRecording() {
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
      >
        {isRecording ? "Stop Recording" : "Start Recording"}
      </button>

      <div className="output">
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
