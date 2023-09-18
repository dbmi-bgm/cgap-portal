'use strict';

import React, { useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import DropdownButton from "react-bootstrap/esm/DropdownButton";
import DropdownItem from "react-bootstrap/esm/DropdownItem";

/**
 * Renders a form element with dropdown button.
 * Upon click, this component updates form element attributes
 * and hidden input elements in response to dropdown option clicked,
 * and then submits form.
 */
export const ExportSearchSpreadsheetButton = React.memo(function ExportSearchSpreadsheetButton(props){
    const { requestedCompoundFilterSet, caseItem, disabled: propDisabled = false } = props;
    const { accession: caseAccession, case_title = null } = caseItem || {};
    const formRef = useRef(null);
    const onSelect = useCallback(function(eventKey, e){
        // input[name="file_format"]
        formRef.current.children[0].value = eventKey;
        // `requestedCompoundFilterSet` passed in from VirtualHrefController of the EmbeddedSearchView
        // input[name="compound_search_request"]
        formRef.current.children[1].value = JSON.stringify(requestedCompoundFilterSet);
        formRef.current.submit();
        return false;
    }, [ formRef, requestedCompoundFilterSet ]);

    const disabled = propDisabled || !requestedCompoundFilterSet; // TODO: Check if >0 results, as well.

    return (
        // target=_blank causes new tab to open (and then auto-close), but bypasses the isSubmitting onBeforeUnload check in app.js
        <form method="POST" className="mb-0" action="/variant-sample-search-spreadsheet/" target="_blank" ref={formRef} disabled={disabled}>
            <input type="hidden" name="file_format" />
            <input type="hidden" name="compound_search_request" />
            <input type="hidden" name="case_accession" value={caseAccession} />
            <input type="hidden" name="case_title" value={case_title} />
            <DropdownButton variant="outline-primary" title="Export results as..." onSelect={onSelect} disabled={disabled}>
                <DropdownItem eventKey="tsv">
                    <span className="text-600">TSV</span> spreadsheet
                </DropdownItem>
                <DropdownItem eventKey="csv">
                    <span className="text-600">CSV</span> spreadsheet
                </DropdownItem>
                <DropdownItem eventKey="xlsx" disabled>
                    <span className="text-600">XLSX</span> spreadsheet
                </DropdownItem>
            </DropdownButton>
        </form>
    );
});
