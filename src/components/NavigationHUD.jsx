import React, { useState, useEffect, useMemo } from "react";
import {
  ArrowUp,
  ArrowLeft,
  ArrowRight,
  ArrowUpLeft,
  ArrowUpRight,
  RotateCcw,
  CheckCircle2,
  X,
  Radio,
  Clock,
  Navigation as NavIcon,
  Timer,
} from "lucide-react";
import { formatDistance, formatDuration } from "../utils/geo";
import { t } from "../utils/i18n";

const getManeuverIcon = (modifier, type, theme = "light") => {
  const mod = (modifier || "").toLowerCase();
  const tType = (type || "").toLowerCase();
  const primaryColor = theme === "dark" ? "text-blue-400" : "text-indigo-600";

  if (mod.includes("uturn") || mod.includes("u-turn") || tType.includes("uturn")) {
    return <RotateCcw className="w-9 h-9 text-amber-500" />;
  }
  if (mod.includes("sharp left") || mod.includes("left")) {
    return mod.includes("slight") ? (
      <ArrowUpLeft className={`w-9 h-9 ${primaryColor}`} />
    ) : (
      <ArrowLeft className={`w-9 h-9 ${primaryColor}`} />
    );
  }
  if (mod.includes("sharp right") || mod.includes("right")) {
    return mod.includes("slight") ? (
      <ArrowUpRight className={`w-9 h-9 ${primaryColor}`} />
    ) : (
      <ArrowRight className={`w-9 h-9 ${primaryColor}`} />
    );
  }
  if (tType.includes("roundabout") || tType.includes("rotary")) {
    return <RotateCcw className={`w-9 h-9 ${primaryColor}`} />;
  }
  if (tType.includes("arrive") || tType.includes("destination")) {
    return <CheckCircle2 className="w-9 h-9 text-emerald-500" />;
  }
  return <ArrowUp className={`w-9 h-9 ${primaryColor}`} />;
};

const formatManeuverBadge = (modifier, type, lang = "id") => {
  const mod = (modifier || "").toLowerCase();
  const tType = (type || "").toLowerCase();
  const isEn = lang === "en";

  if (mod.includes("uturn") || mod.includes("u-turn") || tType.includes("uturn")) {
    return isEn ? "U-Turn" : "Putar Balik";
  }
  if (mod.includes("sharp left")) return isEn ? "Sharp Left" : "Belok Kiri Tajam";
  if (mod.includes("slight left")) return isEn ? "Slight Left" : "Serong Kiri";
  if (mod.includes("left")) return isEn ? "Turn Left" : "Belok Kiri";
  if (mod.includes("sharp right")) return isEn ? "Sharp Right" : "Belok Kanan Tajam";
  if (mod.includes("slight right")) return isEn ? "Slight Right" : "Serong Kanan";
  if (mod.includes("right")) return isEn ? "Turn Right" : "Belok Kanan";
  if (tType.includes("arrive") || tType.includes("destination")) {
    return isEn ? "Destination" : "Tujuan";
  }
  if (tType.includes("roundabout") || tType.includes("rotary")) {
    return isEn ? "Roundabout" : "Bundaran";
  }
  if (tType.includes("fork")) {
    if (isEn) {
      return mod.includes("left") ? "Keep Left" : "Keep Right";
    }
    return mod.includes("left") ? "Ambil Jalur Kiri" : "Ambil Jalur Kanan";
  }
  return isEn ? "Straight" : "Lurus";
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
    return new Date(clock + (totalRemainingDuration || 0) * 1000).toLocaleTimeString(
      lang === "en" ? "en-US" : "id-ID",
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  }, [clock, totalRemainingDuration, lang]);

  const isDark = theme === "dark";

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 z-[1000]">
      {/* Top Banner: Next Maneuver */}
      <div
        className={`pointer-events-auto rounded-3xl p-4 shadow-2xl border max-w-lg mx-auto w-full transition-all ${
          isDark
            ? "bg-slate-900/95 text-white border-slate-800"
            : "bg-white/95 text-slate-800 border-slate-100"
        }`}
      >
        <div className="flex items-center gap-4">
          <div
            className={`p-3 rounded-2xl flex items-center justify-center shrink-0 border ${
              isDark
                ? "bg-slate-800/90 border-slate-700"
                : "bg-indigo-50 border-indigo-100/80 shadow-sm"
            }`}
          >
            {getManeuverIcon(currentStep?.modifier, currentStep?.type, theme)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span
                className={`text-3xl font-black tracking-tight ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                {formatDistance(distanceToNextStep)}
              </span>
              <span
                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                  isDark
                    ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                    : "bg-indigo-50 text-indigo-700 border-indigo-200"
                }`}
              >
                {formatManeuverBadge(currentStep?.modifier, currentStep?.type, lang)}
              </span>
            </div>
            <p
              className={`text-sm font-medium truncate mt-0.5 ${
                isDark ? "text-slate-300" : "text-slate-600"
              }`}
            >
              {currentStep?.name || (lang === "en" ? "Next Street" : "Jalan Berikutnya")}
            </p>
          </div>
        </div>

        {/* Live Smartwatch Alert Badge */}
        {lastAlertSent && (
          <div
            className={`mt-3 pt-2.5 border-t flex items-center justify-between text-xs ${
              isDark ? "border-slate-800 text-emerald-400" : "border-slate-100 text-emerald-600"
            }`}
          >
            <span className="flex items-center gap-1.5 font-medium">
              <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-500" />
              {t("alertSentBadge", lang)}
            </span>
            <span
              className={`font-mono truncate max-w-[200px] ${
                isDark ? "text-slate-300" : "text-slate-600"
              }`}
            >
              {lastAlertSent}
            </span>
          </div>
        )}
      </div>

      {/* Bottom Dashboard: Styled cleanly like 4427554.jpg */}
      <div
        className={`pointer-events-auto rounded-3xl p-4 shadow-2xl border max-w-lg mx-auto w-full transition-all ${
          isDark
            ? "bg-slate-900/95 text-white border-slate-800"
            : "bg-white/95 text-slate-800 border-slate-100"
        }`}
      >
        <div
          className={`grid grid-cols-3 gap-2 text-center pb-3 border-b ${
            isDark ? "border-slate-800" : "border-slate-100"
          }`}
        >
          {/* Column 1: Remaining Duration */}
          <div className="flex flex-col items-center">
            <span
              className={`text-[11px] font-semibold flex items-center gap-1 ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              <Timer className="w-3.5 h-3.5 text-indigo-500" />
              {t("remainingTime", lang)}
            </span>
            <div
              className={`text-xl font-black mt-1 ${
                isDark ? "text-indigo-400" : "text-indigo-600"
              }`}
            >
              {formatDuration(totalRemainingDuration, lang)}
            </div>
            <span className="text-[10px] text-slate-400 font-medium">
              {speedKmh} km/h
            </span>
          </div>

          {/* Column 2: Remaining Distance */}
          <div className="flex flex-col items-center">
            <span
              className={`text-[11px] font-semibold flex items-center gap-1 ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              <NavIcon className="w-3.5 h-3.5 text-blue-500" />
              {t("remainingDistance", lang)}
            </span>
            <div
              className={`text-xl font-black mt-1 ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              {formatDistance(totalRemainingDistance)}
            </div>
            <span className="text-[10px] text-slate-400 font-medium">{t("totalLabel", lang)}</span>
          </div>

          {/* Column 3: Estimated Arrival */}
          <div className="flex flex-col items-center">
            <span
              className={`text-[11px] font-semibold flex items-center gap-1 ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-emerald-500" />
              {t("estimatedArrival", lang)}
            </span>
            <div
              className={`text-xl font-black mt-1 ${
                isDark ? "text-emerald-400" : "text-emerald-600"
              }`}
            >
              {arrivalTime}
            </div>
            <span className="text-[10px] text-slate-400 font-medium">{t("timeZone", lang)}</span>
          </div>
        </div>

        {/* Footer controls: Audio Keep-Alive Status + Stop Button */}
        <div className="flex items-center justify-between pt-3 gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <span className={isDark ? "text-slate-400" : "text-slate-600"}>
              {t("audioActive", lang)}
            </span>
          </div>

          <button
            onClick={onStopNavigation}
            className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-2xl shadow-md transition active:scale-95"
          >
            <X className="w-4 h-4" />
            {t("endNavBtn", lang)}
          </button>
        </div>
      </div>
    </div>
  );
}
