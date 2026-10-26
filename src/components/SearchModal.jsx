import React, { useState, useEffect } from "react";
import { Search, MapPin, X, Loader2 } from "lucide-react";
import { searchPlaces } from "../utils/osrm";
import { t } from "../utils/i18n";

export default function SearchModal({
  isOpen,
  onClose,
  onSelectDestination,
  lang = "id",
  theme = "light",
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const isDark = theme === "dark";

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    const data = await searchPlaces(query);
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
            ? "bg-slate-900 border-slate-800 text-white"
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
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder", lang)}
              className={`w-full rounded-xl pl-9 pr-3 py-2.5 text-sm border transition ${
                isDark
                  ? "bg-slate-800 border-slate-700 text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                  : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white"
              }`}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm transition shrink-0 active:scale-95 disabled:opacity-50 shadow-sm"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t("searchBtn", lang)}
          </button>
          <button
            type="button"
            onClick={onClose}
            className={`p-2 rounded-xl transition ${
              isDark
                ? "text-slate-400 hover:text-white hover:bg-slate-800"
                : "text-slate-400 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </form>

        {/* Results List */}
        <div
          className={`max-h-60 overflow-y-auto space-y-1 divide-y ${
            isDark ? "divide-slate-800/60" : "divide-slate-100"
          }`}
        >
          {results.length > 0 ? (
            results.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSelect(item)}
                className={`w-full text-left p-2.5 rounded-xl transition flex items-start gap-3 group ${
                  isDark ? "hover:bg-slate-800/70" : "hover:bg-slate-50"
                }`}
              >
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition mt-0.5">
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
                      isDark ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    {item.description}
                  </p>
                </div>
              </button>
            ))
          ) : query && !loading ? (
            <p
              className={`text-center text-xs py-6 ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              {t("noPlacesFound", lang)}
            </p>
          ) : (
            <div
              className={`text-center py-6 text-xs ${
                isDark ? "text-slate-400" : "text-slate-500"
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
