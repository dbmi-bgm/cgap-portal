'use strict';

import React from 'react';
//import { console } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { HiGlassAjaxLoadContainer } from './../components/HiGlass/HiGlassAjaxLoadContainer';

// Abandoned-for-now test of importing HiGlass from SPC - not quite working due to react-bootstrap version + symlinking-during-local-dev issues
// But to be potentially explored when time allows. More info in related PR: https://github.com/4dn-dcic/shared-portal-components/pull/42
// import { HiGlassPlainContainer } from '@hms-dbmi-bgm/shared-portal-components/es/components/viz/HiGlass/HiGlassPlainContainer';


export const BrowserTabBody = React.memo(function BrowserTabBody ({ context, schemas }) {

    const higlassContainerRef = React.createRef(); // I'm not sure is safe
    const variantPositionAbsCoord = context.variant.POS_ABS;

    return (
        <div className="browser-tab-body card-body">
            <div className="row">
                <div className="col-12">
                    <div className="inner-card-section flex-grow-1 pb-2 pb-xl-1">
                        <div className="info-header-title">
                            <h4>
                                HiGlass Browser
                            </h4>
                        </div>
                        <div className="info-body">
                            <HiGlassAjaxLoadContainer variantPositionAbsCoord={variantPositionAbsCoord} ref={higlassContainerRef} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});
