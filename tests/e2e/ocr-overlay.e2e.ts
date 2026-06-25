/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const expectedTexts = {
    page0: '立川で見た〝穴〟の下の巨大な眼は',
    page1: '実戦剣術も一流です',
} as const;

const waitForHarness = async (page: Page) => {
    await page.waitForFunction(
        () =>
            typeof window.__OCR_TEST__ !== 'undefined' &&
            (window.__OCR_TEST__ as { ready?: boolean } | undefined)?.ready === true,
        undefined,
        { timeout: 30_000 },
    );
};

test.describe('OCR overlay in front of manga reader UI', () => {
    test('renders OCR text from /ocr/page requests on top of the manga page image', async ({ page }) => {
        page.on('console', (msg) => {
            console.log(`[browser:${msg.type()}]`, msg.text());
        });
        page.on('pageerror', (err) => {
            console.log('[browser:pageerror]', err.message);
        });

        await page.goto('/');

        // Wait for harness to register its bridge
        try {
            await page.waitForFunction(() => window.__OCR_TEST__ !== undefined, undefined, { timeout: 10_000 });
        } catch (e) {
            const html = await page.content();
            console.log('Page HTML (first 2000):', html.slice(0, 2000));
            throw e;
        }

        // Enable OCR + show overlay
        await page.evaluate(() => {
            window.__OCR_TEST__!.setEnabled(true);
            window.__OCR_TEST__!.setEndpoint('http://127.0.0.1:8765');
            window.__OCR_TEST__!.setVisible(true);
        });

        // Allow OCR requests to complete
        await waitForHarness(page);

        const lines = await page.evaluate(() => window.__OCR_TEST__!.lines);
        expect(lines).toContain(expectedTexts.page0);
        expect(lines).toContain(expectedTexts.page1);

        const lastRequest = await page.evaluate(() => window.__OCR_TEST__!.lastRequest);
        expect(lastRequest?.payload).toMatchObject({
            manga_id: 'test-manga',
            chapter_id: 'test-chapter',
            page_index: expect.any(Number),
        });
        expect(lastRequest?.imageUrl).toMatch(/\/fixtures\/(01|02)\.jpg$/);

        // Verify that the OCR text is visible in the actual DOM (overlay in front of image)
        const overlayTexts = await page.locator('[data-ocr-text]').allTextContents();
        expect(overlayTexts.some((text) => text.includes(expectedTexts.page0))).toBe(true);
        expect(overlayTexts.some((text) => text.includes(expectedTexts.page1))).toBe(true);

        // Vertical text must be rendered as multiple inferred columns with vertical writing mode
        const verticalOrientations = await page.locator('[data-ocr-text][data-ocr-orientation="vertical"]').count();
        expect(verticalOrientations).toBeGreaterThan(0);
        const columnNodes = await page.locator('[data-ocr-column]').count();
        expect(columnNodes).toBeGreaterThan(0);

        // OCR overlay must render above the image (z-index > 0)
        const overlayZIndex = await page
            .locator('[data-ocr-overlay]')
            .first()
            .evaluate((node) => getComputedStyle(node).zIndex);
        expect(Number(overlayZIndex)).toBeGreaterThan(0);
    });

    test('persists enabled/visible settings across reloads via localStorage', async ({ page }) => {
        page.on('console', (msg) => {
            console.log(`[browser:${msg.type()}]`, msg.text());
        });
        page.on('pageerror', (err) => {
            console.log('[browser:pageerror]', err.message);
        });

        await page.goto('/');
        await page.waitForFunction(() => window.__OCR_TEST__ !== undefined);

        await page.evaluate(() => {
            window.__OCR_TEST__!.setEnabled(true);
            window.__OCR_TEST__!.setVisible(true);
            window.__OCR_TEST__!.setEndpoint('http://example.test:9999');
        });

        await page.reload();
        await page.waitForFunction(() => window.__OCR_TEST__ !== undefined);

        const persisted = await page.evaluate(() => {
            const raw = window.localStorage.getItem('ocr.settings.v1');
            return raw ? (JSON.parse(raw) as { enabled?: boolean; endpoint?: string }) : null;
        });

        expect(persisted?.enabled).toBe(true);
        expect(persisted?.endpoint).toBe('http://example.test:9999');
    });
});
