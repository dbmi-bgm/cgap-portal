'use strict';

import React from 'react';
import PropTypes from 'prop-types';


export function SampleTabBody(props){
    console.log("sampleTabBodyProps", props);
    return (
        <div className="variant-tab-body card-body">
            <div className="row">
                <div className="col-8 col-md-9 d-flex">
                    <div className="pb-2">
                        <div className="info-header-title">
                            <h4>
                                {/* todo link to GnomAD -- is there a gnomad link somewhere ? */}
                                Quality
                            </h4>
                        </div>
                        <div className="info-body overflow-auto">
                            <QualityTable />
                        </div>
                    </div>
                </div>
                <div className="col-4 col-md-3 d-flex justify-content-center">
                    <div className="pb-2">
                        <div className="info-header-title">
                            <h4>
                                {/* todo link to GnomAD -- is there a gnomad link somewhere ? */}
                                BAM Snapshot
                            </h4>
                        </div>
                        <div className="info-body overflow-auto">
                            View BAM Snapshot
                            <a href="#" className="d-block pt-2" style={{ textAlign: "center", margin: "0 auto" }}>
                                <i className="icon icon-fw icon-2x icon-external-link-alt fas" />
                            </a>
                        </div>
                    </div>
                </div>
            </div>
            <div className="row">
                <div className="col-12 col-md-12 d-flex">
                    <div className="pb-2">
                        <div className="info-header-title">
                            <h4>
                                {/* todo link to GnomAD -- is there a gnomad link somewhere ? */}
                                Coverage
                            </h4>
                        </div>
                        <div className="info-body overflow-auto">
                            TODO
                        </div>
                    </div>
                </div>
            </div>
            <div className="row">
                <div className="col-12 col-md-12 d-flex">
                    <div className="pb-2">
                        <div className="info-header-title">
                            <h4>
                                {/* todo link to GnomAD -- is there a gnomad link somewhere ? */}
                                Inheritance Mode
                            </h4>
                        </div>
                        <div className="info-body overflow-auto">
                            TODO
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}


function QualityTable(){
    return (
        <table className="w-100">
            <thead>
                <tr>
                    <th className="text-left">Quality</th>
                    <th className="text-left">Score</th>
                    <th className="text-left">Definition</th>
                </tr>
            </thead>
            <tbody>
                <tr className="border-top">
                    <td className="text-600 text-left">Variant Quality</td>
                    <td className="text-left">35.86</td>
                    <td className="text-left">phred-scaled quality score for assertion made in ALT (multi-sample)</td>
                </tr>
                <tr>
                    <td className="text-600 text-left">Genotype Quality</td>
                    <td className="text-left">44</td>
                    <td className="text-left">phred-scaled quality score that the genotype is accurate [min(99,PL(max)-PL(second))]</td>
                </tr>
                <tr>
                    <td className="text-600 text-left">Genotype Likelihoods(0/0,0/1,1/1)</td>
                    <td className="text-left">44,9,529</td>
                    <td className="text-left">phred-scaled likelihoods for genotype (Ref/Ref, Ref/Alt, Alt/Alt)</td>
                </tr>
                <tr>
                    <td className="text-600 text-left">Strand Fisher Score</td>
                    <td className="text-left">0.5</td>
                    <td className="text-left">Fisher strand score</td>
                </tr>
            </tbody>
        </table>
    );
}