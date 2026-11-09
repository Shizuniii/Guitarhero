// Läuft im Audio-Thread: reicht die Mikrofon-Samples mit der genauen Startzeit weiter.
class Tap extends AudioWorkletProcessor {
  constructor() {
    super();
    this.size = 2048;
    this.buf = new Float32Array(this.size);
    this.n = 0;
    this.started = false;
    this.on = true;
    this.port.onmessage = (e) => {
      if (e.data !== 'stop') return;
      if (this.n) this.port.postMessage({ chunk: this.buf.slice(0, this.n) });
      this.n = 0;
      this.on = false;
      this.port.postMessage({ done: true });
    };
  }

  process(inputs) {
    if (!this.on) return false;
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    if (!this.started) {
      this.started = true;
      this.port.postMessage({ start: currentTime, sampleRate });
    }
    for (let i = 0; i < ch.length; i++) {
      this.buf[this.n++] = ch[i];
      if (this.n === this.size) {
        this.port.postMessage({ chunk: this.buf });
        this.buf = new Float32Array(this.size);
        this.n = 0;
      }
    }
    return true;
  }
}

registerProcessor('gh-tap', Tap);
