/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { BBox } from '@/features/ocr/BBox.utils';

export type OcrOrientation = 'horizontal' | 'vertical';

export interface OcrLine {
    text: string;
    tightBoundingBox: BBox;
    forcedOrientation: OcrOrientation;
    isMerged: boolean;
}

export interface OcrPageResult {
    img_width: number;
    img_height: number;
    lines: OcrLine[];
    cached: boolean;
    backend: string;
}

export interface OcrRegionResult {
    text: string;
    tightBoundingBox: BBox;
    forcedOrientation: OcrOrientation;
    isMerged: boolean;
}

export interface OcrStatus {
    backend: string;
    ready: boolean;
    error: string | null;
    cache_entries: number;
}

export interface OcrPageRequest {
    image_base64?: string;
    image_url?: string;
    language?: string;
    manga_id?: string;
    chapter_id?: string;
    page_index?: number;
    force?: boolean;
}

export interface OcrRegionRequest {
    image_base64?: string;
    image_url?: string;
    region: BBox;
    language?: string;
}

export interface OcrPurgeRequest {
    manga_id?: string;
    chapter_id?: string;
}

export interface OcrPurgeResponse {
    removed: number;
}

export interface OcrSettings {
    enabled: boolean;
    endpoint: string;
    language: string;
    showOnHover: boolean;
    autoDetect: boolean;
}
