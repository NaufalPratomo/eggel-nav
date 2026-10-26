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
 * Universal high-contrast direction arrows (Basic Multilingual Plane geometric symbols).
 * Avoids Unicode Emoji icons (no missing tofu glyphs [?] on RTOS smartwatches)
 * and eliminates word clutter ("Turn Right" / "Belok Kanan") for instant glance recognition.
 */
export const getManeuverArrowText = (modifier, maneuverType) => {
  const mod = (modifier || "").toLowerCase();
  const type = (maneuverType || "").toLowerCase();

  // U-Turn
  if (mod.includes("uturn") || mod.includes("u-turn") || type.includes("uturn")) {
    return "◄━━━┓";
  }
  // Sharp Left
  if (mod.includes("sharp left")) {
    return "◄◄──┘";
  }
  // Slight Left
  if (mod.includes("slight left")) {
    return "↖↖━━━";
  }
  // Turn Left
  if (mod.includes("left")) {
    return "◄◄━━━━";
  }
  // Sharp Right
  if (mod.includes("sharp right")) {
    return "└──►►";
  }
  // Slight Right
  if (mod.includes("slight right")) {
    return "━━━↗↗";
  }
  // Turn Right
  if (mod.includes("right")) {
    return "━━━━►►";
  }
  // Roundabout / Rotary
  if (type.includes("roundabout") || type.includes("rotary")) {
    return "↺ ↺ ↺";
  }
  // Arrived / Destination
  if (type.includes("arrive") || type.includes("destination")) {
    return "★ ★ ★";
  }
  // Fork / Ramp
  if (type.includes("fork")) {
    return mod.includes("left") ? "◄◄━━━━" : "━━━━►►";
  }
  // Straight
  return "▲ ▲ ▲";
};

/**
 * Format instructions specifically tailored for glanceable smartwatch displays:
 * [120m]  ━━━━►►
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
  const arrow = getManeuverArrowText(modifier, maneuverType);

  const distText =
    distanceMeters < 1000
      ? `${Math.round(distanceMeters)}m`
      : `${(distanceMeters / 1000).toFixed(1)}km`;

  const defaultStreet = isEn ? "Next Street" : "Jalan Berikutnya";
  const cleanStreet =
    streetName && streetName.trim().length > 0 ? streetName.trim() : defaultStreet;

  const urgentMark = isFinal ? " ‼" : "";

  return `[${distText}]  ${arrow}${urgentMark}\n${cleanStreet}`;
};
