'use strict';

import React from 'react';
import DropdownButton from 'react-bootstrap/esm/DropdownButton';
import { VariantSampleSelectionList } from './VariantSampleSelection';




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


const ExportInterpretationSpreadsheetButton = React.memo(function ExportInterpretationSpreadsheetButton({ variantSampleListItem, context }) {
    // const { accession: caseAccession } = context; // Case Item
    const { "@id": atId, variant_samples: vsObjects = [] } = variantSampleListItem || {};
    const baseHref = atId + "/@@spreadsheet/?file_format=";
    return (
        <DropdownButton variant="outline-primary" disabled={vsObjects.length === 0}
            title={
                <span>
                    <i className="icon icon-table fas mr-1"/>
                    Export As...
                </span>
            }>
            <a href={baseHref + "tsv"} target="_blank" rel="noopener noreferrer" className="dropdown-item" role="button" download>
                <span className="text-600">TSV</span> spreadsheet
            </a>
            <a href={baseHref + "csv"} target="_blank" rel="noopener noreferrer" className="dropdown-item" role="button" download>
                <span className="text-600">CSV</span> spreadsheet
            </a>
            <a href="#" className="dropdown-item disabled" target="_blank" rel="noopener noreferrer" role="button">
                <span className="text-600">XLSX</span> spreadsheet
            </a>
        </DropdownButton>
    );
});
