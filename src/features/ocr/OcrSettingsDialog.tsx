/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useLingui } from '@lingui/react/macro';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { DEFAULT_SETTINGS, useOcrStore } from '@/features/ocr/OcrStore';

export interface OcrSettingsDialogProps {
    open: boolean;
    onClose: () => void;
}

const AI_PROVIDERS = ['openai', 'ollama'] as const;
type AiProvider = (typeof AI_PROVIDERS)[number];

export const OcrSettingsDialog = ({ open, onClose }: OcrSettingsDialogProps) => {
    const { t } = useLingui();
    const settings = useOcrStore((state) => state.settings);
    const setSettings = useOcrStore((state) => state.setSettings);

    const update = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) => {
        setSettings({ [key]: value } as Partial<typeof settings>);
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>{t`OCR settings`}</DialogTitle>
            <DialogContent>
                <Stack sx={{ gap: 2, mt: 1 }}>
                    <Typography variant="subtitle2">{t`Service`}</Typography>
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={settings.enabled}
                                onChange={(_, checked) => update('enabled', checked)}
                            />
                        }
                        label={t`Enable OCR overlay`}
                    />
                    <TextField
                        label={t`Endpoint`}
                        value={settings.endpoint}
                        onChange={(e) => update('endpoint', e.target.value)}
                        size="small"
                    />
                    <TextField
                        label={t`Language`}
                        value={settings.language}
                        onChange={(e) => update('language', e.target.value)}
                        size="small"
                    />
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={settings.showOnHover}
                                onChange={(_, checked) => update('showOnHover', checked)}
                            />
                        }
                        label={t`Reveal text only on hover`}
                    />
                    <Button
                        size="small"
                        onClick={() => setSettings({ ...DEFAULT_SETTINGS })}
                        sx={{ alignSelf: 'flex-start' }}
                    >
                        {t`Reset to defaults`}
                    </Button>

                    <Divider />

                    <Typography variant="subtitle2">{t`Anki`}</Typography>
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={settings.ankiEnabled}
                                onChange={(_, checked) => update('ankiEnabled', checked)}
                            />
                        }
                        label={t`Enable Anki card creation`}
                    />
                    <TextField
                        label={t`Anki endpoint`}
                        value={settings.ankiEndpoint}
                        onChange={(e) => update('ankiEndpoint', e.target.value)}
                        size="small"
                        disabled={!settings.ankiEnabled}
                    />
                    <TextField
                        label={t`Default deck`}
                        value={settings.ankiDefaultDeck}
                        onChange={(e) => update('ankiDefaultDeck', e.target.value)}
                        size="small"
                        disabled={!settings.ankiEnabled}
                    />
                    <TextField
                        label={t`Default model`}
                        value={settings.ankiDefaultModel}
                        onChange={(e) => update('ankiDefaultModel', e.target.value)}
                        size="small"
                        disabled={!settings.ankiEnabled}
                    />
                    <TextField
                        label={t`Expression field`}
                        value={settings.ankiFieldExpression}
                        onChange={(e) => update('ankiFieldExpression', e.target.value)}
                        size="small"
                        disabled={!settings.ankiEnabled}
                    />
                    <TextField
                        label={t`Reading field (optional)`}
                        value={settings.ankiFieldReading}
                        onChange={(e) => update('ankiFieldReading', e.target.value)}
                        size="small"
                        disabled={!settings.ankiEnabled}
                    />
                    <TextField
                        label={t`Meaning field`}
                        value={settings.ankiFieldMeaning}
                        onChange={(e) => update('ankiFieldMeaning', e.target.value)}
                        size="small"
                        disabled={!settings.ankiEnabled}
                    />

                    <Divider />

                    <Typography variant="subtitle2">{t`AI`}</Typography>
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={settings.aiEnabled}
                                onChange={(_, checked) => update('aiEnabled', checked)}
                            />
                        }
                        label={t`Enable AI explanations`}
                    />
                    <TextField
                        select
                        label={t`Provider`}
                        value={settings.aiProvider}
                        onChange={(e) => update('aiProvider', e.target.value as AiProvider)}
                        size="small"
                        disabled={!settings.aiEnabled}
                    >
                        {AI_PROVIDERS.map((option) => (
                            <MenuItem key={option} value={option}>
                                {option}
                            </MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        label={t`Level`}
                        value={settings.aiLevel}
                        onChange={(e) => update('aiLevel', e.target.value)}
                        size="small"
                        disabled={!settings.aiEnabled}
                    />
                    <Box>
                        <Typography variant="caption" color="text.secondary">
                            {t`Keys are stored server-side in the learning service; nothing is exposed to the browser.`}
                        </Typography>
                    </Box>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{t`Close`}</Button>
            </DialogActions>
        </Dialog>
    );
};
