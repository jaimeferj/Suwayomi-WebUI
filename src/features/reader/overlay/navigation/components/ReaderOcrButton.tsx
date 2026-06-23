/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import Checkbox from '@mui/material/Checkbox';
import TranslateIcon from '@mui/icons-material/Translate';
import CropFreeIcon from '@mui/icons-material/CropFree';
import { memo, useCallback, useState } from 'react';
import { useLingui } from '@lingui/react/macro';
import { bindMenu, bindTrigger, usePopupState } from 'material-ui-popup-state/hooks';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { useReaderOcrStore } from '@/features/reader/stores/ReaderStore.ts';
import { OcrSettingsDialog } from '@/features/ocr/OcrSettingsDialog.tsx';

const BaseReaderOcrButton = () => {
    const { t } = useLingui();
    const isVisible = useReaderOcrStore((state) => state.isVisible);
    const toggle = useReaderOcrStore((state) => state.toggleIsVisible);
    const isManualRegionMode = useReaderOcrStore((state) => state.isManualRegionMode);
    const setIsManualRegionMode = useReaderOcrStore((state) => state.setIsManualRegionMode);
    const requestRedo = useReaderOcrStore((state) => state.requestRedo);
    const popupState = usePopupState({ variant: 'popover', popupId: 'reader-ocr-menu' });
    const [settingsOpen, setSettingsOpen] = useState(false);

    const handleSelectManual = useCallback(() => {
        setIsManualRegionMode(!isManualRegionMode);
        popupState.close();
    }, [isManualRegionMode, setIsManualRegionMode, popupState]);

    const handleRedo = useCallback(() => {
        requestRedo();
        popupState.close();
    }, [requestRedo, popupState]);

    const handleSettings = useCallback(() => {
        setSettingsOpen(true);
        popupState.close();
    }, [popupState]);

    return (
        <>
            <CustomTooltip title={t`OCR menu`}>
                <IconButton {...bindTrigger(popupState)} color={isVisible ? 'primary' : 'inherit'}>
                    <TranslateIcon />
                </IconButton>
            </CustomTooltip>
            <Menu {...bindMenu(popupState)}>
                <MenuItem
                    onClick={() => {
                        toggle();
                        popupState.close();
                    }}
                >
                    <ListItemIcon>
                        <TranslateIcon />
                    </ListItemIcon>
                    <ListItemText>{isVisible ? t`Hide overlay` : t`Show overlay`}</ListItemText>
                </MenuItem>
                <MenuItem onClick={handleSelectManual}>
                    <ListItemIcon>
                        <Checkbox edge="start" checked={isManualRegionMode} tabIndex={-1} disableRipple />
                    </ListItemIcon>
                    <ListItemText>{t`Manual region mode`}</ListItemText>
                </MenuItem>
                <MenuItem onClick={handleRedo}>
                    <ListItemText inset>{t`Redo OCR for current page`}</ListItemText>
                </MenuItem>
                <MenuItem onClick={handleSettings}>
                    <ListItemIcon>
                        <CropFreeIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>{t`Settings…`}</ListItemText>
                </MenuItem>
            </Menu>
            <OcrSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </>
    );
};

export const ReaderOcrButton = memo(BaseReaderOcrButton);
