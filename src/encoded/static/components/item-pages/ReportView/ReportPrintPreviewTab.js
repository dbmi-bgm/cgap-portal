'use strict';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import { console, layout, ajax } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { DeferMount } from './../../util/layout';
import { ReportPrintPreviewPane } from './ReportPrintPreviewPane';

/** @todo Get this from Project Item, perhaps AJAX loading it in along with Case in ReportPrintPreviewTab */
import { projectReportSettings } from './project-settings-draft';

/**
 * @todo Code-split out ReportPrintPreviewPane and load dynamically.
 */
export function ReportPrintPreviewTab (props){
    const { context: report } = props;
    const { case: { "@id": caseAtID } } = report;
    const [ loadedCaseItem, setLoadedCaseItem ] = useState(null);
    const [ isPrintPreviewReady, setIsPrintPreviewReady ] = useState(false);

    /** Load in Case item */
    useEffect(function(){
        /** @todo Consider using /embed if we need non-indexed immediate DB values. Else leave as-is. */
        ajax.load(caseAtID, function(resp){
            setLoadedCaseItem(resp);
        });
        /** @todo Load Project info/settings here? Or embed from `report.project` instead? */
    }, []);

    const onPrintPreviewReady = useCallback(function(){
        setIsPrintPreviewReady(true);
    }, []);

    console.log("CASE ITEM", loadedCaseItem);

    return (
        <React.Fragment>
            <h3 className="tab-section-title container-wide">
                <span>
                    Print Preview
                </span>
                <div className="controls">
                    <PrintPageButton disabled={!isPrintPreviewReady} />
                </div>
            </h3>
            <hr className="tab-section-title-horiz-divider"/>
            <div className="container-wide print-preview-tab-container bg-light py-3 mh-inner-tab-height-full">
                <DeferMount delay={400}>
                    <ReportPrintPreviewPane {...{ report, onPrintPreviewReady }} caseItem={loadedCaseItem} reportSettings={projectReportSettings} />
                </DeferMount>
            </div>
        </React.Fragment>
    );
}
ReportPrintPreviewTab.getTabObject = function(props) {
    return {
        'tab' : (
            <React.Fragment>
                <i className="icon icon-file-alt far icon-fw"/>
                <span>Preview</span>
            </React.Fragment>
        ),
        'key' : 'preview',
        'content' : <ReportPrintPreviewTab {...props} />
    };
};

/** @todo Put this in same place as future location of PrintPreviewPane */
function PrintPageButton(props){
    const {
        className = "btn btn-primary",
        children = <React.Fragment><i className="icon icon-print fas mr-08"/>Print</React.Fragment>,
        disabled = false
    } = props;
    const onClick = useCallback(function(e){
        e.stopPropagation();
        const btnElem = e.target;
        btnElem.disabled = true;
        window.print(); // Blocks UI JS thread until print dialog is closed.
        btnElem.disabled = disabled || false;
    });
    return (
        // TODO: Maybe make disabled until PrintPreviewPane fully initialized.
        <button type="button" {...{ className, onClick, disabled }}>
            { children }
        </button>
    );
}

