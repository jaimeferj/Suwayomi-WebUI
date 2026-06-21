/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AiApi, AiApiError } from '@/features/ocr/AiApi';
import type { AiExplainResponse } from '@/features/ocr/AiApi';

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

describe('AiApi', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('posts JSON to /ai/explain with the request body', async () => {
        const payload: AiExplainResponse = {
            provider: 'openai',
            explanation: 'Hello',
            vocab: [],
            grammar: [],
        };
        fetchMock.mockResolvedValueOnce(jsonResponse(200, payload));

        const api = new AiApi({ endpoint: 'http://localhost:8765' });
        const response = await api.explain({ text: 'こんにちは', language: 'ja' });

        expect(response).toEqual(payload);
        const [firstCall] = fetchMock.mock.calls;
        const [url, init] = firstCall;
        expect(url).toBe('http://localhost:8765/ai/explain');
        expect(init?.method).toBe('POST');
        expect(JSON.parse(init?.body as string)).toEqual({ text: 'こんにちは', language: 'ja' });
    });

    it('surfaces server errors as AiApiError', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(503, { detail: 'ai disabled' }));

        const api = new AiApi({ endpoint: 'http://localhost:8765' });
        let caught: unknown;
        try {
            await api.explain({ text: 'x' });
        } catch (error) {
            caught = error;
        }
        expect(caught).toBeInstanceOf(AiApiError);
        expect(caught).toMatchObject({ status: 503, message: 'ai disabled' });
    });
});
