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
        expect(layout.fontSize).toBeCloseTo(20, 1);
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
        const layout = getOcrTextLayout({
            text: '立川で見た〝穴〟の下の巨大な眼は',
            box: { width: 120, height: 600 },
            forcedOrientation: 'vertical',
        });

        expect(layout.orientation).toBe('vertical');
        expect(layout.columnCount).toBeGreaterThan(1);
        expect(layout.columnCount).toBeLessThanOrEqual(12);
        expect(layout.columns?.length).toBe(layout.columnCount);
        expect(layout.columns?.reduce((acc, col) => acc + [...col.text].length, 0)).toBe(
            [...(layout.text ?? '')].length || [...'立川で見た〝穴〟の下の巨大な眼は'].length,
        );
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

    it('produces positive column gaps for multi-column vertical layout', () => {
        const layout = getOcrTextLayout({
            text: 'あいうえおかきくけこさしすせそ',
            box: { width: 200, height: 400 },
            forcedOrientation: 'vertical',
        });

        expect(layout.orientation).toBe('vertical');
        expect(layout.columnCount).toBeGreaterThan(1);
        for (let i = 1; i < (layout.columns?.length ?? 0); i += 1) {
            expect(layout.columns?.[i].gapBefore ?? 0).toBeGreaterThan(0);
        }
    });
});
