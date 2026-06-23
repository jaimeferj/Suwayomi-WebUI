/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

export interface AiExplainRequest {
    text: string;
    language?: string;
    level?: string;
    include_vocab?: boolean;
    include_grammar?: boolean;
}

export interface AiExplainResponse {
    provider: string;
    explanation: string;
    vocab: Array<{ term: string; reading: string; meaning: string }>;
    grammar: string[];
}

export interface AiCardFieldsRequest {
    text: string;
    language?: string;
    reading?: string;
    model?: string;
}

export interface AiCardFieldsResponse {
    provider: string;
    fields: Record<string, string>;
    notes: string[];
}

export class AiApiError extends Error {
    readonly status: number;

    constructor(status: number, message: string) {
        super(message);
        this.name = 'AiApiError';
        this.status = status;
    }
}

export interface AiApiOptions {
    endpoint: string;
    fetchImpl?: typeof fetch;
}

export class AiApi {
    private readonly endpoint: string;
    private readonly fetchImpl: typeof fetch;

    constructor({ endpoint, fetchImpl = fetch }: AiApiOptions) {
        this.endpoint = endpoint.replace(/\/$/, '');
        this.fetchImpl = fetchImpl;
    }

    async explain(payload: AiExplainRequest): Promise<AiExplainResponse> {
        return this.request<AiExplainResponse>('/ai/explain', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    }

    async cardFields(payload: AiCardFieldsRequest): Promise<AiCardFieldsResponse> {
        return this.request<AiCardFieldsResponse>('/ai/card-fields', {
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
            throw new AiApiError(response.status, message);
        }
        return (await response.json()) as T;
    }
}
