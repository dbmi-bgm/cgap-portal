'use strict';

import React from 'react';


export function SvSampleTabBody(props){
    const { context = {} } = props;
    return (
        <div className="sample-tab-body card-body">
            <div className="row flex-column flex-lg-row">
                <div className="inner-card-section col pb-2 pb-lg-0">
                    <div className="info-header-title">
                        <h4>Breakpoint Confidence Intervals</h4>
                    </div>
                    <div className="info-body">
                        <SvQualityTable {...{ context }} />
                    </div>
                </div>
            </div>
            <div className="row flex-column flex-lg-row">
                <div className="inner-card-section col mt-2 pb-2 pb-lg-0">
                    <div className="info-header-title">
                        <h4>Genotype</h4>
                    </div>
                    <div className="info-body">
                        <GenotypeQualityTable {...{ context }} />
                    </div>
                </div>
            </div>
        </div>
    );
}


function SvQualityTable(props) {
    const {
        context: {
            confidence_interval_start = [],
            confidence_interval_end = [],
            imprecise = null
        } = {},
    } = props;
    const fallbackElem = <em> - </em>;

    const startExists = confidence_interval_start.length > 0;
    const endExists = confidence_interval_end.length > 0;

    const impreciseDisplay = imprecise === false ? "Imprecise" : imprecise === true ? "Precise" : fallbackElem;
    return (
        <table className="w-100">
            <thead>
                <tr>
                    <th className="text-left w-50">Quality</th>
                    <th className="text-left">Value</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td className="text-600 text-left">Precise/Imprecise</td>
                    <td className="text-left">{impreciseDisplay}</td>
                </tr>
                <tr>
                    <td className="text-600 text-left">Confidence interval around left breakpoint</td>
                    <td className="text-left">{startExists ? confidence_interval_start.join(", "): fallbackElem}</td>
                </tr>
                <tr>
                    <td className="text-600 text-left">Confidence interval around right breakpoint</td>
                    <td className="text-left">{endExists ? confidence_interval_end.join(", "): fallbackElem}</td>
                </tr>
            </tbody>
        </table>
    );
}


// TODO: Update with Genotype Quality & Likelihoods when fields are available
function GenotypeQualityTable(props) {
    const { context: { samplegeno = [] } = {} } = props;
    const fallbackElem = <em> - </em>;

    const rows = samplegeno.map((sg) => {
        const {
            samplegeno_role = fallbackElem,
            samplegeno_numgt = fallbackElem,
            samplegeno_sampleid = fallbackElem,
            samplegeno_quality = fallbackElem,
            samplegeno_likelihood = fallbackElem
        } = sg;

        return (
            <tr key={samplegeno_sampleid + samplegeno_role}>
                <td className="text-capitalize text-left text-truncate">{samplegeno_role}</td>
                <td className="text-left text-truncate">{samplegeno_sampleid}</td>
                <td className="text-left text-truncate">{samplegeno_numgt}</td>
                <td className="text-left text-truncate">{samplegeno_quality}</td>
                <td className="text-left text-truncate">{samplegeno_likelihood}</td>
            </tr>
        );
    });
    return (
        <table className="w-100">
            <thead>
                <tr>
                    <th className="text-left">Relation</th>
                    <th className="text-left">ID</th>
                    <th className="text-left">Genotype</th>
                    <th className="text-left">Genotype Quality</th>
                    <th className="text-left">Genotype Likelihoods</th>
                </tr>
            </thead>
            <tbody>
                { rows }
            </tbody>
        </table>);
}