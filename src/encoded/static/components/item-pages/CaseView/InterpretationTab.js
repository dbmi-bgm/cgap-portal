'use strict';

import React, { useCallback, useMemo, useState } from 'react';
import queryString from 'query-string';
import moment from 'moment';
import DropdownButton from 'react-bootstrap/esm/DropdownButton';
import { LocalizedTime } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/LocalizedTime';
import { Checkbox } from '@hms-dbmi-bgm/shared-portal-components/es/components/forms/components/Checkbox';
import { variantSampleColumnExtensionMap, VariantSampleDisplayTitleColumn } from './../../browse/variantSampleColumnExtensionMap';
import { VariantSampleSelection, VariantSampleSelectionList } from './VariantSampleSelection';




export const InterpretationTab = React.memo(function InterpretationTab (props) {
    const { variantSampleListItem, schemas, context, isLoadingVariantSampleListItem = false } = props;

    return (
        <React.Fragment>
            <div className="d-flex align-items-center justify-content-between mb-36">
                <h1 className="text-300 mb-0">
                    Interpretation
                </h1>
                <div>
                    <button type="button" className="btn btn-primary" disabled>
                        Export all selections as <span className="text-600">TSV spreadsheet</span>
                    </button>
                </div>
            </div>
            <div>
                <VariantSampleSelectionList {...{ isLoadingVariantSampleListItem, variantSampleListItem, schemas, context }} />
            </div>
        </React.Fragment>
    );
});
