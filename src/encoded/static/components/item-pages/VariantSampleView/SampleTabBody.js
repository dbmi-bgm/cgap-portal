'use strict';

import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { schemaTransforms } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';


export function SampleTabBody(props){
    const { context = null, schemas } = props;
    const {
        GQ : genotypeQuality = null,
        QUAL: variantQuality = null,
        PL: genotypeLikelihood = null,
        FS: strandFisherScore = null,
        novoPP = null,
        uuid = null,
        cmphet = [],
        samplegeno = [],
        genotype_labels: genotypeLabels = [],
        variant = null
    } = context || {};

    const { REF: varRef = null } = variant;

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
                                Coverage
                            </h4>
                        </div>
                        <div className="info-body overflow-auto">
                            <CoverageTable {...{ samplegeno, genotypeLabels, varRef }} />
                        </div>
                    </div>
                </div>
            </div>
            <div className="row">
                <div className="col-12 col-md-12 d-flex">
                    <div className="pb-2 w-100 inner-card-section">
                        <div className="info-header-title">
                            <h4>
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


function CoverageTableRow(props) {
    const {
        sampleID = "",
        totalCoverage = 0,
        relation = "",
        refAD = 0,
        altADs = [],
        labels : [label] = []
    } = props;

    if (!sampleID) { return null; }

    const caseID = sampleID ? sampleID.split("_")[0] : "";

    return (
        <tr key={sampleID}>
            <td className="text-left text-capitalize">{ relation }</td>
            <td className="text-left"> { caseID }</td>
            <td className="text-left">{ totalCoverage }</td>
            <td className="text-left">{ refAD } {(refAD > 0 && refAD != totalCoverage) ? ` (${ Math.round(refAD/totalCoverage * 100 )}%)`: null }</td>
            { altADs.map((ad, i) => (
                <td key={`${i, ad}`} className="text-left">
                    { ad || 0}
                    { ad > 0 ? ` (${ Math.round(ad/totalCoverage * 100 )}%)`: null }
                </td>
            ))}
            <td className="text-left">{ label || "-" }</td>
        </tr>
    );
}

function CoverageTable(props) {
    const { samplegeno = [], genotypeLabels = [], varRef } = props;

    if (samplegeno.length === 0) {
        return <span className="font-italic">No coverage data available.</span>;
    }

    const mapNumgtToGT = {};
    const rows = [];

    // Keep track of duplicates for shortened titles
    let shortGTDupPresent = false;
    const mapGTToShortenedTitles = {};
    const shortGTDupTester = {};

    let samplegenolen;

    // Populate ID->Coverage map with genotype label information
    const mapSampleIDToGenotypeLabel = {};
    const mapRoleToLabelData = {}; // stopgap
    genotypeLabels.forEach((obj) => {
        const { role = null, labels = [], sample_id = null } = obj;
        if (sample_id !== null) {
            mapSampleIDToGenotypeLabel[sample_id] = { labels, role };
        }
        if (role) {
            mapRoleToLabelData[role] = labels;
        }
    });

    samplegeno.forEach((sg) => {
        const {
            samplegeno_ad = "",
            samplegeno_gt = "",
            samplegeno_role = "",
            samplegeno_numgt  = "",
            samplegeno_sampleid = "",
        } = sg;

        // Populate numGT to GT mapping (used to display column titles)
        const gtSplit = samplegeno_gt.split("/");
        const numgtSplit = samplegeno_numgt.split("/");

        // If there were no genotypeLabels, and a sampleID wasn't registered previously, register now. (Stopgap)
        mapSampleIDToGenotypeLabel[samplegeno_sampleid] = {};

        numgtSplit.forEach((numgt, i) => {
            // Fallbacks for no-values handled later
            if (numgt !== ".") {
                if (gtSplit[i] !== ".") {
                    const fullGT = gtSplit[i];
                    mapNumgtToGT[numgt] = fullGT;

                    // Populate mapGTToShortenedTitles mapping
                    if (!mapGTToShortenedTitles.hasOwnProperty(fullGT)) {
                        let gtObj;
                        const n = 2; // Number of bp to show on either end when shortened
        
                        if (fullGT.length > 10) { // Calculate shortened versions of GTs
                            const firstN = fullGT.substring(0, n);
                            const middle = fullGT.substring(n, fullGT.length - n);
                            const lastN = fullGT.substring(fullGT.length - n, fullGT.length);
                            const shortGT = `${firstN}...${lastN}`;
                            const bpGT = `${firstN}...${middle.length}bp...${lastN}`;
        
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

                        mapGTToShortenedTitles[fullGT] = gtObj;
                    }
                }
            }
        });

        // Collect Row Data
        const adSplit = samplegeno_ad.split("/"); // .length is always === # of total ref+alt cols
        if (!samplegenolen) { samplegenolen = adSplit.length; } // use for verifying col# later

        // If role/label data couldn't be populated by genotypeLabel sort, see if can populate here
        if (samplegeno_role && !mapSampleIDToGenotypeLabel[samplegeno_sampleid]["role"]) {
            mapSampleIDToGenotypeLabel[samplegeno_sampleid]["role"] = samplegeno_role;
            const labels = mapRoleToLabelData[samplegeno_role];

            if (labels && !mapSampleIDToGenotypeLabel[samplegeno_sampleid]["labels"]) {
                mapSampleIDToGenotypeLabel[samplegeno_sampleid]["labels"] = labels;
            }
        }
        mapSampleIDToGenotypeLabel[samplegeno_sampleid]["adArr"] = adSplit;

        const row = {
            sampleID : samplegeno_sampleid,
            totalCoverage : adSplit.reduce((pv, cv) => parseInt(pv) + parseInt(cv)), // these are a little dangerous... but should always be an int...
            relation: samplegeno_role,
            refAD : adSplit[0],
            altADs : adSplit.slice(1, adSplit.length),
            labels: mapSampleIDToGenotypeLabel[samplegeno_sampleid]["labels"]
        };

        rows.push(row);
    });

    // Check if there are any columns missing (because gt/numgt came in blank)
    const numGTKeys = Object.keys(mapNumgtToGT);

    const numCol = numGTKeys.length;
    let refAndAltCols;
    if (samplegenolen === numCol) { // great, no further effort needed, just sort the keys and use them to populate the rows
        refAndAltCols = numGTKeys.sort((a,b) => a - b).map((numGT, i) => {
            const thisGT = mapNumgtToGT[numGT];
            const { bpGT = null, shortGT = null } = mapGTToShortenedTitles[thisGT];
            return <th key={i} data-tip={thisGT} className="text-left">{`${numGT == 0 ? 'Ref': 'Alt'} (${bpGT || shortGT || thisGT})`}</th>;
        });
    } else { // looks like some columns were missing/incomplete, need to ensure # matches
        refAndAltCols = [];
        let emptyColCount = 1;
        for (let i = 0; i < samplegenolen; i++) {
            // if missing a numGT:
            if (!mapNumgtToGT[i]) {
                // if it's ref, just use ref placeholder to replace
                if (i === 0) {
                    refAndAltCols.push(<th key={i} className="text-left">Ref ({varRef})</th>);
                } else { // apply placeholder name to empty alt column
                    refAndAltCols.push(<th key={i} className="text-left">Alt (#{emptyColCount})</th>);
                    emptyColCount++;
                }
            } else { // use actual value
                const thisGT = mapNumgtToGT[i];
                const { bpGT = null, shortGT = null } = mapGTToShortenedTitles[thisGT];
                refAndAltCols.push(<th key={i} data-tip={thisGT} className="text-left">{`${i == 0 ? 'Ref': 'Alt'} (${bpGT || shortGT || thisGT})`}</th>);
            }
        }
    }

    // Proband first, then mother, then father, then rest
    rows.sort((a,b) => {
        const { relation: relationA = null } = a;
        const { relation: relationB = null } = b;
        if (relationA === "proband") {
            return -1;
        } else if (relationA === "mother" && relationB !== "proband") {
            return -1;
        } else if (relationA === "father" && relationB !== "proband" && relationB !== "mother") {
            return -1;
        } else {
            return 1;
        }
    });

    return (
        <table className="w-100">
            <thead>
                <tr>
                    <th className="text-left">Relation</th>
                    <th className="text-left">ID</th>
                    <th className="text-left">Coverage</th>
                    { refAndAltCols }
                    <th className="text-left">Call</th>
                </tr>
            </thead>
            <tbody>
                {rows.map((row) => <CoverageTableRow key={row.sampleID} { ...row }/>)}
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
                        comhet_transcript: transcript = null,
                        comhet_impact_transcript: impactTranscript = null,
                    } = obj;

                    // Stopgap until comhet transcript type update complete (handles array & string)
                    let finalTranscripts;
                    if (Array.isArray(transcript)) {
                        finalTranscripts = transcript;
                    } else {
                        if (!transcript) { // if null or empty string
                            finalTranscripts = [];
                        } else {
                            finalTranscripts = transcript.split("~");
                        }
                    }

                    return (
                        <tr key={i}>
                            <td className="text-600 text-left">{ variant }</td>
                            <td className="text-left">{ phase }</td>
                            <td className="text-left">{ gene }</td>
                            <td className="text-left">{ impactGene }</td>
                            <td className="text-left">
                                { finalTranscripts.map((item, i) => {
                                    if (finalTranscripts.length - 1 !== i) {
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