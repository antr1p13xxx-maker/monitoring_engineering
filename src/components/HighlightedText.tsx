import React, { useMemo } from 'react';

interface HighlightedTextProps {
  text?: string | number | null;
  query: string;
  fallback?: string;
  highlightClassName?: string;
}

const DEFAULT_HIGHLIGHT_CLASS =
  'bg-amber-200 text-slate-950 rounded-xs px-0.5 font-extrabold ring-1 ring-amber-400/70 shadow-2xs';

/**
 * Safely renders text with case-insensitive, multi-token search highlights
 * using merged character intervals (no regex injection or HTML injection).
 */
export const HighlightedText: React.FC<HighlightedTextProps> = ({
  text,
  query,
  fallback = '',
  highlightClassName = DEFAULT_HIGHLIGHT_CLASS,
}) => {
  const raw = text === null || text === undefined || text === '' ? fallback : String(text);

  const segments = useMemo(() => {
    if (!raw) return null;

    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return null;

    const tokens = Array.from(new Set(trimmed.split(/\s+/).filter(Boolean)));
    if (tokens.length === 0) return null;

    const lower = raw.toLowerCase();
    const ranges: Array<[number, number]> = [];

    for (const token of tokens) {
      let idx = lower.indexOf(token);
      while (idx !== -1) {
        ranges.push([idx, idx + token.length]);
        idx = lower.indexOf(token, idx + 1);
      }
    }

    if (ranges.length === 0) return null;

    ranges.sort((a, b) => a[0] - b[0] || b[1] - a[1]);

    const merged: Array<[number, number]> = [];
    for (const [start, end] of ranges) {
      const last = merged[merged.length - 1];
      if (!last || start > last[1]) {
        merged.push([start, end]);
      } else if (end > last[1]) {
        last[1] = end;
      }
    }

    const parts: Array<{ text: string; match: boolean }> = [];
    let cursor = 0;

    for (const [start, end] of merged) {
      if (start > cursor) {
        parts.push({ text: raw.slice(cursor, start), match: false });
      }
      parts.push({ text: raw.slice(start, end), match: true });
      cursor = end;
    }

    if (cursor < raw.length) {
      parts.push({ text: raw.slice(cursor), match: false });
    }

    return parts;
  }, [raw, query]);

  if (!raw) return null;
  if (!segments) return <>{raw}</>;

  return (
    <>
      {segments.map((part, idx) =>
        part.match ? (
          <mark key={idx} className={highlightClassName}>
            {part.text}
          </mark>
        ) : (
          <React.Fragment key={idx}>{part.text}</React.Fragment>
        )
      )}
    </>
  );
};
