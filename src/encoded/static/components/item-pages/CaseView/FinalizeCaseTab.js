'use strict';

import React, { useCallback, useMemo, useState } from 'react';
import queryString from 'query-string';
import moment from 'moment';
import DropdownButton from 'react-bootstrap/esm/DropdownButton';
import { LocalizedTime } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/LocalizedTime';
import { Checkbox } from '@hms-dbmi-bgm/shared-portal-components/es/components/forms/components/Checkbox';
import { variantSampleColumnExtensionMap, VariantSampleDisplayTitleColumn } from './../../browse/variantSampleColumnExtensionMap';
import { VariantSampleSelection, VariantSampleSelectionList, parentTabTypes } from './VariantSampleSelection';



export const FinalizeCaseTab = React.memo(function FinalizeCaseTab (props) {
    const { variantSampleListItem, schemas, context, isLoadingVariantSampleListItem = false } = props;

    return (
        <React.Fragment>
            <h1 className="text-300">
                Finalize Case
            </h1>
            <div>
                <VariantSampleSelectionList {...{ isLoadingVariantSampleListItem, variantSampleListItem, schemas, context }}
                    parentTabType={parentTabTypes.FINALIZECASE} />
            </div>
        </React.Fragment>
    );
});