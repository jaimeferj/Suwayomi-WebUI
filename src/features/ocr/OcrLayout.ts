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
    columns?: OcrColumn[];
}

const MIN_FONT_SIZE = 1;
const DEFAULT_GLYPH_ASPECT = 1.05;
const MIN_COLUMN_GAP_PX = 2;
const MAX_COLUMN_COUNT = 12;
const MIN_COLUMN_COUNT = 1;

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

function normalizeColumns(
    text: string,
    box: Pick<BBoxPx, 'width' | 'height'>,
    sourceLines?: ReadonlyArray<string> | null,
): OcrColumn[] {
    const cleanSourceLines = sourceLines?.map((line) => line.trim()).filter(Boolean) ?? [];
    const rawColumns = cleanSourceLines.length > 0 ? cleanSourceLines : textLines(text);
    if (rawColumns.length === 0) {
        return [{ text, gapBefore: 0 }];
    }

    const total = graphemeLength(text);
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

    const totalColumns = columns.length;
    const availableWidth = Math.max(box.width - (totalColumns - 1) * MIN_COLUMN_GAP_PX, MIN_FONT_SIZE);
    const perColumnWidth = availableWidth / totalColumns;
    const gap = totalColumns > 1 ? Math.max(MIN_COLUMN_GAP_PX, box.width * 0.04) : 0;

    const columnFractions = columns.map((col) => {
        const len = graphemeLength(col.text);
        const minFraction = MIN_FONT_SIZE / Math.max(perColumnWidth, MIN_FONT_SIZE);
        const fraction = Math.max(len / Math.max(total, 1), minFraction);
        return Math.min(1, fraction);
    });

    columns = columns.map((col, idx) => ({
        text: col.text,
        gapBefore: idx === 0 ? 0 : gap * columnFractions.slice(0, idx).reduce((a, b) => a + b, 0),
    }));

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

function verticalFontSize(
    text: string,
    box: Pick<BBoxPx, 'width' | 'height'>,
    columns: OcrColumn[],
    blockFontSize?: number | null,
): number {
    const maxColumnLength = Math.max(...columns.map((col) => graphemeLength(col.text)), 1);
    const columnsCount = Math.max(columns.length, 1);
    const byHeight = box.height / maxColumnLength;
    const byWidth = box.width / columnsCount;
    const baseFontSize = Math.max(MIN_FONT_SIZE, Math.min(byHeight, byWidth));
    if (typeof blockFontSize === 'number' && blockFontSize > 0) {
        return Math.min(blockFontSize, Math.max(baseFontSize, blockFontSize));
    }
    return baseFontSize;
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

    const columns = normalizeColumns(text, box, input.sourceLines ?? null);
    const verticalSize = verticalFontSize(text, box, columns, input.blockFontSize ?? null);

    if (lines.length > 1 && containsCjk(text) && verticalSize >= horizontalSize * 0.75) {
        return {
            orientation: 'vertical',
            fontSize: verticalSize,
            columnCount: columns.length,
            columnGap: 0,
            columns,
        };
    }

    if (aspectRatio >= 2.5 && horizontalSize >= verticalSize * 0.6) {
        return {
            orientation: 'horizontal',
            fontSize: horizontalSize,
            columnCount: 1,
            columnGap: 0,
        };
    }

    if (aspectRatio <= 0.6 && (forcedVertical || containsCjk(text))) {
        return {
            orientation: 'vertical',
            fontSize: verticalSize,
            columnCount: columns.length,
            columnGap: 0,
            columns,
        };
    }

    if (forcedVertical && verticalSize >= horizontalSize * 0.85) {
        return {
            orientation: 'vertical',
            fontSize: verticalSize,
            columnCount: columns.length,
            columnGap: 0,
            columns,
        };
    }

    if (horizontalSize >= verticalSize) {
        return {
            orientation: 'horizontal',
            fontSize: horizontalSize,
            columnCount: 1,
            columnGap: 0,
        };
    }
    return {
        orientation: 'vertical',
        fontSize: verticalSize,
        columnCount: columns.length,
        columnGap: 0,
        columns,
    };
}
