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

        expect(Number.isFinite(layout.fontSize)).toBe(true);
        expect(Number.isFinite(layout.columnGap)).toBe(true);
        expect(Number.isFinite(layout.sideMargin)).toBe(true);
        expect(layout.fontSize).toBeGreaterThan(0);
        expect(layout.columnGap).toBeGreaterThanOrEqual(0);
        expect(layout.sideMargin).toBeGreaterThanOrEqual(0);

        // Fill-derived font size: largest g ≤ blockFontSize such that
        //   longestColumnGlyphs × lineBoxHeight ≤ boxHeight + 0.5  AND
        //   columnCount × lineBoxWidth + (columnCount − 1) × columnGap + 2 × sideMargin ≤ boxWidth
        // For 200×240 / C=8 / L=3 / blockFontSize=28 / columnGap=4 / sideMargin=2:
        //   g_height  = 240 / (3 × 1.2) = 66.67, capped to 28.
        //   width budget: 8 × lineBoxWidth + 7 × 4 + 2 × 2 ≤ 200 → lineBoxWidth ≤ 21.
        //   g=20: lineBoxWidth=21 (20×1.05), 8×21+32=200 ✓.
        //   g=20.5: lineBoxWidth=21.5, 8×21.5+32=204 ✗.
        //   → fontSize=20, lineBoxHeight=24 (20×1.2).
        expect(layout.fontSize).toBeCloseTo(20, 1);
        expect(layout.fontSize).toBeLessThanOrEqual(28);
        expect(layout.lineBoxWidth).toBeCloseTo(20 * 1.05, 1);
        expect(layout.lineBoxHeight).toBeCloseTo(20 * 1.2, 1);

        const columnWidth = layout.lineBoxWidth ?? layout.fontSize;
        const longestColumn = Math.max(...(layout.columns ?? []).map((col) => [...col.text].length));
        const fittedWidth =
            layout.columnCount * columnWidth + (layout.columnCount - 1) * layout.columnGap + 2 * layout.sideMargin;
        expect(fittedWidth).toBeLessThanOrEqual(200);
        const fittedHeight = longestColumn * (layout.lineBoxHeight ?? layout.fontSize);
        // Fill invariant: lineBoxHeight × longestColumn ≤ box.height (up to one
        // 0.5-px quantisation quantum). With g=20 and 3 glyphs: 3 × 24 = 72 ≤ 240.5.
        expect(fittedHeight).toBeLessThanOrEqual(240 + 0.5);

        expect(layout.lineBoxWidth).toBeGreaterThan(0);
        expect(layout.lineBoxHeight).toBeGreaterThan(0);
    });

    it('fills the box height for the 2-column 王は/誰だ？ case (fill-derived font size)', () => {
        const layout = getOcrTextLayout({
            text: '王は 誰だ？',
            box: { width: 80, height: 160 },
            forcedOrientation: 'vertical',
            sourceLines: ['王は', '誰だ？'],
        });

        expect(layout.orientation).toBe('vertical');
        expect(layout.columnCount).toBe(2);
        expect(layout.columns?.map((col) => col.text)).toEqual(['王は', '誰だ？']);

        const longestColumn = Math.max(...(layout.columns ?? []).map((col) => [...col.text].length));
        // Fill invariant: lineBoxHeight × longestColumn ≤ box.height (up to one
        // 0.5-px quantisation quantum). 3 × 41.5 = 124.5 ≤ 160.5.
        expect(longestColumn * (layout.lineBoxHeight ?? layout.fontSize)).toBeLessThanOrEqual(160 + 0.5);

        const columnWidth = layout.lineBoxWidth ?? layout.fontSize;
        const fittedWidth =
            layout.columnCount * columnWidth + (layout.columnCount - 1) * layout.columnGap + 2 * layout.sideMargin;
        expect(fittedWidth).toBeLessThanOrEqual(80);
        // No blockFontSize cap, so fontSize is the largest g where both
        // constraints hold. Width budget: 2 × lineBoxWidth + 1 × 4 + 2 × 2 ≤ 80,
        // so lineBoxWidth ≤ 36 → g × 1.05 ≤ 36 → g ≤ 34.29; quantised to 34.5
        // (lineBoxWidth=36) still fits: 2 × 36 + 8 = 80 ≤ 80. The height-fill
        // target 160 / (3 × 1.2) = 44.44 is wider than the width budget, so
        // the width constraint is the binding one and the fill is ~78 % by
        // height / 100 % by width.
        expect(layout.fontSize).toBeCloseTo(34.5, 1);
        expect(layout.lineBoxHeight).toBeCloseTo(41.5, 1);
    });
});
