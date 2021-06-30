'use strict';

import React, { useCallback, useMemo, useState } from 'react';
import { VariantSampleSelectionList, parentTabTypes, FinalizeCaseDataStore } from './VariantSampleSelection';
import { CaseSpecificSelectionsPanel } from './variant-sample-selection-panels';



export const FinalizeCaseTab = React.memo(function FinalizeCaseTab (props) {
    const { variantSampleListItem, schemas, context, isLoadingVariantSampleListItem = false } = props;
    const commonProps = { isLoadingVariantSampleListItem, variantSampleListItem, schemas, context };

    return (
        <React.Fragment>
            <h1 className="text-300">
                Finalize Case
            </h1>
            <div>
                <FinalizeCaseDataStore>
                    <CaseSpecificSelectionsPanel {...commonProps} />
                    <VariantSampleSelectionList {...commonProps} parentTabType={parentTabTypes.FINALIZECASE} />
                </FinalizeCaseDataStore>
            </div>
        </React.Fragment>
    );
});