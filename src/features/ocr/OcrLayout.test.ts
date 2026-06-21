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
    });

    it('treats CJK newlines as vertical columns', () => {
        const layout = getOcrTextLayout({
            text: '私は\n弱い男\nにも！！\n音楽が\nできない\n男にも\n興味が\nないの',
            box: { width: 160, height: 320 },
            forcedOrientation: 'vertical',
        });

        expect(layout.orientation).toBe('vertical');
        expect(layout.fontSize).toBeCloseTo(20, 1);
    });

    it('uses vertical layout for a tall narrow CJK box', () => {
        const layout = getOcrTextLayout({
            text: 'ありがとう',
            box: { width: 24, height: 120 },
            forcedOrientation: 'vertical',
        });

        expect(layout.orientation).toBe('vertical');
        expect(layout.fontSize).toBeCloseTo(24, 1);
    });

    it('uses horizontal layout for ordinary wide text', () => {
        const layout = getOcrTextLayout({
            text: 'hello world',
            box: { width: 180, height: 30 },
        });

        expect(layout.orientation).toBe('horizontal');
        expect(layout.fontSize).toBeCloseTo(27.27, 1);
    });
});
