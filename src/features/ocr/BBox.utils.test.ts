/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { describe, expect, it } from 'vitest';

import { bboxKey, clampBBox, nmToRp, pointInBBox, rpToNm } from '@/features/ocr/BBox.utils';

const img = { clientWidth: 800, clientHeight: 1200 };

describe('nmToRp', () => {
    it('scales 1:1 when the rendered size equals the unit box', () => {
        expect(nmToRp({ x: 0, y: 0, width: 1, height: 1 }, img)).toEqual({
            x: 0,
            y: 0,
            width: 800,
            height: 1200,
        });
    });

    it('scales 2:1 horizontally and 0.5x vertically', () => {
        expect(nmToRp({ x: 0.5, y: 0.5, width: 0.5, height: 0.5 }, img)).toEqual({
            x: 400,
            y: 600,
            width: 400,
            height: 600,
        });
    });

    it('is a no-op at the origin', () => {
        expect(nmToRp({ x: 0, y: 0, width: 0.1, height: 0.1 }, img)).toEqual({
            x: 0,
            y: 0,
            width: 80,
            height: 120,
        });
    });
});

describe('rpToNm', () => {
    it('is the inverse of nmToRp', () => {
        const b = { x: 0.25, y: 0.5, width: 0.125, height: 0.0625 };
        const back = rpToNm(nmToRp(b, img), img);
        expect(back.x).toBeCloseTo(b.x, 6);
        expect(back.y).toBeCloseTo(b.y, 6);
        expect(back.width).toBeCloseTo(b.width, 6);
        expect(back.height).toBeCloseTo(b.height, 6);
    });

    it('handles a 0-sized image without dividing by zero', () => {
        const zero = { clientWidth: 0, clientHeight: 0 };
        expect(rpToNm({ x: 0, y: 0, width: 0, height: 0 }, zero)).toEqual({
            x: 0,
            y: 0,
            width: 0,
            height: 0,
        });
    });
});

describe('pointInBBox', () => {
    const box = { x: 10, y: 20, width: 100, height: 50 };

    it('returns true for a point inside the box', () => {
        expect(pointInBBox(50, 40, box)).toBe(true);
    });

    it('returns true on the edges', () => {
        expect(pointInBBox(10, 20, box)).toBe(true);
        expect(pointInBBox(110, 70, box)).toBe(true);
    });

    it('returns false outside the box', () => {
        expect(pointInBBox(9, 20, box)).toBe(false);
        expect(pointInBBox(111, 70, box)).toBe(false);
    });

    it('respects a tolerance', () => {
        expect(pointInBBox(7, 20, box, 5)).toBe(true);
        expect(pointInBBox(7, 20, box, 2)).toBe(false);
    });
});

describe('clampBBox', () => {
    it('clamps negative origin and out-of-range size', () => {
        expect(clampBBox({ x: -0.1, y: -0.1, width: 1.5, height: 1.5 })).toEqual({
            x: 0,
            y: 0,
            width: 1,
            height: 1,
        });
    });

    it('keeps a well-formed box untouched', () => {
        expect(clampBBox({ x: 0.25, y: 0.25, width: 0.5, height: 0.5 })).toEqual({
            x: 0.25,
            y: 0.25,
            width: 0.5,
            height: 0.5,
        });
    });
});

describe('bboxKey', () => {
    it('rounds to 4 decimals for a stable cache key', () => {
        expect(bboxKey({ x: 0.1234567, y: 0, width: 0.5, height: 0.5 })).toBe('0.1235,0.0000,0.5000,0.5000');
    });

    it('is identical for visually equivalent bboxes', () => {
        const a = bboxKey({ x: 0.1, y: 0.1, width: 0.1, height: 0.1 });
        const b = bboxKey({ x: 0.1, y: 0.1, width: 0.1, height: 0.1 });
        expect(a).toBe(b);
    });
});
