'use strict';

import React, { useCallback, useMemo, useState } from 'react';
import DropdownButton from 'react-bootstrap/esm/DropdownButton';
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
                    <ExportInterpretationSpreadsheetButton {...{ variantSampleListItem }} />
                </div>
            </div>
            <div>
                <VariantSampleSelectionList {...{ isLoadingVariantSampleListItem, variantSampleListItem, schemas, context }} />
            </div>
        </React.Fragment>
    );
});


const ExportInterpretationSpreadsheetButton = React.memo(function ExportInterpretationSpreadsheetButton({ variantSampleListItem }) {
    const { "@id": atId, variant_samples: vsObjects = [] } = variantSampleListItem || {};
    const baseHref = atId + "/@@spreadsheet/";
    return (
        <DropdownButton variant="primary" disabled={vsObjects.length === 0} title="Export as...">
            <a href={baseHref + "?file_format=tsv"} target="_blank" rel="noopener noreferrer" className="dropdown-item" role="button" download>
                <span className="text-600">TSV</span> spreadsheet
            </a>
            <a href={baseHref + "?file_format=csv"} target="_blank" rel="noopener noreferrer" className="dropdown-item" role="button" download>
                <span className="text-600">CSV</span> spreadsheet
            </a>
            <a href="#" className="dropdown-item disabled" target="_blank" rel="noopener noreferrer" role="button">
                <span className="text-600">XLSX</span> spreadsheet
            </a>
        </DropdownButton>
    );
});
