/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type {
    OcrPageRequest,
    OcrPageResult,
    OcrPurgeRequest,
    OcrPurgeResponse,
    OcrRegionRequest,
    OcrRegionResult,
    OcrStatus,
} from '@/features/ocr/Ocr.types';

export class OcrApiError extends Error {
    readonly status: number;

    constructor(status: number, message: string) {
        super(message);
        this.name = 'OcrApiError';
        this.status = status;
    }
}

export interface OcrApiOptions {
    endpoint: string;
    fetchImpl?: typeof fetch;
}

export class OcrApi {
    private readonly endpoint: string;
    private readonly fetchImpl: typeof fetch;

    constructor({ endpoint, fetchImpl = fetch }: OcrApiOptions) {
        this.endpoint = endpoint.replace(/\/$/, '');
        this.fetchImpl = fetchImpl;
    }

    async status(): Promise<OcrStatus> {
        return this.request<OcrStatus>('/ocr/status', { method: 'GET' });
    }

    async ocrPage(request: OcrPageRequest): Promise<OcrPageResult> {
        return this.request<OcrPageResult>('/ocr/page', {
            method: 'POST',
            body: JSON.stringify(request),
        });
    }

    async recognizeRegion(request: OcrRegionRequest): Promise<OcrRegionResult> {
        return this.request<OcrRegionResult>('/ocr/recognize-region', {
            method: 'POST',
            body: JSON.stringify(request),
        });
    }

    async purgeCache(request: OcrPurgeRequest = {}): Promise<OcrPurgeResponse> {
        return this.request<OcrPurgeResponse>('/ocr/purge-cache', {
            method: 'POST',
            body: JSON.stringify(request),
        });
    }

    private async request<T>(path: string, init: RequestInit): Promise<T> {
        const fetchFn = this.fetchImpl ?? ((url: string, opts: RequestInit) => fetch(url, opts));
        const response = await fetchFn(`${this.endpoint}${path}`, {
            ...init,
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                ...(init.headers ?? {}),
            },
        });
        if (!response.ok) {
            let message = response.statusText;
            try {
                const body = (await response.json()) as { detail?: string };
                if (body?.detail) {
                    message = body.detail;
                }
            } catch {
                // ignore JSON parse failure on non-JSON error bodies
            }
            throw new OcrApiError(response.status, message);
        }
        return (await response.json()) as T;
    }
}
