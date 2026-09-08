import { useI18n } from "@/src/lib/i18n";
import { Eye, EyeOff, Minus, Plus, RotateCcw } from "lucide-react";
import { usePreviewSettings } from "../hooks/usePreviewSettings";

export const ChordProPreviewSettings: React.FC<{
  settings: ReturnType<typeof usePreviewSettings>["settings"];
  updateSetting: ReturnType<typeof usePreviewSettings>["updateSetting"];
  resetSettings: ReturnType<typeof usePreviewSettings>["resetSettings"];
}> = ({ settings, updateSetting, resetSettings }) => {
  const { t } = useI18n();
  const { showChords, transposeVal, fontSize, instrument, showDiagrams } =
    settings;

  const handleTranspose = (delta: number) => {
    updateSetting("transposeVal", transposeVal + delta);
  };

  return (
    <div className="absolute right-2 top-11 w-64 bg-m3-card dark:bg-m3-dark-card border border-m3-border dark:border-m3-dark-border rounded-xl shadow-2xl z-40 p-4 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
      <div className="border-b border-m3-border/30 pb-2 flex items-center justify-between">
        <span className="text-xs font-bold text-m3-text uppercase tracking-wider">
          {t("misc.chordproSettings.title")}
        </span>
        <button
          onClick={resetSettings}
          className="text-m3-secondary hover:text-m3-primary transition-colors cursor-pointer"
          title={t("misc.chordproSettings.resetTitle")}
        >
          <RotateCcw className="w-3 h-3" />
        </button>
      </div>

      <div className="space-y-2">
        <span className="text-[10px] font-bold text-m3-secondary uppercase">
          {t("misc.chordproSettings.display")}
        </span>
        <div className="flex bg-m3-sidebar p-0.5 rounded-lg border border-m3-border/30">
          <button
            onClick={() => updateSetting("showChords", false)}
            className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all flex items-center justify-center gap-1 cursor-pointer ${!showChords ? "bg-m3-primary text-white" : "text-m3-secondary hover:text-m3-text"}`}
          >
            <EyeOff className="w-3 h-3" /> {t("misc.chordproSettings.lyrics")}
          </button>
          <button
            onClick={() => updateSetting("showChords", true)}
            className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all flex items-center justify-center gap-1 cursor-pointer ${showChords ? "bg-m3-primary text-white" : "text-m3-secondary hover:text-m3-text"}`}
          >
            <Eye className="w-3 h-3" /> {t("misc.chordproSettings.chords")}
          </button>
        </div>
      </div>

      {showChords && (
        <>
          <div className="space-y-2 border-t border-m3-border/30 pt-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-m3-secondary uppercase">
                {t("misc.chordproSettings.transposition")}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 bg-m3-primary/10 text-m3-primary rounded font-mono">
                {transposeVal > 0 ? `+${transposeVal}` : transposeVal}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1 bg-m3-sidebar p-0.5 rounded-lg border border-m3-border/30">
              <button
                onClick={() => handleTranspose(-1)}
                className="py-1 flex justify-center items-center text-m3-text hover:bg-m3-hover rounded-md cursor-pointer"
              >
                <Minus className="w-3 h-3" />
              </button>
              <button
                onClick={() => updateSetting("transposeVal", 0)}
                className={`py-1 text-[10px] font-bold rounded-md cursor-pointer ${transposeVal === 0 ? "bg-m3-primary text-white" : "text-m3-secondary hover:bg-m3-hover"}`}
              >
                {t("misc.chordproSettings.original")}
              </button>
              <button
                onClick={() => handleTranspose(1)}
                className="py-1 flex justify-center items-center text-m3-text hover:bg-m3-hover rounded-md cursor-pointer"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="space-y-3 border-t border-m3-border/30 pt-3">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-m3-secondary uppercase">
                {t("misc.chordproSettings.diagrams")}
              </span>
              <div className="flex bg-m3-sidebar p-0.5 rounded-lg w-24 border border-m3-border/30">
                <button
                  onClick={() => updateSetting("showDiagrams", false)}
                  className={`flex-1 py-1 text-[9px] font-bold rounded-md cursor-pointer ${!showDiagrams ? "bg-m3-primary text-white" : "text-m3-secondary"}`}
                >
                  {t("misc.chordproSettings.off")}
                </button>
                <button
                  onClick={() => updateSetting("showDiagrams", true)}
                  className={`flex-1 py-1 text-[9px] font-bold rounded-md cursor-pointer ${showDiagrams ? "bg-m3-primary text-white" : "text-m3-secondary"}`}
                >
                  {t("misc.chordproSettings.on")}
                </button>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-m3-secondary uppercase">
                {t("misc.chordproSettings.instrument")}
              </span>
              <div className="flex bg-m3-sidebar p-0.5 rounded-lg w-32 border border-m3-border/30">
                <button
                  onClick={() => updateSetting("instrument", "guitar")}
                  className={`flex-1 py-1 text-[9px] font-bold rounded-md cursor-pointer ${instrument === "guitar" ? "bg-m3-primary text-white" : "text-m3-secondary"}`}
                >
                  {t("misc.chordproSettings.guitar")}
                </button>
                <button
                  onClick={() => updateSetting("instrument", "piano")}
                  className={`flex-1 py-1 text-[9px] font-bold rounded-md cursor-pointer ${instrument === "piano" ? "bg-m3-primary text-white" : "text-m3-secondary"}`}
                >
                  {t("misc.chordproSettings.piano")}
                </button>
                <button
                  onClick={() => updateSetting("instrument", "ukulele")}
                  className={`flex-1 py-1 text-[9px] font-bold rounded-md cursor-pointer ${instrument === "ukulele" ? "bg-m3-primary text-white" : "text-m3-secondary"}`}
                >
                  Ukulele
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="flex items-center justify-between border-t border-m3-border/30 pt-3">
        <span className="text-[10px] font-bold text-m3-secondary uppercase">
          {t("misc.chordproSettings.size")}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() =>
              updateSetting("fontSize", Math.max(10, fontSize - 1))
            }
            className="w-6 h-6 rounded-md bg-m3-sidebar hover:bg-m3-hover flex justify-center items-center border border-m3-border/20 cursor-pointer"
          >
            <Minus className="w-3 h-3 text-m3-secondary" />
          </button>
          <span className="text-[10px] font-mono font-bold min-w-5 text-center text-m3-text">
            {fontSize}
          </span>
          <button
            onClick={() =>
              updateSetting("fontSize", Math.min(28, fontSize + 1))
            }
            className="w-6 h-6 rounded-md bg-m3-sidebar hover:bg-m3-hover flex justify-center items-center border border-m3-border/20 cursor-pointer"
          >
            <Plus className="w-3 h-3 text-m3-secondary" />
          </button>
        </div>
      </div>
    </div>
  );
};
