'use strict';

import React, { useRef, useEffect } from 'react';
//import { console } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { HiGlassAjaxLoadContainer } from './../components/HiGlass/HiGlassAjaxLoadContainer';

// Abandoned-for-now test of importing HiGlass from SPC - not quite working due to react-bootstrap version + symlinking-during-local-dev issues
// But to be potentially explored when time allows. More info in related PR: https://github.com/4dn-dcic/shared-portal-components/pull/42
// import { HiGlassPlainContainer } from '@hms-dbmi-bgm/shared-portal-components/es/components/viz/HiGlass/HiGlassPlainContainer';


export const BamFileBrowserTabBody = React.memo(function BamFileBrowserTabBody (props) {
    const { context, schemas, active = false } = props;
    const higlassContainerRef = useRef(null);
    const {
        file,
        CALL_INFO: bamSampleId,
        variant: {
            POS_ABS: variantPositionAbsCoord
        }
    } = context;

    useEffect(function(){
        if (!active) return;
        const hgc = higlassContainerRef.current.getHiGlassComponent();
        // hgc only exists when we visit the tab a second time
        if(hgc){
            // Force Higlass to repaint. Without this the tracks can be positioned incorrectly
            hgc.boundRefreshView();
        }
    }, [ active ]);

    function exportDisplay(){
        const hgc = higlassContainerRef.current.getHiGlassComponent();
        if (!hgc) {
            console.warn("Higlass component not found.");
            return;
        }
        const svg = hgc.api.exportAsSvg();

        var element = document.createElement('a');
        element.setAttribute('href', 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
        element.setAttribute('download', file+".svg");
        element.click();
    }

    return (
        <div className={"browser-tab-body card-body" + (!active ? " d-none" : "")}>
            <div className="row">
                <div className="col-12">
                    <div className="inner-card-section flex-grow-1 pb-2 pb-xl-1">
                        <div className="info-header-title">
                            <h4>
                                BAM File Browser
                            </h4>
                        </div>
                        <div className="info-body">
                            <div className="text-right">
                                <button type="button" className="btn btn-primary btn-sm" onClick={exportDisplay}>
                                    <i className="icon icon-download icon-sm fas mr-1"></i>Export
                                </button>
                            </div>
                            <HiGlassAjaxLoadContainer variantPositionAbsCoord={variantPositionAbsCoord} ref={higlassContainerRef} requestingTab="bam" bamSampleId={bamSampleId} file={file}/>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});
