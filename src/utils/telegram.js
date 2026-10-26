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
export const formatManeuverMessage = (
  distanceMeters,
  maneuverType,
  modifier,
  streetName,
  isFinal = false,
  lang = "id"
) => {
  const isEn = lang === "en";
  let icon = "⬆️";
  let actionText = isEn ? "GO STRAIGHT" : "LURUS";

  const mod = (modifier || "").toLowerCase();
  const type = (maneuverType || "").toLowerCase();

  // 1. Check U-turn first (handles 'uturn' and 'u-turn')
  if (mod.includes("uturn") || mod.includes("u-turn") || type.includes("uturn")) {
    icon = "🔄";
    actionText = isEn ? "U-TURN" : "PUTAR BALIK";
  } else if (mod.includes("sharp left")) {
    icon = "⬅️";
    actionText = isEn ? "SHARP LEFT" : "BELOK KIRI TAJAM";
  } else if (mod.includes("slight left")) {
    icon = "↖️";
    actionText = isEn ? "SLIGHT LEFT" : "SERONG KIRI";
  } else if (mod.includes("left")) {
    icon = "⬅️";
    actionText = isEn ? "TURN LEFT" : "BELOK KIRI";
  } else if (mod.includes("sharp right")) {
    icon = "➡️";
    actionText = isEn ? "SHARP RIGHT" : "BELOK KANAN TAJAM";
  } else if (mod.includes("slight right")) {
    icon = "↗️";
    actionText = isEn ? "SLIGHT RIGHT" : "SERONG KANAN";
  } else if (mod.includes("right")) {
    icon = "➡️";
    actionText = isEn ? "TURN RIGHT" : "BELOK KANAN";
  } else if (type.includes("roundabout") || type.includes("rotary")) {
    icon = "🔄";
    actionText = isEn ? "ROUNDABOUT" : "BUNDARAN";
  } else if (type.includes("arrive") || type.includes("destination")) {
    icon = "🏁";
    actionText = isEn ? "ARRIVED AT DESTINATION" : "TIBA DI TUJUAN";
  } else if (type.includes("fork")) {
    icon = mod.includes("left") ? "↖️" : "↗️";
    if (isEn) {
      actionText = mod.includes("left") ? "KEEP LEFT" : "KEEP RIGHT";
    } else {
      actionText = mod.includes("left") ? "AMBIL JALUR KIRI" : "AMBIL JALUR KANAN";
    }
  }

  const distText =
    distanceMeters < 1000
      ? `${Math.round(distanceMeters)}m`
      : `${(distanceMeters / 1000).toFixed(1)}km`;
  const defaultStreet = isEn ? "Next Street" : "Jalan Berikutnya";
  const cleanStreet =
    streetName && streetName.trim().length > 0 ? streetName.trim() : defaultStreet;

  if (isFinal) {
    const finalSuffix = isEn ? " NOW" : " SEKARANG";
    return `[${distText}] ${icon} ${actionText}${finalSuffix}\n${cleanStreet}`;
  }

  return `[${distText}] ${icon} ${actionText}\n${cleanStreet}`;
};
