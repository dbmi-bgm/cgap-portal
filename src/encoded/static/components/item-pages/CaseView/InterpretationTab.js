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
                    <ExportSpreadsheetButton {...{ variantSampleListItem }} />
                </div>
            </div>
            <div>
                <VariantSampleSelectionList {...{ isLoadingVariantSampleListItem, variantSampleListItem, schemas, context }} />
            </div>
        </React.Fragment>
    );
});


const ExportSpreadsheetButton = React.memo(function ExportSpreadsheetButton({ variantSampleListItem }) {
    const { "@id": atId, variant_samples: vsObjects = [] } = variantSampleListItem || {};
    const baseHref = "/variant-sample-list-spreadsheet/?variant_sample_list_id=" + encodeURIComponent(atId);
    return (
        <DropdownButton variant="primary" disabled={vsObjects.length === 0} title="Export as...">
            {/* Testing -- }
            <form method="POST" action={baseHref + "&file_format=tsv"} className="d-inline-block">
                <button type="submit" className="dropdown-item" role="button" download>
                    <span className="text-600">TSV</span> spreadsheet
                </button>
            </form>
            */}
            <a href={baseHref + "&file_format=tsv"} target="_blank" rel="noopener noreferrer" className="dropdown-item" role="button" download>
                <span className="text-600">TSV</span> spreadsheet
            </a>
            <a href={baseHref + "&file_format=csv"} target="_blank" rel="noopener noreferrer" className="dropdown-item" role="button" download>
                <span className="text-600">CSV</span> spreadsheet
            </a>
            <a href="#" className="dropdown-item disabled" target="_blank" rel="noopener noreferrer" role="button">
                <span className="text-600">XLSX</span> spreadsheet
            </a>
        </DropdownButton>
    );
});
