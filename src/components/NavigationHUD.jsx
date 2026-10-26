import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Radio,
  Clock,
  Navigation as NavIcon,
  Timer,
} from "lucide-react";
import { formatDistance, formatDuration, formatTime24h, getTimeZoneLabel } from "../utils/geo";
import { t } from "../utils/i18n";

/**
 * Eye-catching automotive-grade SVG maneuver arrows.
 * Replaces ambiguous text words ("turn right", "belok kanan") and standard emoji icons
 * with bold, high-contrast vector arrows for instantaneous glance recognition.
 */
const ManeuverArrow = ({ modifier, type, theme = "light" }) => {
  const mod = (modifier || "").toLowerCase();
  const tType = (type || "").toLowerCase();
  const isDark = theme === "dark";

  // Accent color: Electric Lime (#d2fc15) on dark, athletic Carbon (#0f0f12) on light
  const strokeColor = isDark ? "#d2fc15" : "#0f0f12";

  // 1. Destination / Finish
  if (tType.includes("arrive") || tType.includes("destination")) {
    return (
      <svg className="w-11 h-11" viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="19" stroke={strokeColor} strokeWidth="3.5" strokeDasharray="3 3" />
        <circle cx="24" cy="24" r="11" fill={strokeColor} />
        <circle cx="24" cy="24" r="4.5" fill={isDark ? "#121215" : "#ffffff"} />
      </svg>
    );
  }

  // 2. U-Turn
  if (mod.includes("uturn") || mod.includes("u-turn") || tType.includes("uturn")) {
    return (
      <svg className="w-11 h-11" viewBox="0 0 48 48" fill="none">
        <path
          d="M33 38V19C33 12.37 27.63 7 21 7C14.37 7 9 12.37 9 19V36"
          stroke={strokeColor}
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        <path
          d="M3.5 30.5L9 36.5L14.5 30.5"
          stroke={strokeColor}
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  // 3. Sharp Left
  if (mod.includes("sharp left")) {
    return (
      <svg className="w-11 h-11" viewBox="0 0 48 48" fill="none">
        <path
          d="M34 38L24 16L12 28"
          stroke={strokeColor}
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M8 20L12 28L20 24"
          stroke={strokeColor}
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  // 4. Sharp Right
  if (mod.includes("sharp right")) {
    return (
      <svg className="w-11 h-11" viewBox="0 0 48 48" fill="none">
        <path
          d="M14 38L24 16L36 28"
          stroke={strokeColor}
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M40 20L36 28L28 24"
          stroke={strokeColor}
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  // 5. Turn Left (Smooth curved 90° arrow)
  if (mod.includes("left") && !mod.includes("slight")) {
    return (
      <svg className="w-11 h-11" viewBox="0 0 48 48" fill="none">
        <path
          d="M33 39V24C33 16.27 26.73 10 19 10H10"
          stroke={strokeColor}
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        <path
          d="M16.5 3.5L9 10L16.5 16.5"
          stroke={strokeColor}
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  // 6. Turn Right (Smooth curved 90° arrow)
  if (mod.includes("right") && !mod.includes("slight")) {
    return (
      <svg className="w-11 h-11" viewBox="0 0 48 48" fill="none">
        <path
          d="M15 39V24C15 16.27 21.27 10 29 10H38"
          stroke={strokeColor}
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        <path
          d="M31.5 3.5L39 10L31.5 16.5"
          stroke={strokeColor}
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  // 7. Slight Left (45° fork/turn)
  if (mod.includes("slight left")) {
    return (
      <svg className="w-11 h-11" viewBox="0 0 48 48" fill="none">
        <path
          d="M28 38V24L14 10"
          stroke={strokeColor}
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M23 9H13V19"
          stroke={strokeColor}
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  // 8. Slight Right (45° fork/turn)
  if (mod.includes("slight right")) {
    return (
      <svg className="w-11 h-11" viewBox="0 0 48 48" fill="none">
        <path
          d="M20 38V24L34 10"
          stroke={strokeColor}
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M25 9H35V19"
          stroke={strokeColor}
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  // 9. Roundabout
  if (tType.includes("roundabout") || tType.includes("rotary")) {
    return (
      <svg className="w-11 h-11" viewBox="0 0 48 48" fill="none">
        <path
          d="M24 10C16.27 10 10 16.27 10 24C10 31.73 16.27 38 24 38C30.2 38 35.4 34 37.3 28"
          stroke={strokeColor}
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        <path
          d="M32 23L38 28L43 23"
          stroke={strokeColor}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  // 10. Default: Straight ahead (Bold aerodynamic vertical arrow)
  return (
    <svg className="w-11 h-11" viewBox="0 0 48 48" fill="none">
      <path
        d="M24 38V12"
        stroke={strokeColor}
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <path
        d="M15 19L24 10L33 19"
        stroke={strokeColor}
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default function NavigationHUD({
  currentStep,
  distanceToNextStep,
  totalRemainingDistance,
  totalRemainingDuration,
  currentSpeed,
  lastAlertSent,
  onStopNavigation,
  theme = "light",
  lang = "id",
}) {
  const speedKmh = currentSpeed != null && currentSpeed > 0 ? Math.round(currentSpeed * 3.6) : 0;

  const [clock, setClock] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setClock(Date.now());
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const arrivalTime = useMemo(() => {
    const targetDate = new Date(clock + (totalRemainingDuration || 0) * 1000);
    return formatTime24h(targetDate);
  }, [clock, totalRemainingDuration]);

  const isDark = theme === "dark";

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3.5 pt-safe pb-safe z-[1000]">
      {/* Top Banner: Hero Maneuver Arrow & Big Distance (No clutter text words) */}
      <div
        className={`pointer-events-auto rounded-2xl p-4 shadow-xl border max-w-lg mx-auto w-full transition-colors ${
          isDark
            ? "bg-[#18181c] text-white border-[#27272e]"
            : "bg-white text-slate-900 border-slate-200"
        }`}
      >
        <div className="flex items-center gap-3.5">
          {/* Eye-catching Hero Arrow Icon */}
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border transition-all ${
              isDark
                ? "bg-[#1f1f25] border-[#d2fc15]/40 shadow-[0_0_18px_rgba(210,252,21,0.25)]"
                : "bg-slate-100 border-slate-200 shadow-sm"
            }`}
          >
            <ManeuverArrow
              modifier={currentStep?.modifier}
              type={currentStep?.type}
              theme={theme}
            />
          </div>

          {/* Large Distance & Street Name (Clean, Word-Free) */}
          <div className="flex-1 min-w-0">
            <div className="text-3xl sm:text-4xl font-black tracking-tight leading-none">
              <span className={isDark ? "text-white" : "text-slate-900"}>
                {formatDistance(distanceToNextStep)}
              </span>
            </div>
            <p
              className={`text-xs font-semibold truncate mt-1.5 ${
                isDark ? "text-zinc-300" : "text-slate-600"
              }`}
            >
              {currentStep?.name || (lang === "en" ? "Next Street" : "Jalan Berikutnya")}
            </p>
          </div>
        </div>

        {/* Live Smartwatch Alert Status */}
        {lastAlertSent && (
          <div
            className={`mt-3 pt-2.5 border-t flex items-center justify-between text-xs ${
              isDark ? "border-[#27272e] text-[#d2fc15]" : "border-slate-200 text-emerald-600"
            }`}
          >
            <span className="flex items-center gap-1.5 font-semibold">
              <Radio className="w-3.5 h-3.5" />
              {t("alertSentBadge", lang)}
            </span>
            <span
              className={`font-mono text-[11px] truncate max-w-[200px] font-bold ${
                isDark ? "text-zinc-200" : "text-slate-700"
              }`}
            >
              {lastAlertSent}
            </span>
          </div>
        )}
      </div>

      {/* Bottom Dashboard: Eggel Active glanceable athletic metrics */}
      <div
        className={`pointer-events-auto rounded-2xl p-4 shadow-xl border max-w-lg mx-auto w-full transition-colors ${
          isDark
            ? "bg-[#18181c] text-white border-[#27272e]"
            : "bg-white text-slate-900 border-slate-200"
        }`}
      >
        <div
          className={`grid grid-cols-3 gap-2 text-center pb-3 border-b ${
            isDark ? "border-[#27272e]" : "border-slate-200"
          }`}
        >
          {/* Column 1: Remaining Duration (Eggel Electric Lime) */}
          <div className="flex flex-col items-center">
            <span
              className={`text-[11px] font-bold flex items-center gap-1 ${
                isDark ? "text-zinc-400" : "text-slate-500"
              }`}
            >
              <Timer className={`w-3.5 h-3.5 ${isDark ? "text-[#d2fc15]" : "text-slate-700"}`} />
              {t("remainingTime", lang)}
            </span>
            <div
              className={`text-xl font-black mt-1 ${
                isDark ? "text-[#d2fc15]" : "text-slate-900"
              }`}
            >
              {formatDuration(totalRemainingDuration, lang)}
            </div>
            <span className="text-[10px] text-zinc-400 font-medium">
              {lang === "en" ? "Speed: " : "Kecepatan: "}{speedKmh} km/h
            </span>
          </div>

          {/* Column 2: Remaining Distance (Eggel Sky Cyan) */}
          <div className="flex flex-col items-center">
            <span
              className={`text-[11px] font-bold flex items-center gap-1 ${
                isDark ? "text-zinc-400" : "text-slate-500"
              }`}
            >
              <NavIcon className={`w-3.5 h-3.5 ${isDark ? "text-[#38bdf8]" : "text-slate-700"}`} />
              {t("remainingDistance", lang)}
            </span>
            <div
              className={`text-xl font-black mt-1 ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              {formatDistance(totalRemainingDistance)}
            </div>
            <span className="text-[10px] text-zinc-400 font-medium">{t("totalLabel", lang)}</span>
          </div>

          {/* Column 3: Estimated Arrival */}
          <div className="flex flex-col items-center">
            <span
              className={`text-[11px] font-bold flex items-center gap-1 ${
                isDark ? "text-zinc-400" : "text-slate-500"
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              {t("estimatedArrival", lang)}
            </span>
            <div
              className={`text-xl font-black mt-1 ${
                isDark ? "text-zinc-100" : "text-slate-900"
              }`}
            >
              {arrivalTime}
            </div>
            <span className="text-[10px] text-zinc-400 font-bold tracking-wider">
              {getTimeZoneLabel()}
            </span>
          </div>
        </div>

        {/* Footer controls: Audio Keep-Alive Status + Stop Button */}
        <div className="flex items-center justify-between pt-3 gap-3">
          <div className="flex items-center gap-2 text-xs text-zinc-400 font-medium">
            <span className={`inline-block w-2 h-2 rounded-full ${isDark ? "bg-[#d2fc15]" : "bg-emerald-500"}`} />
            <span>
              {t("audioActive", lang)}
            </span>
          </div>

          <button
            onClick={onStopNavigation}
            className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-sm transition active:scale-95"
          >
            <X className="w-4 h-4" />
            {t("endNavBtn", lang)}
          </button>
        </div>
      </div>
    </div>
  );
}
