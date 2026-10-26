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
 * Compact 5-character ASCII Navigation Arrows tailored for round smartwatches.
 *
 * Screen width on circular watches is ~16-18 characters at the top band.
 * Using a 5-char arrow with [150m] totals 13 characters, leaving 4+ chars
 * of safety margin so the arrow NEVER breaks across lines (e.g. no ugly "==" wrap).
 */
export const getManeuverArrowText = (modifier, maneuverType) => {
  const mod = (modifier || "").toLowerCase();
  const type = (maneuverType || "").toLowerCase();

  // U-Turn (Loop stem and left return arrow: 5 chars)
  if (mod.includes("uturn") || mod.includes("u-turn") || type.includes("uturn")) {
    return "<<=||";
  }
  // Sharp Left (5 chars)
  if (mod.includes("sharp left")) {
    return "<<==|";
  }
  // Slight Left (5 chars)
  if (mod.includes("slight left")) {
    return "<\\\\==";
  }
  // Turn Left (5 chars)
  if (mod.includes("left")) {
    return "<<===";
  }
  // Sharp Right (5 chars)
  if (mod.includes("sharp right")) {
    return "|==>>";
  }
  // Slight Right (5 chars)
  if (mod.includes("slight right")) {
    return "==//>";
  }
  // Turn Right (5 chars)
  if (mod.includes("right")) {
    return "===>>";
  }
  // Roundabout / Rotary (5 chars)
  if (type.includes("roundabout") || type.includes("rotary")) {
    return "((O))";
  }
  // Arrived / Destination
  if (type.includes("arrive") || type.includes("destination")) {
    return "*FINISH*";
  }
  // Fork / Ramp
  if (type.includes("fork")) {
    return mod.includes("left") ? "<<===" : "===>>";
  }
  // Straight ahead (5 chars)
  return "^^^^^";
};

/**
 * Format instructions specifically tailored for round smartwatch screens (e.g. Eggel Tempo):
 * - Line 1: [150m]  ===>>  (Exactly 13 characters, NEVER wraps on circular screens)
 * - Line 2: Jl. Raya Purwosari (Max 28 chars, wraps at most to line 3)
 * - Total lines: 2 to 3 lines max (safely stays clear of bottom trash button)
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
  if (cleanStreet.length > 28) {
    cleanStreet = cleanStreet.slice(0, 25).trim() + "...";
  }

  // Urgent marker when imminent (<= 40m)
  const urgentMark = isFinal ? " !" : "";

  return `[${distText}]  ${arrow}${urgentMark}\n${cleanStreet}`;
};
