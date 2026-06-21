/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AnkiApi, AnkiApiError } from '@/features/ocr/AnkiApi';
import type { AnkiCreateCardResponse, AnkiStatus } from '@/features/ocr/AnkiApi';

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

describe('AnkiApi', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('queries /anki/status and parses the response', async () => {
        const payload: AnkiStatus = {
            enabled: true,
            reachable: true,
            version: 6,
            error: null,
        };
        fetchMock.mockResolvedValueOnce(jsonResponse(200, payload));

        const api = new AnkiApi({ endpoint: 'http://localhost:8765/' });
        const status = await api.status();

        expect(status).toEqual(payload);
        const [firstCall] = fetchMock.mock.calls;
        const [url, init] = firstCall;
        expect(url).toBe('http://localhost:8765/anki/status');
        expect(init?.method).toBe('GET');
    });

    it('posts JSON to /anki/create-card with the request body', async () => {
        const response: AnkiCreateCardResponse = {
            note_id: 99,
            deck: 'Mining',
            model: 'Basic',
        };
        fetchMock.mockResolvedValueOnce(jsonResponse(200, response));

        const api = new AnkiApi({ endpoint: 'http://localhost:8765' });
        const result = await api.createCard({
            deck: 'Mining',
            model: 'Basic',
            fields: { Front: '猫' },
            tags: ['manga'],
        });

        expect(result).toEqual(response);
        const [firstCall] = fetchMock.mock.calls;
        const [url, init] = firstCall;
        expect(url).toBe('http://localhost:8765/anki/create-card');
        expect(init?.method).toBe('POST');
        expect(JSON.parse(init?.body as string)).toEqual({
            deck: 'Mining',
            model: 'Basic',
            fields: { Front: '猫' },
            tags: ['manga'],
        });
    });

    it('surfaces server errors as AnkiApiError with the detail message', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(503, { detail: 'anki disabled' }));

        const api = new AnkiApi({ endpoint: 'http://localhost:8765' });
        let caught: unknown;
        try {
            await api.status();
        } catch (error) {
            caught = error;
        }
        expect(caught).toBeInstanceOf(AnkiApiError);
        expect(caught).toMatchObject({ status: 503, message: 'anki disabled' });
    });
});
