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
}

const MIN_FONT_SIZE = 1;
const DEFAULT_GLYPH_ASPECT = 1.05;
const MIN_COLUMN_GAP_PX = 2;
const MAX_COLUMN_COUNT = 12;
const MIN_COLUMN_COUNT = 1;

const GAP_RATIO = 0.1;
const SIDE_MARGIN_RATIO = 0.06;

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
}

function computeVerticalLayout(
    box: Pick<BBoxPx, 'width' | 'height'>,
    columns: OcrColumn[],
    blockFontSize?: number | null,
): VerticalLayoutMetrics {
    const maxColumnLength = Math.max(...columns.map((col) => graphemeLength(col.text)), 1);
    const columnsCount = Math.max(columns.length, 1);

    const byHeight = box.height / maxColumnLength;

    const minGap = MIN_COLUMN_GAP_PX;
    const minSideMargin = MIN_COLUMN_GAP_PX;
    const targetGap = columnsCount > 1 ? Math.max(minGap, box.width * GAP_RATIO) : 0;
    const targetSideMargin = columnsCount > 1 ? Math.max(minSideMargin, box.width * SIDE_MARGIN_RATIO) : 0;

    const byWidth = Math.max(
        MIN_FONT_SIZE,
        (box.width - 2 * targetSideMargin - (columnsCount - 1) * targetGap) / Math.max(columnsCount, 1),
    );

    let fontSize = Math.min(byHeight, byWidth);

    const minUsedWidth = columnsCount * fontSize + (columnsCount - 1) * targetGap + 2 * targetSideMargin;
    const remaining = box.width - minUsedWidth;

    let columnGap = targetGap;
    let sideMargin = targetSideMargin;

    if (remaining > 0) {
        const gapExtra = columnsCount > 1 ? (remaining * 0.6) / (columnsCount - 1) : 0;
        const sideExtra = (remaining * 0.4) / 2;
        columnGap += gapExtra;
        sideMargin += sideExtra;
    } else if (remaining < 0) {
        const deficit = -remaining;
        const gapReduction = Math.min(deficit, Math.max(columnGap - minGap, 0) * (columnsCount - 1));
        columnGap -= gapReduction / Math.max(columnsCount - 1, 1);
        const remainingDeficit = deficit - gapReduction;
        const sideReduction = Math.min(remainingDeficit, Math.max(sideMargin - minSideMargin, 0) * 2);
        sideMargin -= sideReduction / 2;
    }

    fontSize = Math.max(MIN_FONT_SIZE, fontSize);

    if (typeof blockFontSize === 'number' && blockFontSize > 0) {
        fontSize = Math.min(blockFontSize, Math.max(fontSize, MIN_FONT_SIZE));
    }

    return {
        fontSize,
        columnGap: columnsCount > 1 ? columnGap : 0,
        sideMargin,
    };
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

    const columns = normalizeColumns(text, box, input.sourceLines ?? null, input.forcedOrientation ?? null);

    if (lines.length > 1 && containsCjk(text)) {
        const metrics = computeVerticalLayout(box, columns, input.blockFontSize ?? null);
        if (metrics.fontSize >= horizontalSize * 0.75) {
            return {
                orientation: 'vertical',
                fontSize: metrics.fontSize,
                columnCount: columns.length,
                columnGap: metrics.columnGap,
                sideMargin: metrics.sideMargin,
                columns,
            };
        }
    }

    if (
        aspectRatio >= 2.5 &&
        horizontalSize >= computeVerticalLayout(box, columns, input.blockFontSize ?? null).fontSize * 0.6
    ) {
        return {
            orientation: 'horizontal',
            fontSize: horizontalSize,
            columnCount: 1,
            columnGap: 0,
            sideMargin: 0,
        };
    }

    if (aspectRatio <= 0.6 && (forcedVertical || containsCjk(text))) {
        const metrics = computeVerticalLayout(box, columns, input.blockFontSize ?? null);
        return {
            orientation: 'vertical',
            fontSize: metrics.fontSize,
            columnCount: columns.length,
            columnGap: metrics.columnGap,
            sideMargin: metrics.sideMargin,
            columns,
        };
    }

    if (forcedVertical) {
        const metrics = computeVerticalLayout(box, columns, input.blockFontSize ?? null);
        if (metrics.fontSize >= horizontalSize * 0.85) {
            return {
                orientation: 'vertical',
                fontSize: metrics.fontSize,
                columnCount: columns.length,
                columnGap: metrics.columnGap,
                sideMargin: metrics.sideMargin,
                columns,
            };
        }
    }

    if (horizontalSize >= computeVerticalLayout(box, columns, input.blockFontSize ?? null).fontSize) {
        return {
            orientation: 'horizontal',
            fontSize: horizontalSize,
            columnCount: 1,
            columnGap: 0,
            sideMargin: 0,
        };
    }
    const metrics = computeVerticalLayout(box, columns, input.blockFontSize ?? null);
    return {
        orientation: 'vertical',
        fontSize: metrics.fontSize,
        columnCount: columns.length,
        columnGap: metrics.columnGap,
        sideMargin: metrics.sideMargin,
        columns,
    };
}
