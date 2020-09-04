'use strict';

import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { schemaTransforms } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';


export function SampleTabBody(props){
    const { context = null, schemas } = props;
    const {
        DP: coverage = null,
        GQ : genotypeQuality = null,
        QUAL: variantQuality = null,
        PL: genotypeLikelihood = null,
        FS: strandFisherScore = null,
        novoPP = null,
        uuid = null,
        cmphet = [],
        samplegeno = [],
        genotype_labels: genotypeLabels = [],
        CALL_INFO = null
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
                    <div className="pb-2 inner-card-section">
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
                    <div className="pb-2 inner-card-section h-100">
                        <div className="info-header-title">
                            <h4>
                                {/* todo link to GnomAD -- is there a gnomad link somewhere ? */}
                                BAM Snapshot
                            </h4>
                        </div>
                        <div className="info-body text-center overflow-auto d-flex h-100 d-flex justify-content-center flex-column">
                            <span>View BAM Snapshot</span>
                            <a href={`/${uuid}/@@download`} className="d-block pt-2" style={{ textAlign: "center", margin: "0 auto" }}>
                                <i className="icon icon-fw icon-2x icon-external-link-alt fas ml-05" />
                            </a>
                        </div>
                    </div>
                </div>
            </div>
            <div className="row">
                <div className="col-12 col-md-12 d-flex">
                    <div className="pb-2 w-100 inner-card-section">
                        <div className="info-header-title">
                            <h4>
                                {/* todo link to GnomAD -- is there a gnomad link somewhere ? */}
                                Coverage
                            </h4>
                        </div>
                        <div className="info-body overflow-auto">
                            <CoverageTable {...{ samplegeno, genotypeLabels, CALL_INFO, coverage }}/>
                        </div>
                    </div>
                </div>
            </div>
            <div className="row">
                <div className="col-12 col-md-12 d-flex">
                    <div className="pb-2 w-100 inner-card-section">
                        <div className="info-header-title">
                            <h4>
                                {/* todo link to GnomAD -- is there a gnomad link somewhere ? */}
                                Inheritance Mode
                            </h4>
                        </div>
                        <div className="info-body overflow-auto">
                            <h5>DeNovo</h5>
                            <DeNovoTable {...{ novoPP, getTipForField }}/>
                            <h5 className="mt-2">Compound Heterozygous</h5>
                            <CompoundHetTable {...{ cmphet }} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function CoverageTable(props) {
    const { samplegeno = [], genotypeLabels = [] } = props;

    if (samplegeno.length === 0) {
        return <span className="font-italic">No coverage data available.</span>;
    }

    const mapSampleIDToCoverageData = {};
    const mapRoleToLabelData = {};

    // Populate ID->Coverage map with genotype label information (currently does nothing)
    genotypeLabels.forEach((obj) => {
        const { role = null, labels = [], sample_id = null } = obj;
        if (sample_id !== null) {
            mapSampleIDToCoverageData[sample_id] = { labels, role };
        }
        if (role) {
            mapRoleToLabelData[role] = labels;
        }
    });

    const mapNumGTToGT = {};

    let shortGTDupPresent = false;
    const shortGTDupTester = {};

    const rows = samplegeno.map((sg) => {
        const {
            samplegeno_role: role = null,
            samplegeno_sampleid: sampleID = null,
            samplegeno_ad = null,
            samplegeno_gt = null,
            samplegeno_numgt = null
        } = sg;

        // If there were no genotypeLabels, and a sampleID wasn't registered previously, register now. (Stopgap)
        mapSampleIDToCoverageData[sampleID] = {};

        // Convert AD & GT strings into arrays for easier traversal
        let adArr = [];
        let gtArr = [];
        let numGTArr = [];
        if (samplegeno_ad) { adArr = samplegeno_ad.split('/'); }
        if (samplegeno_gt) { gtArr = samplegeno_gt.split('/'); }
        if (samplegeno_numgt) { numGTArr = samplegeno_numgt.split('/');}

        // Populate mapNumGTtoGT with GT info
        numGTArr.forEach((numGT, i) => {
            if (!mapNumGTToGT.hasOwnProperty(numGT)) {
                let gtObj = {};
                const fullGT = gtArr[i];

                if (fullGT.length > 12) { // Calculate shortened versions of GTs
                    const first4 = fullGT.substring(0, 4);
                    const middle = fullGT.substring(4, fullGT.length - 4);
                    const last4 = fullGT.substring(fullGT.length - 4, fullGT.length);
                    const shortGT = `${first4}...${last4}`;
                    const bpGT = `${first4}...${middle.length}bp...${last4}`;

                    // Determine if to use ...BP... shortened version or normal shortened version
                    if (!shortGTDupTester[shortGT]) {
                        shortGTDupTester[shortGT] = true;
                    } else {
                        shortGTDupPresent = true;
                    }

                    gtObj = { fullGT, shortGT, bpGT };
                } else {
                    gtObj = { fullGT };
                }

                mapNumGTToGT[numGT] = gtObj;
            } else if (mapNumGTToGT[numGT] && mapNumGTToGT[numGT].fullGT !== gtArr[i]) {
                throw new Error ("numGT mismatch at ", numGT);
            }
        });

        // If role/label data couldn't be populated by genotypeLabel sort, see if can populate here
        if (role && !mapSampleIDToCoverageData[sampleID]["role"]) {
            mapSampleIDToCoverageData[sampleID]["role"] = role;
            const labels = mapRoleToLabelData[role];

            if (labels && !mapSampleIDToCoverageData[sampleID]["labels"]) {
                mapSampleIDToCoverageData[sampleID]["labels"] = labels;
            }
        }

        mapSampleIDToCoverageData[sampleID]["adArr"] = adArr;

        return sampleID;
    });

    // Show proband first
    rows.sort((a,b) => {
        const { role = null } = a;
        return (role === "proband" ? 1 : -1);
    });

    // Ref will always be mapNumGTToGt[0]; sort to ascend 0 -> 2
    const cols = Object.keys(mapNumGTToGT).sort((a,b) => a - b);

    return (
        <table className="w-100">
            <thead>
                <tr>
                    <th className="text-left">Relation</th>
                    <th className="text-left">ID</th>
                    <th className="text-left">Coverage</th>
                    { cols.map((numGT) => {
                        const { fullGT, shortGT, bpGT } = mapNumGTToGT[numGT];
                        const useBPGT = shortGTDupPresent && bpGT;
                        return (
                            <th key={fullGT} className="text-left" data-tip={(shortGT || bpGT) ? fullGT : null}>
                                {numGT === "0" ? "Ref" : "Alt"}({ useBPGT ? bpGT : (shortGT || fullGT) })
                            </th>
                        );
                    })}
                    <th className="text-left">Call</th>
                </tr>
            </thead>
            <tbody>
                {rows.map((sampleID) => { // rows now distinguished by sampleIDs, not roles
                    const rowData = mapSampleIDToCoverageData[sampleID];
                    const { adArr = [], labels : [label] = [], role = null } = rowData || {};

                    let totalCoverage = 0;
                    adArr.forEach((ad, i) => {
                        totalCoverage += Number.parseInt(ad);
                    });

                    return (
                        <tr key={role}>
                            <td className="text-left text-capitalize">{ role }</td>
                            <td className="text-left">{ sampleID ? sampleID.split("_")[0] : "" }</td>
                            <td className="text-left">{ totalCoverage }</td>
                            { adArr.map((ad, i) => {
                                if (i === 0) {
                                    return <td key={ad} className="text-left">{ad} {(ad > 0 && ad != totalCoverage) ? ` (${ Math.round(ad/totalCoverage * 100 )}%)`: null }</td>;
                                }
                                return (
                                    <td key={ad} className="text-left">
                                        { ad.toString() || 0}
                                        { ad > 0 ? ` (${ Math.round(ad/totalCoverage * 100 )}%)`: null }
                                    </td>
                                );
                            })}
                            <td className="text-left">{ label }</td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}

function QualityTable(props) {
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
                <tr>
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
    const { getTipForField, novoPP = null } = props;
    if (novoPP === null) {
        return <span className="font-italic">Novo caller results are not provided for chrX, chrY, and chrM because these chromosomes do not meet model assumptions.</span>;
    }
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
                <tr>
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

    if (cmphet.length === 0) {
        return <span className="font-italic">No other variants on the same gene have passed the CGAP filter for rare exonic or splicing variants or clinvar variants.</span>;
    }
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
                        comhet_transcript: transcript = [],
                        comhet_impact_transcript: impactTranscript = null,
                    } = obj;

                    return (
                        <tr key={i}>
                            <td className="text-600 text-left">{ variant }</td>
                            <td className="text-left">{ phase }</td>
                            <td className="text-left">{ gene }</td>
                            <td className="text-left">{ impactGene }</td>
                            <td className="text-left">
                                { transcript.map((item, i) => {
                                    if (transcript.length - 1 !== i) {
                                        return item + ", ";
                                    }
                                    return item;
                                }) }
                            </td>
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