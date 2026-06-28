/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useLingui } from '@lingui/react/macro';
import { useOcrStore } from '@/features/ocr/OcrStore';
import type { AiLearningAction, AiLearnResponse, AiLearningContext } from '@/features/ocr/AiApi';

export interface AiExplainDialogProps {
    open: boolean;
    text: string;
    action: AiLearningAction;
    context?: AiLearningContext;
    onClose: () => void;
}

type Status = 'idle' | 'loading' | 'ready' | 'error';

const TITLES: Record<AiLearningAction, string> = {
    translate: 'Translate',
    grammar: 'Grammar',
    vocabulary: 'Vocabulary',
    tone: 'Tone / Speech',
    cards: 'Cards',
};

export const AiExplainDialog = ({ open, text, action, context, onClose }: AiExplainDialogProps) => {
    const { t } = useLingui();
    const settings = useOcrStore((state) => state.settings);
    const aiApi = useOcrStore((state) => state.aiApi);
    const [status, setStatus] = useState<Status>('idle');
    const [response, setResponse] = useState<AiLearnResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open || !settings.aiEnabled || !text) {
            return;
        }
        let cancelled = false;
        setStatus('loading');
        setError(null);
        setResponse(null);
        aiApi
            .learn({
                sentence: text,
                action,
                context,
                level: settings.aiLevel,
            })
            .then((result) => {
                if (cancelled) {
                    return;
                }
                setResponse(result);
                setStatus('ready');
            })
            .catch((err: unknown) => {
                if (cancelled) {
                    return;
                }
                setError(err instanceof Error ? err.message : String(err));
                setStatus('error');
            });
        return () => {
            cancelled = true;
        };
    }, [open, text, action, context, settings.aiEnabled, settings.aiLevel, aiApi]);

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>{TITLES[action]}</DialogTitle>
            <DialogContent>
                <Stack sx={{ gap: 2, mt: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                        {text}
                    </Typography>
                    {status === 'loading' && (
                        <Stack sx={{ alignItems: 'center', py: 2 }}>
                            <CircularProgress size={24} />
                        </Stack>
                    )}
                    {status === 'error' && (
                        <Typography color="error.main" variant="body2">
                            {error ?? t`AI request failed`}
                        </Typography>
                    )}
                    {status === 'ready' && response && (
                        <Stack sx={{ gap: 2 }}>
                            {response.sections.map((section) => (
                                <Box key={`${section.label}-${section.content}`}>
                                    <Typography variant="subtitle2">{section.label}</Typography>
                                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                                        {section.content}
                                    </Typography>
                                </Box>
                            ))}
                        </Stack>
                    )}
                    {!settings.aiEnabled && (
                        <Typography color="warning.main" variant="body2">
                            {t`AI is disabled. Configure it in the OCR settings panel.`}
                        </Typography>
                    )}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{t`Close`}</Button>
            </DialogActions>
        </Dialog>
    );
};
