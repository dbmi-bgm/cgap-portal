import React from 'react';

export const BrowserTabBody = React.memo(
    function BrowserTabBody ({ context, schemas }) {
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
                            <div className="info-body font-italic text-large text-center">
                                Coming Soon
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    });