/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

export interface AnkiCreateCardRequest {
    deck: string;
    model: string;
    fields: Record<string, string>;
    tags?: string[];
    picture_base64?: string;
    picture_filename?: string;
    picture_field?: string;
}

export interface AnkiCreateCardResponse {
    note_id: number;
    deck: string;
    model: string;
}

export interface AnkiStatus {
    enabled: boolean;
    reachable: boolean;
    version: number | null;
    error: string | null;
}

export class AnkiApiError extends Error {
    readonly status: number;

    constructor(status: number, message: string) {
        super(message);
        this.name = 'AnkiApiError';
        this.status = status;
    }
}

export interface AnkiApiOptions {
    endpoint: string;
    fetchImpl?: typeof fetch;
}

export class AnkiApi {
    private readonly endpoint: string;
    private readonly fetchImpl: typeof fetch;

    constructor({ endpoint, fetchImpl = fetch }: AnkiApiOptions) {
        this.endpoint = endpoint.replace(/\/$/, '');
        this.fetchImpl = fetchImpl;
    }

    async status(): Promise<AnkiStatus> {
        return this.request<AnkiStatus>('/anki/status', { method: 'GET' });
    }

    async createCard(payload: AnkiCreateCardRequest): Promise<AnkiCreateCardResponse> {
        return this.request<AnkiCreateCardResponse>('/anki/create-card', {
            method: 'POST',
            body: JSON.stringify(payload),
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
            throw new AnkiApiError(response.status, message);
        }
        return (await response.json()) as T;
    }
}
