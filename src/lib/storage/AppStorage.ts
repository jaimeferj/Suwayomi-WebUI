/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/* oxlint-disable max-classes-per-file */
import { jsonSaveParse } from '@/lib/HelperFunctions.ts';

interface LocalStorageLike {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

export class Storage {
    private readonly storage: LocalStorageLike | null;

    constructor(storage: LocalStorageLike | null) {
        this.storage = storage;
    }

    parseValue<T>(value: string | null, defaultValue: T): T {
        if (value === null) {
            return defaultValue;
        }

        const parsedValue = jsonSaveParse(value);

        if (value === 'null' || value === 'undefined') {
            return parsedValue;
        }

        return parsedValue ?? (value as T);
    }

    getItem(key: string): string | null {
        return this.storage?.getItem(key) ?? null;
    }

    getItemParsed<T>(key: string, defaultValue: T): T {
        return this.parseValue(this.getItem(key), defaultValue);
    }

    setItem(key: string, value: unknown, emitEvent: boolean = true): void {
        if (!this.storage) {
            return;
        }
        const currentValue = this.getItem(key);

        const fireEvent = (valueToStore: string | undefined) => {
            if (!emitEvent) {
                return;
            }

            window.dispatchEvent(
                new StorageEvent('storage', {
                    key,
                    oldValue: currentValue,
                    newValue: valueToStore,
                }),
            );
        };

        if (value === undefined) {
            this.storage.removeItem(key);
            fireEvent(undefined);
            return;
        }

        const stringify = typeof value !== 'string';
        const valueToStore = stringify ? JSON.stringify(value) : value;

        this.storage.setItem(key, valueToStore);
        fireEvent(valueToStore as string);
    }

    setItemIfMissing(key: string, value: unknown, emitEvent?: boolean): void {
        if (this.getItem(key) === null) {
            this.setItem(key, value, emitEvent);
        }
    }
}

export class AppStorage {
    static readonly local: Storage = new Storage(typeof window !== 'undefined' ? window.localStorage : null);

    static readonly session: Storage = new Storage(typeof window !== 'undefined' ? window.sessionStorage : null);
}
