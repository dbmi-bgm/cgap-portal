'use strict';

import React from 'react';


export class SvSampleTabBody extends React.Component {

    render() {
        return (
            <div className="sample-tab-body card-body">
                <div className="row flex-column flex-lg-row">
                    <div className="inner-card-section col pb-2 pb-lg-0">
                        <div className="info-header-title">
                            <h4>Quality</h4>
                        </div>
                        <div className="info-body"></div>
                    </div>
                </div>
                <div className="row flex-column flex-lg-row">
                    <div className="inner-card-section col pb-2 pb-lg-0">
                        <div className="info-header-title">
                            <h4>Genotype Quality</h4>
                        </div>
                        <div className="info-body"></div>
                    </div>
                </div>
            </div>
        );
    }
}