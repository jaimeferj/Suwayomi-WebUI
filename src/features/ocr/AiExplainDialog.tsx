/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useEffect, useState } from 'react';
import AutoStoriesOutlinedIcon from '@mui/icons-material/AutoStoriesOutlined';
import RecordVoiceOverOutlinedIcon from '@mui/icons-material/RecordVoiceOverOutlined';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import StyleOutlinedIcon from '@mui/icons-material/StyleOutlined';
import TranslateOutlinedIcon from '@mui/icons-material/TranslateOutlined';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useLingui } from '@lingui/react/macro';
import { useOcrStore } from '@/features/ocr/OcrStore';
import type { AiLearningAction, AiLearnResponse, AiLearningContext } from '@/features/ocr/AiApi';

export interface AiExplainDialogProps {
    open: boolean;
    text: string;
    action: AiLearningAction;
    context?: AiLearningContext;
    onActionChange: (action: AiLearningAction) => void;
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

const ACTION_ICONS: Record<AiLearningAction, React.ReactNode> = {
    translate: <TranslateOutlinedIcon />,
    grammar: <SchoolOutlinedIcon />,
    vocabulary: <AutoStoriesOutlinedIcon />,
    tone: <RecordVoiceOverOutlinedIcon />,
    cards: <StyleOutlinedIcon />,
};

export const AiExplainDialog = ({
    open,
    text,
    action,
    context,
    onActionChange,
    onClose,
}: AiExplainDialogProps) => {
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
        <Dialog
            open={open}
            onClose={onClose}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            disableRestoreFocus
            fullWidth
            maxWidth="sm"
            scroll="paper"
            data-reader-interactive="true"
        >
            <DialogTitle sx={{ pb: 1 }}>{t`AI learning`}</DialogTitle>
            <DialogContent dividers>
                <Stack sx={{ gap: 2 }}>
                    <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'action.hover' }}>
                        <Typography lang="ja" sx={{ lineHeight: 1.7 }}>
                            {text}
                        </Typography>
                    </Paper>
                    <ToggleButtonGroup
                        exclusive
                        value={action}
                        onChange={(_event, nextAction: AiLearningAction | null) => {
                            if (nextAction) {
                                onActionChange(nextAction);
                            }
                        }}
                        aria-label={t`Learning mode`}
                        sx={{
                            alignSelf: 'stretch',
                            overflowX: 'auto',
                            '& .MuiToggleButton-root': {
                                minWidth: 88,
                                minHeight: 44,
                                flex: '1 0 auto',
                                gap: 0.75,
                            },
                        }}
                    >
                        {(Object.keys(TITLES) as AiLearningAction[]).map((option) => (
                            <ToggleButton key={option} value={option} aria-label={TITLES[option]}>
                                {ACTION_ICONS[option]}
                                <Typography component="span" variant="button">
                                    {TITLES[option]}
                                </Typography>
                            </ToggleButton>
                        ))}
                    </ToggleButtonGroup>
                    <Typography variant="overline" color="text.secondary">
                        {TITLES[action]}
                    </Typography>
                    {status === 'loading' && (
                        <Stack aria-label={t`Loading AI explanation`} sx={{ gap: 1, minHeight: 180 }}>
                            <Skeleton variant="rounded" height={52} />
                            <Skeleton variant="rounded" height={72} />
                            <Skeleton variant="rounded" height={52} />
                        </Stack>
                    )}
                    {status === 'error' && <Alert severity="error">{error ?? t`AI request failed`}</Alert>}
                    {status === 'ready' && response && (
                        <Stack sx={{ gap: 2 }}>
                            {response.sections.map((section) => (
                                <Paper
                                    key={`${section.label}-${section.content}`}
                                    component="section"
                                    variant="outlined"
                                    sx={{ p: 2 }}
                                >
                                    <Typography variant="subtitle2" color="primary.main" sx={{ mb: 0.75 }}>
                                        {section.label}
                                    </Typography>
                                    <Typography variant="body2" sx={{ lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                                        {section.content}
                                    </Typography>
                                </Paper>
                            ))}
                        </Stack>
                    )}
                    {!settings.aiEnabled && (
                        <Alert severity="warning">{t`AI is disabled. Configure it in the OCR settings panel.`}</Alert>
                    )}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{t`Close`}</Button>
            </DialogActions>
        </Dialog>
    );
};
