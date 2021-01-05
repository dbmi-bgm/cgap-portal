'use strict';

import React, { useRef } from 'react';
//import { console } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { HiGlassAjaxLoadContainer } from './../components/HiGlass/HiGlassAjaxLoadContainer';

// Abandoned-for-now test of importing HiGlass from SPC - not quite working due to react-bootstrap version + symlinking-during-local-dev issues
// But to be potentially explored when time allows. More info in related PR: https://github.com/4dn-dcic/shared-portal-components/pull/42
// import { HiGlassPlainContainer } from '@hms-dbmi-bgm/shared-portal-components/es/components/viz/HiGlass/HiGlassPlainContainer';


export const BamFileBrowserTabBody = React.memo(function BamFileBrowserTabBody ({ context, schemas }) {

    const higlassContainerRef = useRef(null);
    const variantPositionAbsCoord = context.variant.POS_ABS;
    const bamSampleId = context.CALL_INFO;
    const file = context.file;

    return (
        <div className="browser-tab-body card-body">
            <div className="row">
                <div className="col-12">
                    <div className="inner-card-section flex-grow-1 pb-2 pb-xl-1">
                        <div className="info-header-title">
                            <h4>
                                BAM File Viewer
                            </h4>
                        </div>
                        <div className="info-body">
                            <HiGlassAjaxLoadContainer variantPositionAbsCoord={variantPositionAbsCoord} ref={higlassContainerRef} requestingTab="bam" bamSampleId={bamSampleId} file={file}/>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});
