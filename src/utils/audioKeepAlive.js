// Professional iOS & Android Background Keep-Alive Service
// Keeps PWA process, Geolocation, and Network active when screen is locked or in pocket.

function createSilentWavBlob(seconds = 5, sampleRate = 8000) {
  const numSamples = seconds * sampleRate;
  const buffer = new ArrayBuffer(44 + numSamples);
  const view = new DataView(buffer);

  // RIFF header
  for (let i = 0; i < 4; i++) view.setUint8(i, "RIFF".charCodeAt(i));
  view.setUint32(4, 36 + numSamples, true);
  for (let i = 0; i < 4; i++) view.setUint8(8 + i, "WAVE".charCodeAt(i));

  // fmt chunk
  for (let i = 0; i < 4; i++) view.setUint8(12 + i, "fmt ".charCodeAt(i));
  view.setUint32(16, 16, true); // SubChunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, 1, true); // NumChannels (1 mono)
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate, true); // ByteRate (SampleRate * 1 channel * 8 bits / 8)
  view.setUint16(32, 1, true); // BlockAlign
  view.setUint16(34, 8, true); // BitsPerSample (8-bit)

  // data chunk
  for (let i = 0; i < 4; i++) view.setUint8(36 + i, "data".charCodeAt(i));
  view.setUint32(40, numSamples, true);

  // 8-bit unsigned PCM silence is 128 (0x80)
  const samples = new Uint8Array(buffer, 44, numSamples);
  samples.fill(128);

  return new Blob([buffer], { type: "audio/wav" });
}

function createHeartbeatWorker() {
  const workerCode = `
    let timer = null;
    self.onmessage = function(e) {
      if (e.data === 'start') {
        if (timer) clearInterval(timer);
        timer = setInterval(function() {
          self.postMessage('tick');
        }, 1000);
      } else if (e.data === 'stop') {
        if (timer) clearInterval(timer);
        timer = null;
      }
    };
  `;
  const blob = new Blob([workerCode], { type: "application/javascript" });
  return new Worker(URL.createObjectURL(blob));
}

class BackgroundKeepAlive {
  constructor() {
    this.audioElement = null;
    this.audioBlobUrl = null;
    this.audioCtx = null;
    this.oscillator = null;
    this.wakeLock = null;
    this.worker = null;
    this.isPlaying = false;
    this.heartbeatCallback = null;

    this._handleVisibility = this._handleVisibility.bind(this);
    this._handleAudioInterruption = this._handleAudioInterruption.bind(this);
  }

  init() {
    if (this.audioElement) return;

    // Generate real 5-second PCM audio track (recognized as valid continuous media by iOS)
    const blob = createSilentWavBlob(5, 8000);
    this.audioBlobUrl = URL.createObjectURL(blob);

    this.audioElement = new Audio(this.audioBlobUrl);
    this.audioElement.loop = true;
    this.audioElement.setAttribute("playsinline", "true");
    this.audioElement.setAttribute("webkit-playsinline", "true");
    this.audioElement.volume = 0.05; // Audible-range metadata level, inaudible PCM content

    // Guard against iOS pausing audio when locked
    this.audioElement.addEventListener("pause", () => {
      if (this.isPlaying) {
        setTimeout(() => {
          if (this.isPlaying && this.audioElement && this.audioElement.paused) {
            this.audioElement.play().catch(() => {});
          }
        }, 200);
      }
    });

    // Initialize Web Worker Heartbeat
    try {
      this.worker = createHeartbeatWorker();
      this.worker.onmessage = (e) => {
        if (e.data === "tick" && this.isPlaying && this.heartbeatCallback) {
          this.heartbeatCallback();
        }
      };
    } catch (e) {
      console.warn("Background worker initialization fallback:", e);
    }
  }

  setupMediaSession() {
    if (!("mediaSession" in navigator)) return;

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: "Eggel Navigasi Aktif",
        artist: "Turn-by-Turn GPS Smartwatch",
        album: "Layanan Navigasi Latar Belakang",
      });

      navigator.mediaSession.playbackState = "playing";

      navigator.mediaSession.setActionHandler("play", () => {
        if (this.isPlaying && this.audioElement) {
          this.audioElement.play().catch(() => {});
        }
      });

      navigator.mediaSession.setActionHandler("pause", () => {
        // Prevent accidental pause from lockscreen or headphone button
        if (this.isPlaying && this.audioElement) {
          this.audioElement.play().catch(() => {});
        }
      });
    } catch (e) {
      console.warn("MediaSession setup fallback:", e);
    }
  }

  async _handleVisibility() {
    if (document.visibilityState === "visible" && this.isPlaying) {
      if ("wakeLock" in navigator && !this.wakeLock) {
        try {
          this.wakeLock = await navigator.wakeLock.request("screen");
        } catch {
          // Ignore wakeLock error on resume
        }
      }
      if (this.audioElement && this.audioElement.paused) {
        try {
          await this.audioElement.play();
        } catch {
          // Ignore autoplay error
        }
      }
      if (this.audioCtx && (this.audioCtx.state === "suspended" || this.audioCtx.state === "interrupted")) {
        try {
          await this.audioCtx.resume();
        } catch {
          // Ignore audioCtx resume error
        }
      }
    }
  }

  _handleAudioInterruption() {
    if (this.isPlaying && this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume().catch(() => {});
    }
  }

  async start(onHeartbeat = null) {
    this.init();
    this.isPlaying = true;
    this.heartbeatCallback = onHeartbeat;

    // 1. Play valid 5-second PCM silent loop
    try {
      if (this.audioElement) {
        await this.audioElement.play();
        console.log("Continuous background audio keep-alive activated");
      }
    } catch (err) {
      console.warn("Audio play blocked by browser policy:", err);
    }

    // 2. WebAudio API Continuous Audio Context
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        if (!this.audioCtx) {
          this.audioCtx = new AudioCtx();
        }

        if (this.audioCtx.state === "suspended" || this.audioCtx.state === "interrupted") {
          await this.audioCtx.resume();
        }

        if (!this.oscillator) {
          this.oscillator = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();
          gain.gain.value = 0.0001; // Inaudible gain
          this.oscillator.connect(gain);
          gain.connect(this.audioCtx.destination);
          this.oscillator.start();
        }
      }
    } catch (e) {
      console.warn("WebAudio background fallback error:", e);
    }

    // 3. MediaSession API (Registers Now Playing on iOS Lock Screen)
    this.setupMediaSession();

    // 4. Start Heartbeat Worker
    if (this.worker) {
      this.worker.postMessage("start");
    }

    // 5. Screen Wake Lock (Keeps screen active if phone is mounted on holder)
    try {
      if ("wakeLock" in navigator && !this.wakeLock) {
        this.wakeLock = await navigator.wakeLock.request("screen");
        this.wakeLock.addEventListener("release", () => {
          this.wakeLock = null;
        });
        console.log("Screen WakeLock acquired");
      }
    } catch (e) {
      console.warn("WakeLock request failed or unsupported:", e);
    }

    document.removeEventListener("visibilitychange", this._handleVisibility);
    document.addEventListener("visibilitychange", this._handleVisibility);
    window.removeEventListener("focus", this._handleAudioInterruption);
    window.addEventListener("focus", this._handleAudioInterruption);
  }

  stop() {
    this.isPlaying = false;
    this.heartbeatCallback = null;

    if (this.worker) {
      this.worker.postMessage("stop");
    }

    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
    }

    if (this.oscillator) {
      try {
        this.oscillator.stop();
        this.oscillator.disconnect();
      } catch {}
      this.oscillator = null;
    }

    if (this.audioCtx) {
      try {
        this.audioCtx.close();
      } catch {}
      this.audioCtx = null;
    }

    if (this.wakeLock) {
      this.wakeLock.release().catch(() => {});
      this.wakeLock = null;
    }

    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = "none";
    }

    document.removeEventListener("visibilitychange", this._handleVisibility);
    window.removeEventListener("focus", this._handleAudioInterruption);
    console.log("Background keep-alive stopped");
  }
}

export const keepAlive = new BackgroundKeepAlive();
