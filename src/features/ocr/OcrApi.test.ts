/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OcrApi, OcrApiError } from '@/features/ocr/OcrApi';
import type { OcrPageResult, OcrStatus } from '@/features/ocr/Ocr.types';

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

describe('OcrApi', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('queries /ocr/status and parses the response', async () => {
        const payload: OcrStatus = {
            backend: 'mokuro',
            ready: true,
            error: null,
            cache_entries: 3,
        };
        fetchMock.mockResolvedValueOnce(jsonResponse(200, payload));

        const api = new OcrApi({ endpoint: 'http://localhost:8765/' });
        const status = await api.status();

        expect(status).toEqual(payload);
        const [firstCall] = fetchMock.mock.calls;
        const [url, init] = firstCall;
        expect(url).toBe('http://localhost:8765/ocr/status');
        expect(init?.method).toBe('GET');
    });

    it('posts JSON to /ocr/page with the request body', async () => {
        const result: OcrPageResult = {
            img_width: 800,
            img_height: 1200,
            cached: false,
            backend: 'mokuro',
            lines: [],
        };
        fetchMock.mockResolvedValueOnce(jsonResponse(200, result));

        const api = new OcrApi({ endpoint: 'http://localhost:8765' });
        await api.ocrPage({ manga_id: 'm1', chapter_id: 'c1', page_index: 7 });

        const [firstCall] = fetchMock.mock.calls;
        const [url, init] = firstCall;
        expect(url).toBe('http://localhost:8765/ocr/page');
        expect(init?.method).toBe('POST');
        expect(JSON.parse(init?.body as string)).toEqual({
            manga_id: 'm1',
            chapter_id: 'c1',
            page_index: 7,
        });
    });

    it('surfaces server errors as OcrApiError with the detail message', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(503, { detail: 'engine loading' }));

        const api = new OcrApi({ endpoint: 'http://localhost:8765' });
        let caught: unknown;
        try {
            await api.status();
        } catch (error) {
            caught = error;
        }
        expect(caught).toBeInstanceOf(OcrApiError);
        expect(caught).toMatchObject({ status: 503, message: 'engine loading' });
    });
});
