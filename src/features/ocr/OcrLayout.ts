/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { BBoxPx } from '@/features/ocr/BBox.utils';

export type OcrTextOrientation = 'horizontal' | 'vertical';

export interface OcrLayoutInput {
    text: string;
    box: Pick<BBoxPx, 'width' | 'height'>;
    forcedOrientation?: string | null;
    sourceLines?: ReadonlyArray<string> | null;
    fontSize?: number | null;
    blockFontSize?: number | null;
    lineCoords?: ReadonlyArray<ReadonlyArray<ReadonlyArray<number> | number[]>> | null;
}

export interface OcrColumn {
    text: string;
    gapBefore: number;
}

export interface OcrTextLayout {
    orientation: OcrTextOrientation;
    fontSize: number;
    columnCount: number;
    columnGap: number;
    sideMargin: number;
    columns?: OcrColumn[];
    lineBoxWidth?: number;
    lineBoxHeight?: number;
}

const MIN_FONT_SIZE = 1;
const DEFAULT_GLYPH_ASPECT = 1.05;
const MIN_COLUMN_GAP_PX = 2;
const MAX_COLUMN_COUNT = 12;
const MIN_COLUMN_COUNT = 1;

// Geometry knobs. We avoid box-width ratios for gaps/margins so that the
// 8–9 column regression doesn't lose all its room to a 10%-of-box gap that
// scales with the very dimension we're trying to pack.
const COLUMN_LINE_BOX_WIDTH_RATIO = 1.05; // vertical line box width per em (Japanese ink + bearing)
const COLUMN_LINE_BOX_HEIGHT_RATIO = 1.2; // vertical line box height per em (Japanese ink + leading)
const FIXED_COLUMN_GAP_PX = 4; // safe between-column gap, independent of box width
const FIXED_SIDE_MARGIN_PX = 2; // safe side inset, independent of box width
const METRIC_QUANTUM_PX = 0.5; // round to 0.5 px to avoid subpixel blur

function quantize(value: number): number {
    if (!Number.isFinite(value)) {
        return 0;
    }
    return Math.max(0, Math.round(value / METRIC_QUANTUM_PX) * METRIC_QUANTUM_PX);
}

function graphemeLength(text: string): number {
    return Math.max([...text].length, 1);
}

function textLines(text: string): string[] {
    const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    return lines.length > 0 ? lines : [text.trim()];
}

function whitespaceColumns(text: string): string[] {
    return text
        .split(/\s+/)
        .map((line) => line.trim())
        .filter(Boolean);
}

function containsCjk(text: string): boolean {
    return /[\u3040-\u30ff\u3400-\u9fff]/.test(text);
}

function averageGlyphWidth(text: string): number {
    return containsCjk(text) ? 1 : 0.6;
}

function horizontalFontSize(text: string, box: Pick<BBoxPx, 'width' | 'height'>): number {
    const lines = textLines(text);
    const maxLineLength = Math.max(...lines.map(graphemeLength), 1);
    const rows = Math.max(lines.length, 1);
    const byWidth = box.width / (maxLineLength * averageGlyphWidth(text));
    const byHeight = box.height / rows;
    return Math.max(MIN_FONT_SIZE, Math.min(byWidth, byHeight));
}

function getRawColumns(
    text: string,
    sourceLines: ReadonlyArray<string> | null | undefined,
    splitOnWhitespace: boolean,
): string[] {
    const cleanSourceLines = sourceLines?.map((line) => line.trim()).filter(Boolean) ?? [];
    if (cleanSourceLines.length > 0) {
        return cleanSourceLines;
    }

    if (splitOnWhitespace) {
        const columns = whitespaceColumns(text);
        if (columns.length > 1) {
            return columns;
        }
    }

    return textLines(text);
}

function isLikelyVertical(
    text: string,
    box: Pick<BBoxPx, 'width' | 'height'>,
    forcedOrientation?: string | null,
): boolean {
    if (forcedOrientation === 'vertical') {
        return true;
    }
    if (forcedOrientation === 'horizontal') {
        return false;
    }
    return containsCjk(text) && box.height >= box.width;
}

function normalizeColumns(
    text: string,
    box: Pick<BBoxPx, 'width' | 'height'>,
    sourceLines?: ReadonlyArray<string> | null,
    forcedOrientation?: string | null,
): OcrColumn[] {
    const splitOnWhitespace = isLikelyVertical(text, box, forcedOrientation);
    const rawColumns = getRawColumns(text, sourceLines, splitOnWhitespace);
    if (rawColumns.length === 0) {
        return [{ text, gapBefore: 0 }];
    }

    const glyphAspect = box.height / Math.max(box.width, MIN_FONT_SIZE);
    const aspectRatio = box.width / Math.max(box.height, MIN_FONT_SIZE);

    let columns: OcrColumn[];
    if (rawColumns.length > 1) {
        columns = rawColumns.map((col) => ({ text: col, gapBefore: 0 }));
    } else {
        const single = rawColumns[0] ?? text;
        const singleLen = graphemeLength(single);
        let estimated = 1;
        if (singleLen > 1 && glyphAspect > 1.5) {
            const byAspect = Math.max(1, Math.round(glyphAspect / DEFAULT_GLYPH_ASPECT));
            const byWidth = Math.max(1, Math.floor((aspectRatio * singleLen) / 0.6));
            estimated = Math.max(MIN_COLUMN_COUNT, Math.min(byAspect, byWidth, MAX_COLUMN_COUNT));
            const maxByWidth = Math.max(1, Math.floor(singleLen / 2));
            estimated = Math.min(estimated, Math.max(maxByWidth, 1));
        }
        columns = splitIntoColumns(single, estimated);
    }

    return columns;
}

function splitIntoColumns(text: string, targetCount: number): OcrColumn[] {
    const graphemes = [...text];
    const total = graphemes.length;
    const count = Math.max(MIN_COLUMN_COUNT, Math.min(targetCount, total, MAX_COLUMN_COUNT));
    if (count <= 1 || total <= 1) {
        return [{ text, gapBefore: 0 }];
    }
    const base = Math.floor(total / count);
    const remainder = total - base * count;
    const columns: OcrColumn[] = [];
    let cursor = 0;
    for (let i = 0; i < count; i += 1) {
        const length = base + (i < remainder ? 1 : 0);
        const slice = graphemes.slice(cursor, cursor + length).join('');
        if (slice) {
            columns.push({ text: slice, gapBefore: 0 });
        }
        cursor += length;
    }
    return columns;
}

export interface VerticalLayoutMetrics {
    fontSize: number;
    columnGap: number;
    sideMargin: number;
    lineBoxWidth: number;
    lineBoxHeight: number;
    totalColumnWidth: number;
}

function computeVerticalLayout(
    box: Pick<BBoxPx, 'width' | 'height'>,
    columns: OcrColumn[],
    blockFontSize?: number | null,
): VerticalLayoutMetrics {
    const maxColumnLength = Math.max(...columns.map((col) => graphemeLength(col.text)), 1);
    const columnsCount = Math.max(columns.length, 1);

    const minGap = MIN_COLUMN_GAP_PX;
    const minSideMargin = MIN_COLUMN_GAP_PX;
    const targetGap = columnsCount > 1 ? Math.max(minGap, FIXED_COLUMN_GAP_PX) : 0;
    const targetSideMargin = columnsCount > 1 ? Math.max(minSideMargin, FIXED_SIDE_MARGIN_PX) : 0;

    // For a single column the column's "line box" exactly equals the column
    // width, so the font can fill the box (preserving the long-standing
    // 1-column behavior). For multi-column we reserve a small ink-safe
    // horizontal ratio so vertical Japanese glyphs don't kiss the gap/inset.
    const lineBoxWidthRatio = columnsCount > 1 ? COLUMN_LINE_BOX_WIDTH_RATIO : 1;
    const lineBoxHeightRatio = columnsCount > 1 ? COLUMN_LINE_BOX_HEIGHT_RATIO : 1;

    // Height-fill-first selection. Pick the largest font size that simultaneously:
    //   1. fills the box height (lineBoxHeight × longestColumnGlyphs ≤ H, up to one
    //      0.5-px quantisation quantum), and
    //   2. fits the box width (C × lineBoxWidth + (C−1) × columnGap + 2 × sideMargin
    //      ≤ W), with the line-box width computed from the *quantised* font size
    //      so we never ship a subpixel-fit that overflows after rounding.
    // This makes the per-column `lineBoxHeight` the *largest* advance that fits the
    // box, so the longest column visually fills the OCR box as much as the box
    // width and the supplied `blockFontSize` permit. When the width budget is the
    // binding constraint we walk down in 0.5-px steps; the height invariant
    // `lineBoxHeight × L ≤ H` is preserved at every candidate.
    const gHeightRaw = box.height / Math.max(maxColumnLength * lineBoxHeightRatio, lineBoxHeightRatio);
    const gHeightCeiling =
        typeof blockFontSize === 'number' && blockFontSize > 0 ? Math.min(blockFontSize, gHeightRaw) : gHeightRaw;

    let fontSize = quantize(gHeightCeiling);
    if (fontSize < MIN_FONT_SIZE) {
        fontSize = MIN_FONT_SIZE;
    }

    // Walk down in 0.5-px steps until the quantised width budget fits.
    const widthFits = (candidate: number): boolean => {
        const lbw = quantize(candidate * lineBoxWidthRatio);
        return columnsCount * lbw + (columnsCount - 1) * targetGap + 2 * targetSideMargin <= box.width;
    };
    while (fontSize > MIN_FONT_SIZE && !widthFits(fontSize)) {
        fontSize -= METRIC_QUANTUM_PX;
    }

    const lineBoxWidth = quantize(fontSize * COLUMN_LINE_BOX_WIDTH_RATIO);
    const lineBoxHeight = quantize(fontSize * COLUMN_LINE_BOX_HEIGHT_RATIO);
    const totalColumnWidth = columnsCount * lineBoxWidth + (columnsCount - 1) * targetGap + 2 * targetSideMargin;

    let columnGap = targetGap;
    let sideMargin = targetSideMargin;
    const deficit = totalColumnWidth - box.width;
    if (deficit > 0) {
        // Trim gaps first, then side margins, until we fit the box. We never
        // shrink the columns themselves; the column count is fixed.
        const gapShrinkBudget = (columnGap - minGap) * Math.max(columnsCount - 1, 0);
        const sideShrinkBudget = (sideMargin - minSideMargin) * 2;
        const gapShrink = Math.min(deficit, gapShrinkBudget);
        columnGap -= gapShrink / Math.max(columnsCount - 1, 1);
        const sideShrink = Math.min(deficit - gapShrink, sideShrinkBudget);
        sideMargin -= sideShrink / 2;
    }

    return {
        fontSize,
        columnGap: columnsCount > 1 ? columnGap : 0,
        sideMargin,
        lineBoxWidth,
        lineBoxHeight,
        totalColumnWidth,
    };
}

function isSingleSourceLine(sourceLines: ReadonlyArray<string> | null | undefined, text: string): boolean {
    if (sourceLines && sourceLines.length > 0) {
        return sourceLines.length === 1;
    }
    return textLines(text).length === 1;
}

export function getOcrTextLayout(input: OcrLayoutInput): OcrTextLayout {
    const text = input.text.trim();
    const box = {
        width: Math.max(input.box.width, MIN_FONT_SIZE),
        height: Math.max(input.box.height, MIN_FONT_SIZE),
    };
    const horizontalSize = horizontalFontSize(text, box);
    const lines = textLines(text);
    const aspectRatio = box.width / box.height;
    const forcedVertical = input.forcedOrientation === 'vertical';
    const forcedHorizontal = input.forcedOrientation === 'horizontal';

    const columns = normalizeColumns(text, box, input.sourceLines ?? null, input.forcedOrientation ?? null);

    const verticalMetrics = computeVerticalLayout(box, columns, input.blockFontSize ?? null);

    // Intentional exception: a clearly wide, single-line Japanese source
    // (e.g. "すいませ〜ん！！") should still render horizontally even when
    // vertical is forced, because a vertical column of N glyphs in a 193×21
    // box would not be readable. Gated on a single source line so multi-line
    // vertical sources are never collapsed into a single horizontal line.
    if (forcedVertical && isSingleSourceLine(input.sourceLines ?? null, text) && aspectRatio >= 2.5) {
        if (horizontalSize >= verticalMetrics.fontSize * 0.6) {
            return {
                orientation: 'horizontal',
                fontSize: horizontalSize,
                columnCount: 1,
                columnGap: 0,
                sideMargin: 0,
            };
        }
    }

    if (lines.length > 1 && containsCjk(text)) {
        if (verticalMetrics.fontSize >= horizontalSize * 0.75) {
            return {
                orientation: 'vertical',
                fontSize: verticalMetrics.fontSize,
                columnCount: columns.length,
                columnGap: verticalMetrics.columnGap,
                sideMargin: verticalMetrics.sideMargin,
                lineBoxWidth: verticalMetrics.lineBoxWidth,
                lineBoxHeight: verticalMetrics.lineBoxHeight,
                columns,
            };
        }
    }

    if (aspectRatio >= 2.5 && horizontalSize >= verticalMetrics.fontSize * 0.6) {
        return {
            orientation: 'horizontal',
            fontSize: horizontalSize,
            columnCount: 1,
            columnGap: 0,
            sideMargin: 0,
        };
    }

    if (aspectRatio <= 0.6 && (forcedVertical || containsCjk(text))) {
        return {
            orientation: 'vertical',
            fontSize: verticalMetrics.fontSize,
            columnCount: columns.length,
            columnGap: verticalMetrics.columnGap,
            sideMargin: verticalMetrics.sideMargin,
            lineBoxWidth: verticalMetrics.lineBoxWidth,
            lineBoxHeight: verticalMetrics.lineBoxHeight,
            columns,
        };
    }

    if (forcedVertical) {
        if (verticalMetrics.fontSize >= horizontalSize * 0.85) {
            return {
                orientation: 'vertical',
                fontSize: verticalMetrics.fontSize,
                columnCount: columns.length,
                columnGap: verticalMetrics.columnGap,
                sideMargin: verticalMetrics.sideMargin,
                lineBoxWidth: verticalMetrics.lineBoxWidth,
                lineBoxHeight: verticalMetrics.lineBoxHeight,
                columns,
            };
        }
        // Forced vertical with multiple source columns is honored: render
        // vertical rather than collapsing to a single horizontal line. This
        // preserves multi-column vertical sources like the 8-column
        // regression in vertical orientation.
        if (columns.length > 1) {
            return {
                orientation: 'vertical',
                fontSize: verticalMetrics.fontSize,
                columnCount: columns.length,
                columnGap: verticalMetrics.columnGap,
                sideMargin: verticalMetrics.sideMargin,
                lineBoxWidth: verticalMetrics.lineBoxWidth,
                lineBoxHeight: verticalMetrics.lineBoxHeight,
                columns,
            };
        }
    }

    if (forcedHorizontal || horizontalSize >= verticalMetrics.fontSize) {
        return {
            orientation: 'horizontal',
            fontSize: horizontalSize,
            columnCount: 1,
            columnGap: 0,
            sideMargin: 0,
        };
    }
    return {
        orientation: 'vertical',
        fontSize: verticalMetrics.fontSize,
        columnCount: columns.length,
        columnGap: verticalMetrics.columnGap,
        sideMargin: verticalMetrics.sideMargin,
        lineBoxWidth: verticalMetrics.lineBoxWidth,
        lineBoxHeight: verticalMetrics.lineBoxHeight,
        columns,
    };
}
