/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useEffect, useState } from 'react';

export interface UseInViewportOptions {
    root?: Element | null;
    rootMargin?: string;
    threshold?: number | number[];
}

export function useInViewport(
    element: HTMLElement | null | undefined,
    { root = null, rootMargin = '200px 0px', threshold = 0 }: UseInViewportOptions = {},
): boolean {
    const [inView, setInView] = useState(false);

    useEffect(() => {
        if (typeof IntersectionObserver === 'undefined') {
            setInView(true);
            return () => {};
        }
        if (!element) {
            setInView(false);
            return () => {};
        }

        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[entries.length - 1];
                setInView(entry.isIntersecting);
            },
            { root, rootMargin, threshold },
        );
        observer.observe(element);
        return () => observer.disconnect();
    }, [element, root, rootMargin, JSON.stringify(threshold)]);

    return inView;
}
