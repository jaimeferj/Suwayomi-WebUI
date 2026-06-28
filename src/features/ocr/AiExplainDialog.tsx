/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useEffect, useState } from 'react';
import AutoStoriesOutlinedIcon from '@mui/icons-material/AutoStoriesOutlined';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import RecordVoiceOverOutlinedIcon from '@mui/icons-material/RecordVoiceOverOutlined';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import StyleOutlinedIcon from '@mui/icons-material/StyleOutlined';
import TranslateOutlinedIcon from '@mui/icons-material/TranslateOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
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

const PANEL_WIDTH_STORAGE_KEY = 'ocr.ai-panel-width.v1';
const PANEL_COLLAPSED_STORAGE_KEY = 'ocr.ai-panel-collapsed.v1';
const DEFAULT_PANEL_WIDTH = 420;
const MIN_PANEL_WIDTH = 320;
const MAX_PANEL_WIDTH = 720;
const COLLAPSED_PANEL_WIDTH = 56;

const clampPanelWidth = (width: number) =>
    Math.min(Math.max(width, MIN_PANEL_WIDTH), Math.min(MAX_PANEL_WIDTH, window.innerWidth));

const loadPanelWidth = () => {
    if (typeof window === 'undefined') {
        return DEFAULT_PANEL_WIDTH;
    }
    const storedWidth = Number(window.localStorage.getItem(PANEL_WIDTH_STORAGE_KEY));
    return clampPanelWidth(Number.isFinite(storedWidth) && storedWidth > 0 ? storedWidth : DEFAULT_PANEL_WIDTH);
};

const loadPanelCollapsed = () =>
    typeof window !== 'undefined' && window.localStorage.getItem(PANEL_COLLAPSED_STORAGE_KEY) === 'true';

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

export const AiExplainDialog = ({ open, text, action, context, onActionChange, onClose }: AiExplainDialogProps) => {
    const { t } = useLingui();
    const settings = useOcrStore((state) => state.settings);
    const aiApi = useOcrStore((state) => state.aiApi);
    const [status, setStatus] = useState<Status>('idle');
    const [response, setResponse] = useState<AiLearnResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState(0);
    const [panelWidth, setPanelWidth] = useState(loadPanelWidth);
    const [collapsed, setCollapsed] = useState(loadPanelCollapsed);
    const [resizing, setResizing] = useState(false);

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
    }, [open, text, action, context, settings.aiEnabled, settings.aiLevel, aiApi, retryCount]);

    useEffect(() => {
        if (!resizing) {
            return undefined;
        }

        const handlePointerMove = (event: PointerEvent) => {
            const nextWidth = clampPanelWidth(window.innerWidth - event.clientX);
            setPanelWidth(nextWidth);
            window.localStorage.setItem(PANEL_WIDTH_STORAGE_KEY, String(nextWidth));
        };
        const handlePointerUp = () => {
            setResizing(false);
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp, { once: true });
        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, [resizing]);

    const setPanelCollapsed = (nextCollapsed: boolean) => {
        setCollapsed(nextCollapsed);
        window.localStorage.setItem(PANEL_COLLAPSED_STORAGE_KEY, String(nextCollapsed));
    };

    return (
        <Drawer
            anchor="right"
            open={open}
            variant="persistent"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            slotProps={{
                paper: {
                    role: 'complementary',
                    'aria-label': t`AI learning panel`,
                    sx: {
                        width: collapsed ? COLLAPSED_PANEL_WIDTH : panelWidth,
                        maxWidth: '100vw',
                        overflow: 'visible',
                        transition: (theme) =>
                            theme.transitions.create('width', {
                                duration: theme.transitions.duration.shorter,
                            }),
                    },
                },
            }}
            data-reader-interactive="true"
        >
            <Box
                role="separator"
                aria-label={t`Resize AI learning panel`}
                aria-orientation="vertical"
                hidden={collapsed}
                onPointerDown={(event) => {
                    event.preventDefault();
                    setResizing(true);
                }}
                sx={{
                    position: 'absolute',
                    insetBlock: 0,
                    insetInlineStart: -4,
                    width: 8,
                    cursor: 'col-resize',
                    touchAction: 'none',
                    zIndex: 1,
                    '&:hover': { bgcolor: 'primary.main' },
                }}
            />
            {collapsed ? (
                <IconButton
                    onClick={() => setPanelCollapsed(false)}
                    aria-label={t`Expand AI learning panel`}
                    sx={{ m: 0.75 }}
                >
                    <ChevronLeftIcon />
                </IconButton>
            ) : (
                <Stack sx={{ height: '100%', minHeight: 0 }}>
                    <Stack
                        direction="row"
                        sx={{
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            py: 1,
                            px: 2,
                            borderBottom: 1,
                            borderColor: 'divider',
                        }}
                    >
                        <Typography variant="h6">{t`AI learning`}</Typography>
                        <Stack direction="row">
                            <IconButton
                                onClick={() => setPanelCollapsed(true)}
                                aria-label={t`Collapse AI learning panel`}
                            >
                                <ChevronRightIcon />
                            </IconButton>
                            <IconButton onClick={onClose} aria-label={t`Close AI learning panel`}>
                                <CloseIcon />
                            </IconButton>
                        </Stack>
                    </Stack>
                    <Stack sx={{ gap: 2, p: 2, overflowY: 'auto' }}>
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
                                display: 'grid',
                                gridTemplateColumns: {
                                    xs: 'repeat(2, minmax(0, 1fr))',
                                    sm: 'repeat(5, minmax(0, 1fr))',
                                },
                                gap: 1,
                                '& .MuiToggleButton-root': {
                                    minWidth: 0,
                                    minHeight: 44,
                                    gap: 0.75,
                                    border: 1,
                                    borderColor: 'divider',
                                    borderRadius: 2,
                                },
                                '& .MuiToggleButton-root:nth-of-type(5)': {
                                    gridColumn: { xs: '1 / -1', sm: 'auto' },
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
                        {status === 'error' && (
                            <Alert
                                severity="error"
                                action={
                                    <Button
                                        color="inherit"
                                        size="small"
                                        onClick={() => setRetryCount((count) => count + 1)}
                                    >
                                        {t`Retry`}
                                    </Button>
                                }
                            >
                                {error ?? t`AI request failed`}
                            </Alert>
                        )}
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
                </Stack>
            )}
        </Drawer>
    );
};
