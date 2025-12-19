class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    const targetMs = 40;
    this._targetFrames = Math.max(
      128,
      Math.round((sampleRate * targetMs) / 1000)
    );
    this._buffer = new Int16Array(this._targetFrames);
    this._offset = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channelData = input[0];
    let i = 0;
    while (i < channelData.length) {
      const remaining = this._targetFrames - this._offset;
      const toCopy = Math.min(remaining, channelData.length - i);

      for (let j = 0; j < toCopy; j++) {
        const s = Math.max(-1, Math.min(1, channelData[i + j]));
        this._buffer[this._offset + j] = s * 0x7fff;
      }

      this._offset += toCopy;
      i += toCopy;

      if (this._offset >= this._targetFrames) {
        const full = this._buffer;
        this.port.postMessage(full, [full.buffer]);
        this._buffer = new Int16Array(this._targetFrames);
        this._offset = 0;
      }
    }
    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);
