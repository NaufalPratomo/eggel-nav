import React, { useState } from "react";
import { Settings, X, Bell } from "lucide-react";
import { sendTelegramAlert } from "../utils/telegram";

function SettingsForm({ settings, onClose, onSaveSettings }) {
  const [botToken, setBotToken] = useState(
    settings?.botToken || "8863619482:AAH_lEWklKmguELcK3ZJ_LoEdbMrOYwmkWk"
  );
  const [chatId, setChatId] = useState(settings?.chatId || "5694188432");
  const [alert1Dist, setAlert1Dist] = useState(settings?.alert1Dist || 150);
  const [alert2Dist, setAlert2Dist] = useState(settings?.alert2Dist || 40);
  const [testStatus, setTestStatus] = useState(null);
  const [testing, setTesting] = useState(false);

  const handleTestVibration = async () => {
    if (!botToken || !chatId) {
      setTestStatus({ ok: false, msg: "Token & Chat ID wajib diisi" });
      return;
    }

    setTesting(true);
    setTestStatus(null);

    const now = new Date().toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const message = `[TEST] ⬅️ BELOK KIRI (100m)\nJl. Margonda Raya\n(Tes Getar Jam: ${now})`;

    const result = await sendTelegramAlert(botToken, chatId, message);
    setTesting(false);

    if (result.success) {
      setTestStatus({
        ok: true,
        msg: "Berhasil dikirim! Cek jam tangan Eggel Anda.",
      });
    } else {
      setTestStatus({
        ok: false,
        msg: `Gagal: ${result.error || "Periksa token bot"}`,
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
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 text-white w-full max-w-md rounded-2xl p-5 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-bold">Pengaturan Smartwatch</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="space-y-3.5 text-sm">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Telegram Bot Token
            </label>
            <input
              type="text"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="Contoh: 8863619482:AAH..."
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Telegram Chat ID
            </label>
            <input
              type="text"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="Contoh: 5694188432"
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Peringatan 1 (Meter)
              </label>
              <input
                type="number"
                value={alert1Dist}
                onChange={(e) => setAlert1Dist(e.target.value)}
                min="50"
                max="500"
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500 font-semibold"
              />
              <span className="text-[11px] text-slate-500">Peringatan awal</span>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Peringatan 2 (Meter)
              </label>
              <input
                type="number"
                value={alert2Dist}
                onChange={(e) => setAlert2Dist(e.target.value)}
                min="15"
                max="100"
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500 font-semibold"
              />
              <span className="text-[11px] text-slate-500">Tepat saat belok</span>
            </div>
          </div>

          {/* Test Vibration Button */}
          <div className="pt-2">
            <button
              onClick={handleTestVibration}
              disabled={testing}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-blue-400 font-semibold rounded-xl transition active:scale-95 disabled:opacity-50"
            >
              <Bell className="w-4 h-4" />
              {testing ? "Mengirim Tes..." : "Tes Getar Jam Sekarang"}
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
            Batal
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-md transition active:scale-95"
          >
            Simpan Pengaturan
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
