/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { describe, expect, it } from 'vitest';

import { getOcrTextLayout } from '@/features/ocr/OcrLayout';

describe('getOcrTextLayout', () => {
    it('overrides a vertical hint for a wide, short Japanese line', () => {
        const layout = getOcrTextLayout({
            text: 'すいませ〜ん！！',
            box: { width: 193, height: 21 },
            forcedOrientation: 'vertical',
        });

        expect(layout.orientation).toBe('horizontal');
        expect(layout.fontSize).toBeCloseTo(21, 1);
        expect(layout.columnCount).toBe(1);
    });

    it('treats CJK newlines as vertical columns', () => {
        const layout = getOcrTextLayout({
            text: '私は\n弱い男\nにも！！\n音楽が\nできない\n男にも\n興味が\nないの',
            box: { width: 160, height: 320 },
            forcedOrientation: 'vertical',
        });

        expect(layout.orientation).toBe('vertical');
        expect(layout.columnCount).toBe(8);
        expect(layout.columns).toBeDefined();
        expect(layout.columns?.[0].text).toBe('私は');
    });

    it('uses vertical layout for a tall narrow CJK box', () => {
        const layout = getOcrTextLayout({
            text: 'ありがとう',
            box: { width: 24, height: 120 },
            forcedOrientation: 'vertical',
        });

        expect(layout.orientation).toBe('vertical');
        expect(layout.fontSize).toBeCloseTo(24, 1);
        expect(layout.columnCount).toBe(1);
    });

    it('uses horizontal layout for ordinary wide text', () => {
        const layout = getOcrTextLayout({
            text: 'hello world',
            box: { width: 180, height: 30 },
        });

        expect(layout.orientation).toBe('horizontal');
        expect(layout.fontSize).toBeCloseTo(27.27, 1);
        expect(layout.columnCount).toBe(1);
    });

    it('infers multiple vertical columns for a wide vertical box with long Japanese text', () => {
        const inputText = '立川で見た〝穴〟の下の巨大な眼は';
        const layout = getOcrTextLayout({
            text: inputText,
            box: { width: 120, height: 600 },
            forcedOrientation: 'vertical',
        });

        expect(layout.orientation).toBe('vertical');
        expect(layout.columnCount).toBeGreaterThan(1);
        expect(layout.columnCount).toBeLessThanOrEqual(12);
        expect(layout.columns?.length).toBe(layout.columnCount);
        expect(layout.columns?.reduce((acc, col) => acc + [...col.text].length, 0)).toBe([...inputText].length);
        expect(layout.fontSize).toBeGreaterThan(0);
    });

    it('prefers sourceLines from the OCR model when present for vertical layout', () => {
        const layout = getOcrTextLayout({
            text: '立川 穴 巨大な眼',
            box: { width: 90, height: 360 },
            forcedOrientation: 'vertical',
            sourceLines: ['立川', '穴', '巨大な眼'],
        });

        expect(layout.orientation).toBe('vertical');
        expect(layout.columnCount).toBe(3);
        expect(layout.columns?.map((col) => col.text)).toEqual(['立川', '穴', '巨大な眼']);
    });

    it('uses blockFontSize as a soft cap for vertical font size', () => {
        const layout = getOcrTextLayout({
            text: 'ありがとうございます',
            box: { width: 30, height: 600 },
            forcedOrientation: 'vertical',
            blockFontSize: 30,
        });

        expect(layout.orientation).toBe('vertical');
        expect(layout.fontSize).toBeLessThanOrEqual(30);
        expect(layout.fontSize).toBeGreaterThan(0);
    });

    it('produces positive column gaps and side margins for multi-column vertical layout', () => {
        const layout = getOcrTextLayout({
            text: 'あいうえおかきくけこさしすせそ',
            box: { width: 200, height: 400 },
            forcedOrientation: 'vertical',
        });

        expect(layout.orientation).toBe('vertical');
        expect(layout.columnCount).toBeGreaterThan(1);
        expect(layout.columnGap).toBeGreaterThan(0);
        expect(layout.sideMargin).toBeGreaterThan(0);
        const columnWidth = layout.lineBoxWidth ?? layout.fontSize;
        const totalWidth =
            layout.columnCount * columnWidth + (layout.columnCount - 1) * layout.columnGap + 2 * layout.sideMargin;
        expect(totalWidth).toBeLessThanOrEqual(200);
        expect(layout.fontSize).toBeGreaterThan(0);
    });

    it('splits vertical CJK text on whitespace into separate columns', () => {
        const layout = getOcrTextLayout({
            text: '王は 誰だ？',
            box: { width: 80, height: 160 },
            forcedOrientation: 'vertical',
        });

        expect(layout.orientation).toBe('vertical');
        expect(layout.columnCount).toBe(2);
        expect(layout.columns?.map((col) => col.text)).toEqual(['王は', '誰だ？']);
        expect(layout.fontSize).toBeGreaterThan(0);
        expect(layout.columnGap).toBeGreaterThan(0);
        expect(layout.sideMargin).toBeGreaterThanOrEqual(0);
        const columnWidth = layout.lineBoxWidth ?? layout.fontSize;
        const totalWidth =
            layout.columnCount * columnWidth + (layout.columnCount - 1) * layout.columnGap + 2 * layout.sideMargin;
        expect(totalWidth).toBeLessThanOrEqual(80);
    });

    it('does not split on whitespace when the box is wider than tall', () => {
        const layout = getOcrTextLayout({
            text: 'hello world',
            box: { width: 200, height: 60 },
        });

        expect(layout.orientation).toBe('horizontal');
        expect(layout.columnCount).toBe(1);
    });

    it('places the first sourceLine column at the rightmost position for vertical RTL rendering', () => {
        const layout = getOcrTextLayout({
            text: '王は 誰だ？',
            box: { width: 100, height: 200 },
            forcedOrientation: 'vertical',
            sourceLines: ['王は', '誰だ？'],
        });

        expect(layout.orientation).toBe('vertical');
        expect(layout.columnCount).toBe(2);
        expect(layout.columns?.[0].text).toBe('王は');
        expect(layout.columns?.[1].text).toBe('誰だ？');
    });

    it('keeps the 8-column forced-vertical regression vertical with 8 readable columns', () => {
        const regressionText = 'けった のは ぼくだ けど、 ボールの 持ち主は おま えだ。';
        const sourceLines = ['けった', 'のは', 'ぼくだ', 'けど、', 'ボールの', '持ち主は', 'おま', 'えだ。'];
        const layout = getOcrTextLayout({
            text: regressionText,
            box: { width: 200, height: 240 },
            forcedOrientation: 'vertical',
            sourceLines,
            blockFontSize: 28,
        });

        expect(layout.orientation).toBe('vertical');
        expect(layout.columnCount).toBe(8);
        expect(layout.columns?.map((col) => col.text)).toEqual(sourceLines);
        expect(layout.columns?.length).toBe(8);

        const reconstructed = layout.columns?.map((col) => col.text).join('') ?? '';
        const strippedOriginal = regressionText.replaceAll(/\s+/g, '');
        expect(reconstructed.replaceAll(/\s+/g, '')).toBe(strippedOriginal);

        expect(layout.fontSize).toBeGreaterThanOrEqual(20);
        expect(layout.fontSize).toBeLessThanOrEqual(28);

        expect(Number.isFinite(layout.fontSize)).toBe(true);
        expect(Number.isFinite(layout.columnGap)).toBe(true);
        expect(Number.isFinite(layout.sideMargin)).toBe(true);
        expect(layout.fontSize).toBeGreaterThan(0);
        expect(layout.columnGap).toBeGreaterThanOrEqual(0);
        expect(layout.sideMargin).toBeGreaterThanOrEqual(0);

        const columnWidth = layout.lineBoxWidth ?? layout.fontSize;
        const longestColumn = Math.max(...(layout.columns ?? []).map((col) => [...col.text].length));
        const fittedWidth =
            layout.columnCount * columnWidth + (layout.columnCount - 1) * layout.columnGap + 2 * layout.sideMargin;
        expect(fittedWidth).toBeLessThanOrEqual(200);
        const fittedHeight = longestColumn * (layout.lineBoxHeight ?? layout.fontSize);
        expect(fittedHeight).toBeLessThanOrEqual(240);

        expect(layout.lineBoxWidth).toBeGreaterThan(0);
        expect(layout.lineBoxHeight).toBeGreaterThan(0);
    });
});
