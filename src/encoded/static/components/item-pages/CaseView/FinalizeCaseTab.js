'use strict';

import React, { useCallback, useMemo, useState } from 'react';
import { VariantSampleSelectionList, FinalizeCaseDataStore, parentTabTypes } from './VariantSampleSelection';



export const FinalizeCaseTab = React.memo(function FinalizeCaseTab (props) {
    const { variantSampleListItem, schemas, context, isLoadingVariantSampleListItem = false } = props;

    return (
        <React.Fragment>
            <h1 className="text-300">
                Finalize Case
            </h1>
            <div>
                <FinalizeCaseDataStore>
                    <VariantSampleSelectionList {...{ isLoadingVariantSampleListItem, variantSampleListItem, schemas, context }}
                        parentTabType={parentTabTypes.FINALIZECASE} />
                </FinalizeCaseDataStore>
            </div>
        </React.Fragment>
    );
});