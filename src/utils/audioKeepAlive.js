// Silent Audio Loop & WakeLock Manager for iOS Background Keep-Alive

class BackgroundKeepAlive {
  constructor() {
    this.audioElement = null;
    this.audioCtx = null;
    this.wakeLock = null;
    this.isPlaying = false;
    this._handleVisibility = this._handleVisibility.bind(this);
  }

  init() {
    if (this.audioElement) return;

    // Minimal 1-second silent WAV file base64
    const silentWavBase64 =
      "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

    this.audioElement = new Audio(silentWavBase64);
    this.audioElement.loop = true;
    this.audioElement.setAttribute("playsinline", "true");
    this.audioElement.setAttribute("webkit-playsinline", "true");
    this.audioElement.volume = 0.01; // nearly silent, prevents system pause
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

  async start() {
    this.init();
    this.isPlaying = true;

    try {
      if (this.audioElement) {
        await this.audioElement.play();
        console.log("Silent audio keep-alive activated");
      }
    } catch (err) {
      console.warn("Audio autoplay blocked, requires user interaction first:", err);
    }

    // WebAudio subtle oscillator backup
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx && !this.audioCtx) {
        this.audioCtx = new AudioCtx();
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        gain.gain.value = 0.0001; // inaudible
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start();
      } else if (this.audioCtx && (this.audioCtx.state === "suspended" || this.audioCtx.state === "interrupted")) {
        await this.audioCtx.resume();
      }
    } catch (e) {
      console.warn("WebAudio keep-alive fallback error:", e);
    }

    // Screen Wake Lock
    try {
      if ("wakeLock" in navigator && !this.wakeLock) {
        this.wakeLock = await navigator.wakeLock.request("screen");
        this.wakeLock.addEventListener("release", () => {
          this.wakeLock = null;
        });
        console.log("WakeLock acquired");
      }
    } catch (e) {
      console.warn("WakeLock request failed or not supported:", e);
    }

    document.removeEventListener("visibilitychange", this._handleVisibility);
    document.addEventListener("visibilitychange", this._handleVisibility);
  }

  stop() {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
    }

    if (this.audioCtx) {
      try {
        this.audioCtx.close();
      } catch {
        // Ignore audioCtx close error
      }
      this.audioCtx = null;
    }

    if (this.wakeLock) {
      this.wakeLock.release().catch(() => {});
      this.wakeLock = null;
    }

    this.isPlaying = false;
    document.removeEventListener("visibilitychange", this._handleVisibility);
    console.log("Background keep-alive stopped");
  }
}

export const keepAlive = new BackgroundKeepAlive();
