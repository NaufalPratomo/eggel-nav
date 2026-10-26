import React, { useState, useEffect } from "react";
import { Search, MapPin, X, Loader2 } from "lucide-react";
import { searchPlaces } from "../utils/osrm";
import { t } from "../utils/i18n";

export default function SearchModal({
  isOpen,
  onClose,
  onSelectDestination,
  userPosition = null,
  lang = "id",
  theme = "light",
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const isDark = theme === "dark";

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleQueryChange = (val) => {
    setQuery(val);
    if (val.trim().length >= 2) {
      setLoading(true);
    } else {
      setResults([]);
      setLoading(false);
      setHasSearched(false);
    }
  };

  // Real-time live auto-search as user types each word
  useEffect(() => {
    if (!isOpen) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) return;

    const timer = setTimeout(async () => {
      setHasSearched(true);
      const data = await searchPlaces(trimmed, userPosition);
      setResults(data);
      setLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [query, isOpen, userPosition]);

  if (!isOpen) return null;

  const handleSearch = async (e) => {
    e?.preventDefault?.();
    if (!query.trim()) return;

    setLoading(true);
    setHasSearched(true);
    const data = await searchPlaces(query, userPosition);
    setResults(data);
    setLoading(false);
  };

  const handleSelect = (place) => {
    onSelectDestination({
      name: place.name,
      lat: place.lat,
      lng: place.lng,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-sm flex items-start justify-center p-4 pt-12">
      <div
        className={`w-full max-w-md rounded-2xl p-4 shadow-2xl space-y-4 border transition-colors ${
          isDark
            ? "bg-[#18181c] border-[#27272e] text-white"
            : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        {/* Search Input */}
        <form onSubmit={handleSearch} className="relative flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder={t("searchPlaceholder", lang)}
              className={`w-full rounded-xl pl-9 pr-8 py-2.5 text-sm border transition ${
                isDark
                  ? "bg-[#1f1f25] border-[#2c2c36] text-white placeholder-zinc-500 focus:outline-none focus:border-[#d2fc15]"
                  : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-800 focus:bg-white"
              }`}
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setResults([]);
                  setHasSearched(false);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={loading}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition shrink-0 active:scale-95 disabled:opacity-50 shadow-sm ${
              isDark
                ? "bg-[#d2fc15] hover:bg-[#c2eb0a] text-[#0f0f12]"
                : "bg-[#0f0f12] hover:bg-[#27272e] text-white"
            }`}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t("searchBtn", lang)}
          </button>
          <button
            type="button"
            onClick={onClose}
            className={`p-2 rounded-xl transition ${
              isDark
                ? "text-zinc-400 hover:text-white hover:bg-[#222228]"
                : "text-slate-400 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </form>

        {/* Results List */}
        <div
          className={`max-h-64 overflow-y-auto space-y-1 divide-y ${
            isDark ? "divide-[#27272e]" : "divide-slate-100"
          }`}
        >
          {results.length > 0 ? (
            results.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSelect(item)}
                className={`w-full text-left p-2.5 rounded-xl transition flex items-start gap-3 group ${
                  isDark ? "hover:bg-[#222228]" : "hover:bg-slate-50"
                }`}
              >
                <div className={`p-2 rounded-lg transition mt-0.5 ${
                  isDark
                    ? "bg-[#222228] text-[#38bdf8] group-hover:bg-[#38bdf8] group-hover:text-[#0f0f12]"
                    : "bg-sky-50 text-sky-600 group-hover:bg-sky-600 group-hover:text-white"
                }`}>
                  <MapPin className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-semibold truncate ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    {item.name}
                  </p>
                  <p
                    className={`text-xs truncate mt-0.5 ${
                      isDark ? "text-zinc-400" : "text-slate-500"
                    }`}
                  >
                    {item.description}
                  </p>
                </div>
              </button>
            ))
          ) : hasSearched && !loading ? (
            <div className="py-5 px-3 text-center space-y-2">
              <p
                className={`text-xs font-semibold ${
                  isDark ? "text-zinc-300" : "text-slate-700"
                }`}
              >
                {t("noPlacesFound", lang)}
              </p>
              <p
                className={`text-[11px] leading-relaxed ${
                  isDark ? "text-zinc-400" : "text-slate-500"
                }`}
              >
                {lang === "en"
                  ? "Tip: Private housing complexes may not yet be tagged in OpenStreetMap. Try searching by main road, subdistrict name, or tap directly on the map."
                  : "Tips: Kompleks perumahan baru mungkin belum ditandai di OpenStreetMap. Coba cari nama jalan utama, kelurahan/kecamatan terdekat, atau langsung ketuk titik di peta."}
              </p>
            </div>
          ) : (
            <div
              className={`text-center py-6 text-xs ${
                isDark ? "text-zinc-400" : "text-slate-500"
              }`}
            >
              <p>{t("searchHint", lang)}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
