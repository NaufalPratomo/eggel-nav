import React, { useState } from "react";
import { Settings, X, Bell, Globe } from "lucide-react";
import { sendTelegramAlert } from "../utils/telegram";
import { t } from "../utils/i18n";

function SettingsForm({ settings, onClose, onSaveSettings }) {
  const [botToken, setBotToken] = useState(
    settings?.botToken || "8863619482:AAH_lEWklKmguELcK3ZJ_LoEdbMrOYwmkWk"
  );
  const [chatId, setChatId] = useState(settings?.chatId || "5694188432");
  const [alert1Dist, setAlert1Dist] = useState(settings?.alert1Dist || 150);
  const [alert2Dist, setAlert2Dist] = useState(settings?.alert2Dist || 40);
  const [language, setLanguage] = useState(settings?.language || "id");
  const [testStatus, setTestStatus] = useState(null);
  const [testing, setTesting] = useState(false);

  const handleTestVibration = async () => {
    if (!botToken || !chatId) {
      setTestStatus({ ok: false, msg: t("tokenChatRequired", language) });
      return;
    }

    setTesting(true);
    setTestStatus(null);

    const now = new Date().toLocaleTimeString(language === "en" ? "en-US" : "id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const isEn = language === "en";
    const message = isEn
      ? `[TEST] ⬅️ TURN LEFT (100m)\nMain Street Avenue\n(Watch Vibration Test: ${now})`
      : `[TEST] ⬅️ BELOK KIRI (100m)\nJl. Margonda Raya\n(Tes Getar Jam: ${now})`;

    const result = await sendTelegramAlert(botToken, chatId, message);
    setTesting(false);

    if (result.success) {
      setTestStatus({
        ok: true,
        msg: t("testSuccess", language),
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
    <div className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 text-white w-full max-w-md rounded-2xl p-5 shadow-xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold">{t("settingsTitle", language)}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="space-y-3.5 text-sm">
          {/* Language Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-indigo-400" />
              {t("languageLabel", language)}
            </label>
            <div className="grid grid-cols-2 gap-2 bg-slate-800/60 p-1.5 rounded-xl border border-slate-700/60">
              <button
                type="button"
                onClick={() => setLanguage("id")}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 ${
                  language === "id"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
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
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span>🇬🇧</span>
                <span>English</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              {t("botTokenLabel", language)}
            </label>
            <input
              type="text"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="e.g.: 8863619482:AAH..."
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              {t("chatIdLabel", language)}
            </label>
            <input
              type="text"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="e.g.: 5694188432"
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                {t("alert1Label", language)}
              </label>
              <input
                type="number"
                value={alert1Dist}
                onChange={(e) => setAlert1Dist(e.target.value)}
                min="50"
                max="500"
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-semibold"
              />
              <span className="text-[11px] text-slate-500">{t("alert1Desc", language)}</span>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                {t("alert2Label", language)}
              </label>
              <input
                type="number"
                value={alert2Dist}
                onChange={(e) => setAlert2Dist(e.target.value)}
                min="15"
                max="100"
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-semibold"
              />
              <span className="text-[11px] text-slate-500">{t("alert2Desc", language)}</span>
            </div>
          </div>

          {/* Test Vibration Button */}
          <div className="pt-2">
            <button
              onClick={handleTestVibration}
              disabled={testing}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 font-semibold rounded-xl transition active:scale-95 disabled:opacity-50"
            >
              <Bell className="w-4 h-4 text-indigo-400" />
              {testing ? t("testingVibration", language) : t("testVibrationBtn", language)}
            </button>

            {testStatus && (
              <p
                className={`text-xs mt-2 text-center font-medium ${
                  testStatus.ok ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {testStatus.msg}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-400 hover:text-white transition font-medium text-sm"
          >
            {t("cancelBtn", language)}
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-sm transition active:scale-95"
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
}) {
  if (!isOpen) return null;
  return (
    <SettingsForm
      settings={settings}
      onClose={onClose}
      onSaveSettings={onSaveSettings}
    />
  );
}
