// Telegram Bot API helper for Eggel Smartwatch Notifications

export const sendTelegramAlert = async (token, chatId, text) => {
  if (!token || !chatId) {
    console.warn("Telegram token or chatId is missing!");
    return { success: false, error: "Token or Chat ID not configured" };
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        disable_notification: false,
      }),
      signal: AbortSignal.timeout(6000),
    });

    const data = await response.json();
    return { success: data.ok, data };
  } catch (error) {
    console.error("Failed to send Telegram alert:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Format instructions specifically tailored for small round smartwatch screens:
 * [120m] ⬅️ BELOK KIRI
 * Jl. Margonda Raya
 */
export const formatManeuverMessage = (distanceMeters, maneuverType, modifier, streetName, isFinal = false) => {
  let icon = "⬆️";
  let actionText = "LURUS";

  const mod = (modifier || "").toLowerCase();
  const type = (maneuverType || "").toLowerCase();

  // 1. Check U-turn first (handles 'uturn' and 'u-turn')
  if (mod.includes("uturn") || mod.includes("u-turn") || type.includes("uturn")) {
    icon = "🔄";
    actionText = "PUTAR BALIK";
  } else if (mod.includes("sharp left")) {
    icon = "⬅️";
    actionText = "BELOK KIRI TAJAM";
  } else if (mod.includes("slight left")) {
    icon = "↖️";
    actionText = "SERONG KIRI";
  } else if (mod.includes("left")) {
    icon = "⬅️";
    actionText = "BELOK KIRI";
  } else if (mod.includes("sharp right")) {
    icon = "➡️";
    actionText = "BELOK KANAN TAJAM";
  } else if (mod.includes("slight right")) {
    icon = "↗️";
    actionText = "SERONG KANAN";
  } else if (mod.includes("right")) {
    icon = "➡️";
    actionText = "BELOK KANAN";
  } else if (type.includes("roundabout") || type.includes("rotary")) {
    icon = "🔄";
    actionText = "BUNDARAN";
  } else if (type.includes("arrive") || type.includes("destination")) {
    icon = "🏁";
    actionText = "TIBA DI TUJUAN";
  } else if (type.includes("fork")) {
    icon = mod.includes("left") ? "↖️" : "↗️";
    actionText = mod.includes("left") ? "AMBIL JALUR KIRI" : "AMBIL JALUR KANAN";
  }

  const distText = distanceMeters < 1000 ? `${Math.round(distanceMeters)}m` : `${(distanceMeters / 1000).toFixed(1)}km`;
  const cleanStreet = streetName && streetName.trim().length > 0 ? streetName.trim() : "Jalan Berikutnya";

  if (isFinal) {
    return `[${distText}] ${icon} ${actionText} SEKARANG\n${cleanStreet}`;
  }

  return `[${distText}] ${icon} ${actionText}\n${cleanStreet}`;
};
