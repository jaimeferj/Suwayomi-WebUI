/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { describe, expect, it } from 'vitest';

import { AI_PROVIDERS, DEFAULT_SETTINGS } from '@/features/ocr/OcrStore';

describe('AI_PROVIDERS', () => {
    it('includes minimax as the first/default option', () => {
        expect(AI_PROVIDERS[0]).toBe('minimax');
    });

    it('exposes openai and ollama as alternatives', () => {
        expect(AI_PROVIDERS).toContain('openai');
        expect(AI_PROVIDERS).toContain('ollama');
    });
});

describe('DEFAULT_SETTINGS.aiEnabled', () => {
    it('is false so AI is opt-in', () => {
        expect(DEFAULT_SETTINGS.aiEnabled).toBe(false);
    });
});

describe('DEFAULT_SETTINGS.aiProvider', () => {
    it('defaults to minimax', () => {
        expect(DEFAULT_SETTINGS.aiProvider).toBe('minimax');
    });
});
