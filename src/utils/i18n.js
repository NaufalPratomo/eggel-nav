// Internationalization (i18n) for Eggel Nav (Indonesian & English)

export const translations = {
  id: {
    // Header & GPS
    appName: "Eggel Nav",
    gpsReady: "GPS Terhubung",
    gpsLocating: "Mencari GPS...",
    gpsError: "GPS Error",
    gpsUnsupported: "Browser ini tidak mendukung Geolocation.",
    searchBtn: "Cari",
    lightMode: "Mode Terang",
    darkMode: "Mode Gelap",
    settingsTitle: "Pengaturan Smartwatch",

    // Route Preview Card
    routeTrip: "Rute Perjalanan",
    fromLabel: "Dari",
    myLocation: "Lokasi Saya Saat Ini",
    toLabel: "Tujuan",
    totalDistance: "Total Jarak",
    estimatedTime: "Estimasi Waktu",
    cancelBtn: "Batal",
    startNavBtn: "Mulai Navigasi",
    calculatingRoute: "Menghitung rute tercepat...",
    mapTapHint: "Ketuk di mana saja pada peta atau klik Cari",

    // HUD (Active Navigation)
    speed: "Kecepatan",
    remainingDistance: "Sisa Jarak",
    remainingTime: "Sisa Waktu",
    estimatedArrival: "Estimasi Tiba",
    speedUnit: "km/h",
    totalLabel: "Jarak Total",
    timeZone: "WIB",
    audioActive: "Audio Keep-Alive Aktif",
    endNavBtn: "Akhiri",
    alertSentBadge: "Notif terkirim ke Eggel:",

    // Search Modal
    searchPlaceholder: "Cari nama tempat, jalan, atau kota...",
    noPlacesFound: "Tidak ada tempat ditemukan. Coba ketik lebih spesifik.",
    searchHint: "Ketik tujuan Anda di atas atau langsung ketuk peta untuk memilih titik tujuan.",

    // Settings Modal
    botTokenLabel: "Telegram Bot Token",
    chatIdLabel: "Telegram Chat ID",
    alert1Label: "Peringatan 1 (Meter)",
    alert1Desc: "Peringatan awal sebelum belokan",
    alert2Label: "Peringatan 2 (Meter)",
    alert2Desc: "Peringatan eksekusi tepat saat belok",
    languageLabel: "Bahasa / Language",
    testVibrationBtn: "Tes Getar Jam Sekarang",
    testingVibration: "Mengirim Tes...",
    saveSettingsBtn: "Simpan Pengaturan",
    testSuccess: "Berhasil dikirim! Cek jam tangan Eggel Anda.",
    testFail: "Gagal:",
    tokenChatRequired: "Token & Chat ID wajib diisi",

    // General & Alerts
    recenterMap: "Pusatkan Lokasi Saya",
    confirmChangeDest: "Ganti tujuan dan akhiri navigasi saat ini?",
    selectedPoint: "Titik Pilihan",
    navStarted: "Navigasi Dimulai",
    navEnded: "Navigasi Diakhiri",
    arrived: "Tiba di Tujuan",
    rerouted: "Rute Dihitung Ulang",
  },
  en: {
    // Header & GPS
    appName: "Eggel Nav",
    gpsReady: "GPS Connected",
    gpsLocating: "Locating GPS...",
    gpsError: "GPS Error",
    gpsUnsupported: "Geolocation is not supported by your browser.",
    searchBtn: "Search",
    lightMode: "Light Mode",
    darkMode: "Dark Mode",
    settingsTitle: "Smartwatch Settings",

    // Route Preview Card
    routeTrip: "Route Summary",
    fromLabel: "From",
    myLocation: "My Current Location",
    toLabel: "To",
    totalDistance: "Total Distance",
    estimatedTime: "Estimated Time",
    cancelBtn: "Cancel",
    startNavBtn: "Start Navigation",
    calculatingRoute: "Calculating fastest route...",
    mapTapHint: "Tap anywhere on the map or click Search",

    // HUD (Active Navigation)
    speed: "Speed",
    remainingDistance: "Remaining",
    remainingTime: "Time Left",
    estimatedArrival: "Est. Arrival",
    speedUnit: "km/h",
    totalLabel: "Total Dist",
    timeZone: "ETA",
    audioActive: "Audio Keep-Alive Active",
    endNavBtn: "End",
    alertSentBadge: "Alert sent to Eggel:",

    // Search Modal
    searchPlaceholder: "Search place, street, or city...",
    noPlacesFound: "No places found. Try a more specific query.",
    searchHint: "Type your destination above or tap directly on the map.",

    // Settings Modal
    botTokenLabel: "Telegram Bot Token",
    chatIdLabel: "Telegram Chat ID",
    alert1Label: "Alert 1 (Meters)",
    alert1Desc: "Advance turn warning",
    alert2Label: "Alert 2 (Meters)",
    alert2Desc: "Imminent turn execution warning",
    languageLabel: "Bahasa / Language",
    testVibrationBtn: "Test Watch Vibration Now",
    testingVibration: "Sending Test...",
    saveSettingsBtn: "Save Settings",
    testSuccess: "Sent successfully! Check your Eggel smartwatch.",
    testFail: "Failed:",
    tokenChatRequired: "Token & Chat ID are required",

    // General & Alerts
    recenterMap: "Center My Location",
    confirmChangeDest: "Change destination and end current navigation?",
    selectedPoint: "Selected Point",
    navStarted: "Navigation Started",
    navEnded: "Navigation Ended",
    arrived: "Arrived at Destination",
    rerouted: "Route Recalculated",
  },
};

export const t = (key, lang = "id") => {
  const selected = translations[lang] || translations.id;
  return selected[key] || translations.id[key] || key;
};
