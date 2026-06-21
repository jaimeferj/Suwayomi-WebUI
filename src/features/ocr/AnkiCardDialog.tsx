/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useEffect, useMemo, useState } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useLingui } from '@lingui/react/macro';
import { useOcrStore } from '@/features/ocr/OcrStore';
import type { AnkiCreateCardResponse } from '@/features/ocr/AnkiApi';

export interface AnkiCardDialogProps {
    open: boolean;
    onClose: (result?: AnkiCreateCardResponse) => void;
    initialText: string;
    initialReading?: string;
    initialMeaning?: string;
    mangaTitle?: string;
    chapterTitle?: string;
    pageIndex?: number;
}

export const AnkiCardDialog = ({
    open,
    onClose,
    initialText,
    initialReading = '',
    initialMeaning = '',
    mangaTitle,
    chapterTitle,
    pageIndex,
}: AnkiCardDialogProps) => {
    const { t } = useLingui();
    const settings = useOcrStore((state) => state.settings);
    const ankiApi = useOcrStore((state) => state.ankiApi);

    const initialFields = useMemo(() => {
        const fields: Record<string, string> = {};
        if (settings.ankiFieldExpression) {
            fields[settings.ankiFieldExpression] = initialText;
        }
        if (settings.ankiFieldReading) {
            fields[settings.ankiFieldReading] = initialReading;
        }
        if (settings.ankiFieldMeaning) {
            fields[settings.ankiFieldMeaning] = initialMeaning;
        }
        const source = [mangaTitle, chapterTitle, pageIndex !== undefined ? `p${pageIndex + 1}` : '']
            .filter(Boolean)
            .join(' — ');
        if (source) {
            fields['Source'] = source;
        }
        return fields;
    }, [initialText, initialReading, initialMeaning, mangaTitle, chapterTitle, pageIndex, settings]);

    const [deck, setDeck] = useState(settings.ankiDefaultDeck);
    const [model, setModel] = useState(settings.ankiDefaultModel);
    const [tags, setTags] = useState('manga');
    const [fields, setFields] = useState<Record<string, string>>(initialFields);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setFields(initialFields);
            setDeck(settings.ankiDefaultDeck);
            setModel(settings.ankiDefaultModel);
            setError(null);
        }
    }, [open, initialFields, settings.ankiDefaultDeck, settings.ankiDefaultModel]);

    const handleClose = () => {
        if (submitting) {
            return;
        }
        onClose();
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        setError(null);
        try {
            const tagList = tags
                .split(',')
                .map((tag) => tag.trim())
                .filter(Boolean);
            const response = await ankiApi.createCard({
                deck,
                model,
                fields,
                tags: tagList,
            });
            onClose(response);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
            <DialogTitle>{t`Create Anki card`}</DialogTitle>
            <DialogContent>
                <Stack sx={{ gap: 2, mt: 1 }}>
                    <TextField label={t`Deck`} value={deck} onChange={(e) => setDeck(e.target.value)} size="small" />
                    <TextField label={t`Model`} value={model} onChange={(e) => setModel(e.target.value)} size="small" />
                    <TextField
                        label={t`Tags (comma-separated)`}
                        value={tags}
                        onChange={(e) => setTags(e.target.value)}
                        size="small"
                    />
                    {Object.entries(fields).map(([name, value]) => (
                        <TextField
                            key={name}
                            label={name}
                            value={value}
                            onChange={(e) => setFields((prev) => ({ ...prev, [name]: e.target.value }))}
                            multiline
                            minRows={1}
                            maxRows={6}
                            size="small"
                        />
                    ))}
                    {error && <Stack sx={{ color: 'error.main', typography: 'body2' }}>{error}</Stack>}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose} disabled={submitting}>
                    {t`Cancel`}
                </Button>
                <Button onClick={handleSubmit} disabled={submitting || !settings.ankiEnabled} variant="contained">
                    {t`Create`}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
