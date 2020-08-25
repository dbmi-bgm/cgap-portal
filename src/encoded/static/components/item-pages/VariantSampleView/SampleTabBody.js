'use strict';

import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { schemaTransforms } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';


export function SampleTabBody(props){
    console.log("sampleTabBodyProps", props);

    const { context = null, schemas } = props;
    const {
        GQ : genotypeQuality = null,
        QUAL: variantQuality = null,
        PL: genotypeLikelihood = null,
        FS: strandFisherScore = null,
        novoPP = null,
        uuid = null,
        cmphet = []
    } = context || {};

    // Should probably define this in VariantSampleOverview and pass down to the tabs, since its being used in all 3 so far
    const getTipForField = useMemo(function(){
        if (!schemas) return function(){ return null; };
        // Helper func to basically just shorten `schemaTransforms.getSchemaProperty(field, schemas, itemType);`.
        return function(field, itemType = "VariantSample"){
            // Func is scoped within GeneTabBody (uses its 'schemas')
            const schemaProperty = schemaTransforms.getSchemaProperty(field, schemas, itemType);
            return (schemaProperty || {}).description || null;
        };
    }, [ schemas ]);
    return (
        <div className="variant-tab-body card-body">
            <div className="row">
                <div className="col-8 col-md-9">
                    <div className="info-section pb-2">
                        <div className="info-header-title">
                            <h4>
                                {/* todo link to GnomAD -- is there a gnomad link somewhere ? */}
                                Quality
                            </h4>
                        </div>
                        <div className="info-body overflow-auto">
                            <QualityTable {...{ genotypeQuality, genotypeLikelihood, variantQuality, strandFisherScore, getTipForField }} />
                        </div>
                    </div>
                </div>
                <div className="col-4 col-md-3">
                    <div className="info-section pb-2">
                        <div className="info-header-title">
                            <h4>
                                {/* todo link to GnomAD -- is there a gnomad link somewhere ? */}
                                BAM Snapshot
                            </h4>
                        </div>
                        <div className="info-body text-center">
                            View BAM Snapshot
                            <a href={`/${uuid}/@@download`} className="d-block pt-2 my-0 mx-auto">
                                <i className="icon icon-fw icon-2x icon-external-link-alt fas" />
                            </a>
                        </div>
                    </div>
                </div>
            </div>
            <div className="row">
                <div className="col-12 col-md-12 d-flex">
                    <div className="info-section pb-2">
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
                    <div className="info-section pb-2">
                        <div className="info-header-title">
                            <h4>
                                {/* todo link to GnomAD -- is there a gnomad link somewhere ? */}
                                Inheritance Mode
                            </h4>
                        </div>
                        <div className="info-body overflow-auto">
                            <h5>DeNovo</h5>
                            <DeNovoTable {...{ novoPP, getTipForField }}/>
                            <h5>Compound Heterozygous</h5>
                            <CompoundHetTable {...{ cmphet }} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}


function QualityTable(props){
    const { genotypeLikelihood, genotypeQuality, variantQuality, strandFisherScore, getTipForField } = props;
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
                    <td className="text-left">{ variantQuality }</td>
                    <td className="text-left">{ getTipForField("QUAL") }</td>
                </tr>
                <tr>
                    <td className="text-600 text-left">Genotype Quality</td>
                    <td className="text-left">{ genotypeQuality }</td>
                    <td className="text-left">{ getTipForField("GQ") }</td>
                </tr>
                <tr>
                    <td className="text-600 text-left">Genotype Likelihoods(0/0,0/1,1/1)</td>
                    <td className="text-left">{ genotypeLikelihood }</td>
                    <td className="text-left">{ getTipForField("PL") }</td>
                </tr>
                <tr>
                    <td className="text-600 text-left">Strand Fisher Score</td>
                    <td className="text-left">{ strandFisherScore }</td>
                    <td className="text-left">{ getTipForField("FS") }</td>
                </tr>
            </tbody>
        </table>
    );
}
QualityTable.propTypes = {
    genotypeLikelihood: PropTypes.string,
    genotypeQuality: PropTypes.string,
    variantQuality: PropTypes.string,
    strandFisherScore: PropTypes.string,
    getTipForField: PropTypes.func
};

function DeNovoTable(props) {
    const { getTipForField, novoPP } = props;
    return (
        <table className="w-100">
            <thead>
                <tr>
                    <th className="text-left">Inheritance Mode</th>
                    <th className="text-left">Score</th>
                    <th className="text-left">Definition</th>
                </tr>
            </thead>
            <tbody>
                <tr className="border-top">
                    <td className="text-600 text-left">NovoCaller</td>
                    <td className="text-left">{ novoPP }</td>
                    <td className="text-left">{ getTipForField("novoPP") }</td>
                </tr>
            </tbody>
        </table>
    );
}
DeNovoTable.propTypes = {
    getTipForField: PropTypes.func,
    novoPP: PropTypes.string
};

function CompoundHetTable(props) {
    const { cmphet } = props;

    return (
        <table className="w-100">
            <thead>
                <tr>
                    <th className="text-left">Variant</th>
                    <th className="text-left">Phase</th>
                    <th className="text-left">Gene</th>
                    <th className="text-left">Impact</th>
                    <th className="text-left">Transcript</th>
                    <th className="text-left">Impact Transcript</th>
                </tr>
            </thead>
            <tbody>
                { cmphet.map((obj, i) => {
                    const {
                        comhet_mate_variant: variant = null,
                        comhet_phase: phase = null,
                        comhet_gene: gene = null,
                        comhet_impact_gene: impactGene = null,
                        comhet_transcript: transcript = null,
                        comhet_impact_transcript: impactTranscript = null,
                    } = obj;

                    return (
                        <tr key={i} className="border-top">
                            <td className="text-600 text-left">{ variant }</td>
                            <td className="text-left">{ phase }</td>
                            <td className="text-left">{ gene }</td>
                            <td className="text-left">{ impactGene }</td>
                            <td className="text-left">{ transcript }</td>
                            <td className="text-left">{ impactTranscript }</td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}
CompoundHetTable.propTypes = {
    getTipForField: PropTypes.func,
    cmphet: PropTypes.array
};