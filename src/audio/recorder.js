import { invoke } from "@tauri-apps/api/core";

let audioContext;
let stream;
let source;
let workletNode;
let gainNode;
let pendingSends = 0;

export async function startRecording({ onSampleRate } = {}) {
  if (audioContext) return audioContext.sampleRate;

  stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  // Prefer low-latency audio; try 16kHz to reduce bandwidth/IPC cost.
  const Ctx = window.AudioContext || window.webkitAudioContext;
  try {
    audioContext = new Ctx({ latencyHint: "interactive", sampleRate: 16000 });
  } catch {
    audioContext = new Ctx({ latencyHint: "interactive" });
  }

  if (audioContext.state === "suspended") {
    try {
      await audioContext.resume();
    } catch {
      // ignore
    }
  }
  const sampleRate = audioContext.sampleRate;

  if (onSampleRate) {
    await onSampleRate(sampleRate);
  }

  await audioContext.audioWorklet.addModule(
    new URL("../worklets/pcm-processor.js", import.meta.url)
  );

  source = audioContext.createMediaStreamSource(stream);
  workletNode = new AudioWorkletNode(audioContext, "pcm-processor");
  gainNode = audioContext.createGain();
  gainNode.gain.value = 0;

  workletNode.port.onmessage = (event) => {
    const pcm16 = event.data;
    if (!pcm16 || !(pcm16 instanceof Int16Array)) return;

    // If IPC to Rust falls behind, drop audio to keep perceived latency low.
    if (pendingSends >= 4) return;

    // Send raw bytes without converting to a JS number array (much faster).
    const bytes = new Uint8Array(pcm16.buffer);

    pendingSends += 1;
    invoke("send_audio", { chunk: bytes })
      .catch(() => {})
      .finally(() => {
        pendingSends = Math.max(0, pendingSends - 1);
      });
  };

  source.connect(workletNode);
  workletNode.connect(gainNode);
  gainNode.connect(audioContext.destination);

  return sampleRate;
}

export async function stopRecording() {
  try {
    workletNode?.port?.close?.();
  } catch {
    // ignore
  }

  try {
    workletNode?.disconnect();
    source?.disconnect();
    gainNode?.disconnect();
  } catch {
    // ignore
  }

  stream?.getTracks?.().forEach((t) => t.stop());

  source = null;
  workletNode = null;
  gainNode = null;
  stream = null;

  if (audioContext) {
    try {
      await audioContext.close();
    } catch {
      // ignore
    }
    audioContext = null;
  }

  pendingSends = 0;
}
