import React, { useState, useEffect, useRef } from "react";
import { Lock, ShieldCheck, Zap } from "lucide-react";
import { formatDistance, formatDuration, formatTime24h } from "../utils/geo";
import { getManeuverArrowText } from "../utils/telegram";

/**
 * PocketMode (Mode Kantong OLED)
 *
 * Specifically engineered for motorcycle riders with iPhones / smartphones:
 * 1. 100% Pure Pitch Black (#000000): On OLED displays (iPhone X, 11 Pro, 12, 13, 14, 15, 16),
 *    black pixels are physically switched OFF, consuming virtually 0% battery.
 * 2. Continuous Screen WakeLock: Keeps iOS WebKit and GPS hardware active 100% in real time,
 *    preventing Apple's OS from sleeping CoreLocation or queuing background notifications.
 * 3. Hold-to-Unlock Guard (1.2s): Completely prevents fabrics/pocket friction from
 *    accidentally tapping buttons or exiting navigation while riding.
 * 4. Ultra-Glanceable ASCII Maneuver HUD: Displays the exact same 100% ASCII arrow
 *    as transmitted to the smartwatch.
 */
export default function PocketMode({
  currentStep,
  distanceToNextStep,
  totalRemainingDistance,
  totalRemainingDuration,
  currentSpeed,
  onExit,
  language = "id",
}) {
  const [clock, setClock] = useState(() => Date.now());
  const [holdProgress, setHoldProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const holdIntervalRef = useRef(null);
  const wakeLockRef = useRef(null);

  // Digital clock refresh
  useEffect(() => {
    const t = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Aggressive WakeLock maintenance while in Pocket Mode
  useEffect(() => {
    let active = true;

    const acquireLock = async () => {
      if (!active) return;
      if ("wakeLock" in navigator) {
        try {
          if (!wakeLockRef.current) {
            wakeLockRef.current = await navigator.wakeLock.request("screen");
            wakeLockRef.current.addEventListener("release", () => {
              wakeLockRef.current = null;
            });
          }
        } catch (err) {
          console.warn("PocketMode WakeLock error:", err);
        }
      }
    };

    acquireLock();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        acquireLock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", handleVisibility);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, []);

  // Hold-to-Unlock logic (1.2 seconds press)
  const handleHoldStart = (e) => {
    // Prevent default context menus and unwanted gestures
    if (e.cancelable) e.preventDefault();
    setIsHolding(true);
    setHoldProgress(0);

    const startTime = Date.now();
    const duration = 1200; // 1.2 seconds required

    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);

    holdIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(100, (elapsed / duration) * 100);
      setHoldProgress(progress);

      if (progress >= 100) {
        clearInterval(holdIntervalRef.current);
        holdIntervalRef.current = null;
        if (navigator.vibrate) {
          try {
            navigator.vibrate([30, 40, 60]);
          } catch {
            // Ignore vibrate error
          }
        }
        onExit();
      }
    }, 25);
  };

  const handleHoldEnd = () => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    setIsHolding(false);
    setHoldProgress(0);
  };

  const isEn = language === "en";
  const speedKmh = currentSpeed != null && currentSpeed > 0 ? Math.round(currentSpeed * 3.6) : 0;
  const arrowText = getManeuverArrowText(currentStep?.modifier, currentStep?.type);
  const stepStreet = (currentStep?.name || (isEn ? "Straight Ahead" : "Terus Ikuti Jalan")).slice(0, 32);

  return (
    <div
      className="fixed inset-0 z-[9999] bg-[#000000] text-white select-none flex flex-col justify-between p-5 pt-safe pb-safe touch-none overflow-hidden"
      style={{ backgroundColor: "#000000" }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Top Status Header: Minimal OLED Clock & GPS Status */}
      <div className="flex items-center justify-between py-2 border-b border-zinc-900">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#d2fc15] opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#d2fc15]" />
          </span>
          <span className="font-mono text-xs font-bold text-[#d2fc15] tracking-wider uppercase">
            {isEn ? "POCKET MODE ACTIVE" : "MODE KANTONG AKTIF"}
          </span>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs text-zinc-400">
          <Zap className="w-3.5 h-3.5 text-zinc-500" />
          <span>{speedKmh} km/h</span>
          <span className="text-zinc-600">|</span>
          <span className="font-bold text-zinc-200">{formatTime24h(new Date(clock))}</span>
        </div>
      </div>

      {/* Center Section: High-Contrast Big ASCII Maneuver HUD (OLED Glancable) */}
      <div className="my-auto flex flex-col items-center justify-center text-center space-y-4 py-4">
        {/* Giant Monospace ASCII Arrow */}
        <div className="font-mono text-6xl sm:text-7xl font-black tracking-widest text-[#d2fc15] drop-shadow-[0_0_25px_rgba(210,252,21,0.4)]">
          {arrowText}
        </div>

        {/* Distance to next turn */}
        <div className="font-sans text-4xl sm:text-5xl font-black tracking-tight text-white">
          {formatDistance(distanceToNextStep)}
        </div>

        {/* Street Name */}
        <div className="text-sm sm:text-base font-semibold text-zinc-300 max-w-xs truncate px-2">
          {stepStreet}
        </div>

        {/* Remaining Trip Stats */}
        <div className="flex items-center gap-3 pt-2 text-xs font-mono text-zinc-400">
          <span>{formatDistance(totalRemainingDistance)}</span>
          <span className="text-zinc-700">•</span>
          <span>{formatDuration(totalRemainingDuration, language)}</span>
        </div>
      </div>

      {/* Bottom Section: Riding Tip & Hold-to-Unlock Guard */}
      <div className="space-y-4 pt-2">
        {/* Essential Rider Guidance Banner */}
        <div className="bg-zinc-950/80 border border-zinc-900 rounded-xl p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 text-[#d2fc15] text-[11px] font-bold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{isEn ? "Keep Screen in this Mode" : "Jangan Matikan Layar dengan Tombol Power"}</span>
          </div>
          <p className="text-[10px] text-zinc-400 mt-0.5 leading-relaxed">
            {isEn
              ? "Put iPhone directly into your pocket. OLED black saves ~99% battery while keeping GPS alive."
              : "Masukkan HP langsung ke saku/jaket. Layar hitam OLED sangat hemat baterai & GPS tetap aktif 100%."}
          </p>
        </div>

        {/* Hold-to-Unlock Button (Protected against fabric friction) */}
        <div className="flex flex-col items-center">
          <button
            type="button"
            onPointerDown={handleHoldStart}
            onPointerUp={handleHoldEnd}
            onPointerCancel={handleHoldEnd}
            onPointerLeave={handleHoldEnd}
            className="relative w-full max-w-xs h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center overflow-hidden transition active:scale-[0.98] select-none"
          >
            {/* Animated progress fill */}
            <div
              className="absolute left-0 top-0 bottom-0 bg-[#d2fc15] transition-all ease-linear"
              style={{ width: `${holdProgress}%` }}
            />

            {/* Button label */}
            <div
              className={`relative z-10 flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-wider transition ${
                holdProgress > 50 ? "text-[#0f0f12]" : "text-zinc-300"
              }`}
            >
              <Lock className="w-4 h-4" />
              <span>
                {isHolding
                  ? isEn
                    ? "HOLDING TO UNLOCK..."
                    : "MENAHAN UNTUK MEMBUKA..."
                  : isEn
                  ? "HOLD 1.5s TO UNLOCK"
                  : "TAHAN 1.5 DETIK UNTUK BUKA"}
              </span>
            </div>
          </button>

          <span className="text-[10px] text-zinc-600 mt-2 font-mono">
            {isEn ? "Hold button to return to map" : "Tahan tombol untuk melihat peta kembali"}
          </span>
        </div>
      </div>
    </div>
  );
}
