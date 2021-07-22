'use strict';

import React, { useRef, useEffect } from 'react';
//import { console } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { HiGlassAjaxLoadContainer } from './../components/HiGlass/HiGlassAjaxLoadContainer';

// Abandoned-for-now test of importing HiGlass from SPC - not quite working due to react-bootstrap version + symlinking-during-local-dev issues
// But to be potentially explored when time allows. More info in related PR: https://github.com/4dn-dcic/shared-portal-components/pull/42
// import { HiGlassPlainContainer } from '@hms-dbmi-bgm/shared-portal-components/es/components/viz/HiGlass/HiGlassPlainContainer';


export const SvBrowserHiglass = React.memo(function SvBrowserHiglass (props) {
    const { context, schemas, active = false } = props;
    const higlassContainerRef = useRef(null);

    const {
        file,
        CALL_INFO: bamSampleId,
        structural_variant: {
            START_ABS: variantStartAbsCoord,
            END_ABS: variantEndAbsCoord,
        }
    } = context;

    useEffect(function(){
        if (!active) return;
        props.assignHGC(higlassContainerRef);
        const hgc = higlassContainerRef.current.getHiGlassComponent();
        // hgc only exists when we visit the tab a second time
        if(hgc){
            // Force Higlass to repaint. Without this the tracks can be positioned incorrectly
            hgc.boundRefreshView();
        }
    }, [ active ]);

    return (
        <div className="row">
            <div className="col-12">
                <div className="flex-grow-1 pb-2 pb-xl-1">
                    <HiGlassAjaxLoadContainer variantPositionAbsCoord={variantStartAbsCoord} variantEndAbsCoord={variantEndAbsCoord} ref={higlassContainerRef} requestingTab="sv" bamSampleId={bamSampleId} samples={props.samples} higlassSvVcf={props.higlassSvVcf} file={file}/>
                </div>
            </div>
        </div>
    );
});
