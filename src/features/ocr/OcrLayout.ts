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
}

export interface OcrTextLayout {
    orientation: OcrTextOrientation;
    fontSize: number;
}

const MIN_FONT_SIZE = 1;

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

function verticalFontSize(text: string, box: Pick<BBoxPx, 'width' | 'height'>): number {
    const columns = textLines(text);
    const maxColumnLength = Math.max(...columns.map(graphemeLength), 1);
    const byHeight = box.height / maxColumnLength;
    const byWidth = box.width / Math.max(columns.length, 1);
    return Math.max(MIN_FONT_SIZE, Math.min(byHeight, byWidth));
}

export function getOcrTextLayout(input: OcrLayoutInput): OcrTextLayout {
    const text = input.text.trim();
    const box = {
        width: Math.max(input.box.width, MIN_FONT_SIZE),
        height: Math.max(input.box.height, MIN_FONT_SIZE),
    };
    const horizontalSize = horizontalFontSize(text, box);
    const verticalSize = verticalFontSize(text, box);
    const lines = textLines(text);
    const aspectRatio = box.width / box.height;
    const forcedVertical = input.forcedOrientation === 'vertical';

    if (lines.length > 1 && containsCjk(text) && verticalSize >= horizontalSize * 0.75) {
        return { orientation: 'vertical', fontSize: verticalSize };
    }

    if (aspectRatio >= 2.5 && horizontalSize >= verticalSize * 0.6) {
        return { orientation: 'horizontal', fontSize: horizontalSize };
    }

    if (aspectRatio <= 0.6 && (forcedVertical || containsCjk(text))) {
        return { orientation: 'vertical', fontSize: verticalSize };
    }

    if (forcedVertical && verticalSize >= horizontalSize * 0.85) {
        return { orientation: 'vertical', fontSize: verticalSize };
    }

    return horizontalSize >= verticalSize
        ? { orientation: 'horizontal', fontSize: horizontalSize }
        : { orientation: 'vertical', fontSize: verticalSize };
}
