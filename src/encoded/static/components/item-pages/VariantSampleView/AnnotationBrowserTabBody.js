'use strict';

import React, { useRef, useEffect } from 'react';
//import { console } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { HiGlassAjaxLoadContainer } from './../components/HiGlass/HiGlassAjaxLoadContainer';

// Abandoned-for-now test of importing HiGlass from SPC - not quite working due to react-bootstrap version + symlinking-during-local-dev issues
// But to be potentially explored when time allows. More info in related PR: https://github.com/4dn-dcic/shared-portal-components/pull/42
// import { HiGlassPlainContainer } from '@hms-dbmi-bgm/shared-portal-components/es/components/viz/HiGlass/HiGlassPlainContainer';


export const AnnotationBrowserTabBody = React.memo(function AnnotationBrowserTabBody (props) {
    const { context, schemas, active = false } = props;
    const higlassContainerRef = useRef(null);
    const {
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

    return (
        <div className={"browser-tab-body card-body" + (!active ? " d-none" : "")}>
            <div className="row">
                <div className="col-12">
                    <div className="inner-card-section flex-grow-1 pb-2 pb-xl-1">
                        <div className="info-header-title">
                            <h4>
                                HiGlass Browser
                            </h4>
                        </div>
                        <div className="info-body">
                            <HiGlassAjaxLoadContainer variantPositionAbsCoord={variantPositionAbsCoord} ref={higlassContainerRef} requestingTab="annotation" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});
