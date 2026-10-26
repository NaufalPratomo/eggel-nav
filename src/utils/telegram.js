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
 * 100% RTOS Smartwatch-Compatible ASCII Navigation Arrows.
 *
 * WHY THIS IS CRUCIAL:
 * RTOS smartwatches (Eggel Tempo series, Xiaomi Band, Amazfit, Da Fit, GloryFit, etc.)
 * use a minimal bitmap font ROM limited strictly to standard 7-bit ASCII (0x20 - 0x7E).
 * Multi-byte Unicode characters (Box Drawings U+2500, Geometric Shapes U+25A0, or Emojis)
 * are NOT in the watch's font table and are silently skipped/dropped by the watch LCD driver.
 *
 * Using high-contrast ASCII symbols guarantees the arrow ALWAYS appears on the watch screen,
 * fits the round display geometry, and eliminates word clutter.
 */
export const getManeuverArrowText = (modifier, maneuverType) => {
  const mod = (modifier || "").toLowerCase();
  const type = (maneuverType || "").toLowerCase();

  // U-Turn (Loop stem and leftward return arrow)
  if (mod.includes("uturn") || mod.includes("u-turn") || type.includes("uturn")) {
    return "<<====||";
  }
  // Sharp Left
  if (mod.includes("sharp left")) {
    return "<<====|";
  }
  // Slight Left (Angled diagonal return)
  if (mod.includes("slight left")) {
    return "<<\\\\====";
  }
  // Turn Left
  if (mod.includes("left")) {
    return "<<======";
  }
  // Sharp Right
  if (mod.includes("sharp right")) {
    return "|====>>";
  }
  // Slight Right (Angled diagonal forward)
  if (mod.includes("slight right")) {
    return "====//>>";
  }
  // Turn Right
  if (mod.includes("right")) {
    return "======>>";
  }
  // Roundabout / Rotary
  if (type.includes("roundabout") || type.includes("rotary")) {
    return "(( O ))>>";
  }
  // Arrived / Destination
  if (type.includes("arrive") || type.includes("destination")) {
    return "* FINISH *";
  }
  // Fork / Ramp
  if (type.includes("fork")) {
    return mod.includes("left") ? "<<======" : "======>>";
  }
  // Straight ahead
  return "^^^^^^^^";
};

/**
 * Format instructions specifically tailored for round smartwatch screens (e.g. Eggel Tempo):
 * - Max 18-20 characters per line to avoid circular screen edge clipping.
 * - 2-3 lines maximum so text stays clear above the bottom trash/delete button.
 * - Bold ASCII arrows that are 100% visible on every RTOS watch.
 *
 * Example output:
 * [150m]  ======>>
 * Jl. Raya Purwosari
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
  let cleanStreet =
    streetName && streetName.trim().length > 0 ? streetName.trim() : defaultStreet;

  // Trim long street names to fit round screen without overflowing into > 2 lines
  if (cleanStreet.length > 34) {
    cleanStreet = cleanStreet.slice(0, 31).trim() + "...";
  }

  // Urgent marker when imminent (<= 40m)
  const urgentMark = isFinal ? " !!" : "";

  return `[${distText}]  ${arrow}${urgentMark}\n${cleanStreet}`;
};
