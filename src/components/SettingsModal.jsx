import React, { useState } from "react";
import { Settings, X, Bell, Globe } from "lucide-react";
import { sendTelegramAlert } from "../utils/telegram";
import { formatTime24h } from "../utils/geo";
import { t } from "../utils/i18n";

const MANEUVER_TEST_PRESETS = {
  right: {
    label: "Kanan",
    arrow: "===>>",
    dist: "150m",
    street: "Jl. Raya Purwosari",
    testDesc: "Tes Kanan",
  },
  left: {
    label: "Kiri",
    arrow: "<<===",
    dist: "150m",
    street: "Jl. Margonda Raya",
    testDesc: "Tes Kiri",
  },
  straight: {
    label: "Lurus",
    arrow: "^^^^^",
    dist: "500m",
    street: "Jl. Surabaya-Malang",
    testDesc: "Tes Lurus",
  },
  uturn: {
    label: "U-Turn",
    arrow: "<<=||",
    dist: "100m",
    street: "Jl. Ahmad Yani",
    testDesc: "Tes U-Turn",
  },
  sharp_right: {
    label: "Tajam",
    arrow: "|==>>",
    dist: "100m",
    street: "Jl. Tikungan Tajam",
    testDesc: "Tes Tajam",
  },
};

function SmartwatchPreview({ selectedManeuver, onSelectManeuver, language = "id", isDark = true }) {
  const curr = MANEUVER_TEST_PRESETS[selectedManeuver] || MANEUVER_TEST_PRESETS.right;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? "text-zinc-400" : "text-slate-600"}`}>
          {language === "en" ? "Select Sign to Test" : "Pilih Arah Belokan untuk Diuji"}
        </span>
        <div className="flex gap-1 flex-wrap justify-end">
          {Object.entries(MANEUVER_TEST_PRESETS).map(([key, item]) => (
            <button
              key={key}
              type="button"
              onClick={() => onSelectManeuver(key)}
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition ${
                selectedManeuver === key
                  ? isDark
                    ? "bg-[#d2fc15] text-[#0f0f12] shadow-sm"
                    : "bg-slate-900 text-white shadow-sm"
                  : isDark
                  ? "bg-[#222228] text-zinc-400 hover:text-white"
                  : "bg-slate-100 text-slate-600 hover:text-slate-900"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Round Watch Bezel Container (Exact 1:1 round smartwatch geometry from user's photo) */}
      <div className="flex justify-center py-1">
        <div className="relative w-48 h-48 rounded-full bg-[#0d0d10] border-4 border-[#25252b] shadow-xl flex items-center justify-center p-2 select-none overflow-hidden">
          {/* Bezel Numerals (10, 20, 30, 40, 50, 60) */}
          <span className="absolute top-1 text-[8px] font-mono font-bold text-zinc-500">60</span>
          <span className="absolute right-1 text-[8px] font-mono font-bold text-zinc-500">15</span>
          <span className="absolute bottom-1 text-[8px] font-mono font-bold text-zinc-500">30</span>
          <span className="absolute left-1 text-[8px] font-mono font-bold text-zinc-500">45</span>

          {/* Watch Inner Screen (Round OLED) */}
          <div className="w-full h-full rounded-full bg-black flex flex-col justify-between pt-3 pb-1 px-3 text-center overflow-hidden border border-zinc-900">
            {/* Telegram Header */}
            <div>
              <div className="flex items-center justify-center gap-1">
                <div className="w-3.5 h-3.5 rounded-full bg-[#2aabee] flex items-center justify-center text-white text-[7px] font-bold shrink-0">
                  ✈
                </div>
                <span className="text-[10px] text-zinc-300 font-semibold truncate max-w-[100px]">
                  Navigation Bot
                </span>
              </div>
              <div className="w-20 h-px bg-zinc-800 mx-auto mt-1" />
            </div>

            {/* Navigation Message (Centered in the widest section of the round screen) */}
            <div className="my-auto py-1">
              <div className="font-mono text-xs font-black text-white tracking-wide">
                [{curr.dist}]  {curr.arrow}
              </div>
              <div className="font-sans text-[11px] font-medium text-zinc-300 truncate mt-1">
                {curr.street}
              </div>
            </div>

            {/* Bottom Orange Delete Semicircle Button (From user's watch photo) */}
            <div className="w-18 h-4.5 bg-gradient-to-t from-orange-600 to-amber-500 rounded-t-full mx-auto flex items-center justify-center opacity-95 shadow-sm mt-auto">
              <div className="w-2 h-2 border border-white/90 rounded-[2px] mb-0.5" />
            </div>
          </div>
        </div>
      </div>
      <p className="text-[10px] text-center text-zinc-400">
        {language === "en"
          ? "Compact 5-char arrow fits in 13 chars - 100% no line breaking on round screens"
          : "Panah 5 karakter (13 huruf) - dijamin pas 1 baris tanpa terpotong"}
      </p>
    </div>
  );
}

function SettingsForm({ settings, onClose, onSaveSettings, theme = "light" }) {
  const [botToken, setBotToken] = useState(
    settings?.botToken || "8863619482:AAH_lEWklKmguELcK3ZJ_LoEdbMrOYwmkWk"
  );
  const [chatId, setChatId] = useState(settings?.chatId || "5694188432");
  const [alert1Dist, setAlert1Dist] = useState(settings?.alert1Dist || 150);
  const [alert2Dist, setAlert2Dist] = useState(settings?.alert2Dist || 40);
  const [language, setLanguage] = useState(settings?.language || "id");
  const [selectedManeuver, setSelectedManeuver] = useState("right");
  const [testStatus, setTestStatus] = useState(null);
  const [testing, setTesting] = useState(false);

  const isDark = theme === "dark";
  const activePreset = MANEUVER_TEST_PRESETS[selectedManeuver] || MANEUVER_TEST_PRESETS.right;

  const handleTestVibration = async () => {
    if (!botToken || !chatId) {
      setTestStatus({ ok: false, msg: t("tokenChatRequired", language) });
      return;
    }

    setTesting(true);
    setTestStatus(null);

    const now = formatTime24h();

    // Dynamically send the currently selected maneuver sign!
    // Line 1: [150m]  ===>>  (Exactly 13 characters! 100% fits on 1 line, zero wrap)
    // Line 2: Jl. Raya Purwosari (18 characters)
    // Line 3: Tes Kanan: 18:58   (16 characters)
    const message = `[${activePreset.dist}]  ${activePreset.arrow}\n${activePreset.street}\n${activePreset.testDesc}: ${now}`;

    const result = await sendTelegramAlert(botToken, chatId, message);
    setTesting(false);

    if (result.success) {
      setTestStatus({
        ok: true,
        msg: `${t("testSuccess", language)} (${activePreset.label})`,
      });
    } else {
      setTestStatus({
        ok: false,
        msg: `${t("testFail", language)} ${result.error || "Check bot token"}`,
      });
    }
  };

  const handleSave = () => {
    const a1 = Math.max(30, Number(alert1Dist) || 150);
    const a2 = Math.min(a1 - 10, Math.max(15, Number(alert2Dist) || 40));
    onSaveSettings({
      botToken: (botToken || "").trim(),
      chatId: (chatId || "").trim(),
      alert1Dist: a1,
      alert2Dist: a2,
      language: language,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 pt-safe pb-safe overflow-y-auto">
      <div
        className={`w-full max-w-md rounded-2xl p-5 shadow-2xl space-y-4 border transition-colors max-h-[85dvh] overflow-y-auto ${
          isDark
            ? "bg-[#18181c] border-[#27272e] text-white"
            : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between pb-3 border-b ${
            isDark ? "border-[#27272e]" : "border-slate-200"
          }`}
        >
          <div className="flex items-center gap-2">
            <Settings className={`w-5 h-5 ${isDark ? "text-[#d2fc15]" : "text-slate-800"}`} />
            <h2 className="text-base font-bold">{t("settingsTitle", language)}</h2>
          </div>
          <button
            onClick={onClose}
            className={`p-1 rounded-xl transition ${
              isDark
                ? "text-zinc-400 hover:text-white hover:bg-[#222228]"
                : "text-slate-400 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="space-y-3.5 text-sm">
          {/* Language Selector */}
          <div>
            <label
              className={`block text-xs font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1.5 ${
                isDark ? "text-zinc-400" : "text-slate-600"
              }`}
            >
              <Globe className={`w-3.5 h-3.5 ${isDark ? "text-[#d2fc15]" : "text-slate-700"}`} />
              {t("languageLabel", language)}
            </label>
            <div
              className={`grid grid-cols-2 gap-2 p-1.5 rounded-xl border ${
                isDark
                  ? "bg-[#1f1f25] border-[#2c2c36]"
                  : "bg-slate-100 border-slate-200"
              }`}
            >
              <button
                type="button"
                onClick={() => setLanguage("id")}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 ${
                  language === "id"
                    ? isDark
                      ? "bg-[#d2fc15] text-[#0f0f12] shadow-sm font-black"
                      : "bg-[#0f0f12] text-white shadow-sm font-bold"
                    : isDark
                    ? "text-zinc-400 hover:text-white"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>🇮🇩</span>
                <span>Bahasa Indonesia</span>
              </button>
              <button
                type="button"
                onClick={() => setLanguage("en")}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 ${
                  language === "en"
                    ? isDark
                      ? "bg-[#d2fc15] text-[#0f0f12] shadow-sm font-black"
                      : "bg-[#0f0f12] text-white shadow-sm font-bold"
                    : isDark
                    ? "text-zinc-400 hover:text-white"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>🇬🇧</span>
                <span>English</span>
              </button>
            </div>
          </div>

          <div>
            <label
              className={`block text-xs font-bold uppercase tracking-wider mb-1 ${
                isDark ? "text-zinc-400" : "text-slate-600"
              }`}
            >
              {t("botTokenLabel", language)}
            </label>
            <input
              type="text"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="e.g.: 8863619482:AAH..."
              className={`w-full rounded-xl px-3 py-2 font-mono text-xs border transition ${
                isDark
                  ? "bg-[#1f1f25] border-[#2c2c36] text-white placeholder-zinc-500 focus:outline-none focus:border-[#d2fc15]"
                  : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-800 focus:bg-white"
              }`}
            />
          </div>

          <div>
            <label
              className={`block text-xs font-bold uppercase tracking-wider mb-1 ${
                isDark ? "text-zinc-400" : "text-slate-600"
              }`}
            >
              {t("chatIdLabel", language)}
            </label>
            <input
              type="text"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="e.g.: 5694188432"
              className={`w-full rounded-xl px-3 py-2 font-mono text-xs border transition ${
                isDark
                  ? "bg-[#1f1f25] border-[#2c2c36] text-white placeholder-zinc-500 focus:outline-none focus:border-[#d2fc15]"
                  : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-800 focus:bg-white"
              }`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label
                className={`block text-xs font-bold uppercase tracking-wider mb-1 ${
                  isDark ? "text-zinc-400" : "text-slate-600"
                }`}
              >
                {t("alert1Label", language)}
              </label>
              <input
                type="number"
                value={alert1Dist}
                onChange={(e) => setAlert1Dist(e.target.value)}
                min="50"
                max="500"
                className={`w-full rounded-xl px-3 py-2 font-bold border transition ${
                  isDark
                    ? "bg-[#1f1f25] border-[#2c2c36] text-white focus:outline-none focus:border-[#d2fc15]"
                    : "bg-slate-50 border-slate-200 text-slate-900 focus:outline-none focus:border-slate-800 focus:bg-white"
                }`}
              />
              <span className="text-[11px] text-zinc-400">
                {t("alert1Desc", language)}
              </span>
            </div>
            <div>
              <label
                className={`block text-xs font-bold uppercase tracking-wider mb-1 ${
                  isDark ? "text-zinc-400" : "text-slate-600"
                }`}
              >
                {t("alert2Label", language)}
              </label>
              <input
                type="number"
                value={alert2Dist}
                onChange={(e) => setAlert2Dist(e.target.value)}
                min="15"
                max="100"
                className={`w-full rounded-xl px-3 py-2 font-bold border transition ${
                  isDark
                    ? "bg-[#1f1f25] border-[#2c2c36] text-white focus:outline-none focus:border-[#d2fc15]"
                    : "bg-slate-50 border-slate-200 text-slate-900 focus:outline-none focus:border-slate-800 focus:bg-white"
                }`}
              />
              <span className="text-[11px] text-zinc-400">
                {t("alert2Desc", language)}
              </span>
            </div>
          </div>

          {/* Sized Smartwatch Preview matching user's round watch screen */}
          <div className="pt-2 border-t border-zinc-200 dark:border-[#27272e]">
            <SmartwatchPreview
              selectedManeuver={selectedManeuver}
              onSelectManeuver={setSelectedManeuver}
              language={language}
              isDark={isDark}
            />
          </div>

          {/* Test Vibration Button (Sends the active maneuver preset) */}
          <div className="pt-1">
            <button
              onClick={handleTestVibration}
              disabled={testing}
              className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 font-bold rounded-xl border transition active:scale-95 disabled:opacity-50 ${
                isDark
                  ? "bg-[#222228] hover:bg-[#2a2a32] border-[#2e2e38] text-zinc-200"
                  : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-800"
              }`}
            >
              <Bell className={`w-4 h-4 ${isDark ? "text-[#d2fc15]" : "text-slate-800"}`} />
              {testing
                ? t("testingVibration", language)
                : `${t("testVibrationBtn", language)} (${activePreset.label})`}
            </button>

            {testStatus && (
              <p
                className={`text-xs mt-2 text-center font-bold ${
                  testStatus.ok ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {testStatus.msg}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className={`pt-3 border-t flex justify-end gap-2 ${
            isDark ? "border-[#27272e]" : "border-slate-200"
          }`}
        >
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-xl transition font-medium text-sm ${
              isDark
                ? "text-zinc-400 hover:text-white"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {t("cancelBtn", language)}
          </button>
          <button
            onClick={handleSave}
            className={`px-5 py-2 rounded-xl text-sm font-bold shadow-sm transition active:scale-95 ${
              isDark
                ? "bg-[#d2fc15] hover:bg-[#c2eb0a] text-[#0f0f12]"
                : "bg-[#0f0f12] hover:bg-[#27272e] text-white"
            }`}
          >
            {t("saveSettingsBtn", language)}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SettingsModal({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  theme = "light",
}) {
  if (!isOpen) return null;
  return (
    <SettingsForm
      settings={settings}
      onClose={onClose}
      onSaveSettings={onSaveSettings}
      theme={theme}
    />
  );
}
