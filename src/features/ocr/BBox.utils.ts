/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

export interface BBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface BBoxPx {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface RenderedSize {
    clientWidth: number;
    clientHeight: number;
}

export function nmToRp(b: BBox, img: RenderedSize): BBoxPx {
    return {
        x: b.x * img.clientWidth,
        y: b.y * img.clientHeight,
        width: b.width * img.clientWidth,
        height: b.height * img.clientHeight,
    };
}

export function rpToNm(b: BBoxPx, img: RenderedSize): BBox {
    const w = img.clientWidth || 1;
    const h = img.clientHeight || 1;
    return {
        x: b.x / w,
        y: b.y / h,
        width: b.width / w,
        height: b.height / h,
    };
}

export function pointInBBox(px: number, py: number, box: BBoxPx, tolerance: number = 0): boolean {
    return (
        px >= box.x - tolerance &&
        px <= box.x + box.width + tolerance &&
        py >= box.y - tolerance &&
        py <= box.y + box.height + tolerance
    );
}

export function clampBBox(b: BBox): BBox {
    const x = Math.max(0, Math.min(1, b.x));
    const y = Math.max(0, Math.min(1, b.y));
    return {
        x,
        y,
        width: Math.max(0, Math.min(1 - x, b.width)),
        height: Math.max(0, Math.min(1 - y, b.height)),
    };
}

export function bboxKey(b: BBox): string {
    return `${b.x.toFixed(4)},${b.y.toFixed(4)},${b.width.toFixed(4)},${b.height.toFixed(4)}`;
}
