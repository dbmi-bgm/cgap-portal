'use strict';

import React, { useRef, useEffect } from 'react';
import { SvBrowser } from './SvBrowser';


export const SvBrowserTabBody = React.memo(function SvBrowserTabBody (props) {
    const { context, schemas, active = false } = props;

    return (
        <div className={"browser-tab-body card-body" + (!active ? " d-none" : "")}>
            <div className="row">
                <div className="col-12">
                    <div className="inner-card-section flex-grow-1 pb-2 pb-xl-1">
                        <div className="info-header-title">
                            <h4>
                                Structural Variant Browser
                            </h4>
                        </div>
                        <div className="info-body">
                            <SvBrowser {...props}/>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

});
