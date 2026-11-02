/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useI18n } from "@/src/lib/i18n";
import type { LineAST } from "@hosanna/chordpro";
import React from "react";
import { SongBlock } from "../songBlocks";

interface PrintSongBodyProps {
  blocks: SongBlock[];
  showChords: boolean;
  showLabels: boolean;
  twoColumns: boolean;
}

const formatRepeat = (repeat?: string) =>
  repeat ? `×${repeat.replace(/x$/i, "").trim()}` : null;

const PrintLine: React.FC<{ line: LineAST; showChords: boolean }> = ({
  line,
  showChords,
}) => {
  switch (line.type) {
    case "empty":
      return <div className="hp-gap" />;
    case "comment":
    case "comment_italic":
      return <div className="hp-comment">{line.text}</div>;
    case "comment_box":
      return (
        <div>
          <span className={`hp-callout hp-callout--${line.style ?? "info"}`}>
            {line.text}
          </span>
        </div>
      );
    case "tab":
      return <pre className="hp-tab">{line.text}</pre>;
    case "chord-section": {
      const measures = line.measures ?? [];
      if (!measures.some((m) => m.chords.length)) {
        return (
          <div className="hp-grid-line">
            {(line.segments ?? []).map((s) => s.text).join("")}
          </div>
        );
      }
      return (
        <div className="hp-grid-line">
          {line.startBarline && (
            <span className="hp-bar">{line.startBarline}</span>
          )}
          {measures.map((m, i) => (
            <React.Fragment key={i}>
              <span className="hp-measure">
                {m.chords.map((c) => c.chord).join(" ")}
              </span>
              {m.endBarline && <span className="hp-bar">{m.endBarline}</span>}
            </React.Fragment>
          ))}
        </div>
      );
    }
    default: {
      const segments = line.segments ?? [];
      const withChords = showChords && segments.some((s) => s.chord);
      if (!withChords) {
        return (
          <div className="hp-line">{segments.map((s) => s.text).join("")}</div>
        );
      }
      return (
        <div className="hp-line hp-line--chords">
          {segments.map((seg, i) =>
            seg.chord || seg.text ? (
              <span key={i} className="hp-seg">
                {seg.chord && <span className="hp-chord">{seg.chord}</span>}
                <span className="hp-lyric">{seg.text || "\u00a0"}</span>
              </span>
            ) : null,
          )}
        </div>
      );
    }
  }
};

export const PrintSongBody = React.memo<PrintSongBodyProps>(
  function PrintSongBody({ blocks, showChords, showLabels, twoColumns }) {
    const { t } = useI18n();

    const defaultLabel = (kind: SongBlock["kind"]) => {
      switch (kind) {
        case "chorus":
        case "ref":
          return t("print.song.chorus");
        case "bridge":
          return t("print.song.bridge");
        case "grid":
          return t("print.song.instrumental");
        case "tab":
          return t("print.song.tab");
        default:
          return undefined;
      }
    };

    return (
      <div className={twoColumns ? "hp-song hp-cols-2" : "hp-song"}>
        {blocks.map((block, idx) => {
          if (block.kind === "divider") {
            return <div key={idx} className="hp-divider" />;
          }

          const className = [
            "hp-section",
            `hp-section--${block.kind}`,
            block.numbered ? "hp-section--numbered" : "",
          ]
            .filter(Boolean)
            .join(" ");
          const label = block.label || defaultLabel(block.kind);
          const repeat = formatRepeat(block.repeat);

          if (block.kind === "ref") {
            return (
              <div key={idx} className={className}>
                <div className="hp-section-label">
                  <span>{label}</span>
                  {repeat && <span className="hp-repeat">{repeat}</span>}
                  <span className="hp-ref-note">{t("print.song.repeat")}</span>
                </div>
                <div className="hp-section-body" />
              </div>
            );
          }

          if (block.kind === "comment") {
            return (
              <div key={idx} className={className}>
                {block.lines.map((line, i) => (
                  <div key={i}>{line.text}</div>
                ))}
              </div>
            );
          }

          if (block.kind === "tab") {
            return (
              <div key={idx} className={className}>
                {showLabels && label && (
                  <div className="hp-section-label">
                    <span>{label}</span>
                  </div>
                )}
                <div className="hp-section-body">
                  <pre className="hp-tab">
                    {block.lines.map((l) => l.text ?? "").join("\n")}
                  </pre>
                </div>
              </div>
            );
          }

          return (
            <div key={idx} className={className}>
              {showLabels && label && (
                <div className="hp-section-label">
                  <span>{label}</span>
                  {repeat && <span className="hp-repeat">{repeat}</span>}
                </div>
              )}
              <div className="hp-section-body">
                {block.lines.map((line, i) => (
                  <PrintLine key={i} line={line} showChords={showChords} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  },
);
