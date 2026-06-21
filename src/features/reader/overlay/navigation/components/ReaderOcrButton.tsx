/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import IconButton from '@mui/material/IconButton';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import TextFieldsOutlinedIcon from '@mui/icons-material/TextFieldsOutlined';
import { memo } from 'react';
import { useLingui } from '@lingui/react/macro';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { useReaderOcrStore } from '@/features/reader/stores/ReaderStore.ts';

const BaseReaderOcrButton = () => {
    const { t } = useLingui();
    const isVisible = useReaderOcrStore((state) => state.isVisible);
    const toggle = useReaderOcrStore((state) => state.toggleIsVisible);

    return (
        <CustomTooltip title={t`Toggle OCR overlay`}>
            <IconButton onClick={toggle} color={isVisible ? 'primary' : 'inherit'}>
                {isVisible ? <TextFieldsIcon /> : <TextFieldsOutlinedIcon />}
            </IconButton>
        </CustomTooltip>
    );
};

export const ReaderOcrButton = memo(BaseReaderOcrButton);
