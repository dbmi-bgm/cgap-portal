'use strict';

import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { schemaTransforms } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';

import { ajax } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';

export function SampleTabBody(props){
    const { context = null, schemas } = props;
    const {
        "@id": atID,
        GQ : genotypeQuality = null,
        QUAL: variantQuality = null,
        PL: genotypeLikelihood = null,
        FS: strandFisherScore = null,
        novoPP = null,
        cmphet: cmphetArr = [],
        samplegeno = [],
        genotype_labels: genotypeLabels = [],
        variant = null,
        CALL_INFO = null,
        file = null,
        bam_snapshot = null
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

    let bamSnapSection;
    if (bam_snapshot) {
        bamSnapSection = (
            <div className="col-4 col-md-3">
                <div className="pb-2 inner-card-section h-100">
                    <div className="info-header-title">
                        <h4>
                            BAM Snapshot
                        </h4>
                    </div>
                    <div className="info-body text-center overflow-auto d-flex h-100 d-flex justify-content-center flex-column">
                        <span>View BAM Snapshot</span>
                        <a href={atID + "@@download"} className="d-block pt-2 text-center mx-auto" target="_blank" rel="noopener noreferrer">
                            <i className="icon icon-fw icon-2x icon-external-link-alt fas ml-05" />
                        </a>
                    </div>
                </div>
            </div>
        );
    }
    return (
        <div className="variant-tab-body card-body">
            <div className="row">
                <div className={bam_snapshot ? "col-8 col-md-9" : "col-12 col-md-12"}>
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
                {bamSnapSection}
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
                            <CompoundHetTableWrapper {...{ cmphetArr, CALL_INFO, file }} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * Returns an object with shortened genotypes: one with number of base pairs, one without
 * @param {*} fullGT Full genotype (ex. AGAGAATTCCACTCACATCG)
 * @param {*} n Number of base pairs to show on either side of the shortening (if "n=2", shortGT would look like "AG...TC")
 */
function shortenGT(fullGT, n) {
    let gtObj = {};

    // Only calculate shortened values if fullGT is longer than 10 characters
    if (fullGT.length > 10) {
        // Calculate shortened versions of GTs
        const firstN = fullGT.substring(0, n);
        const middle = fullGT.substring(n, fullGT.length - n);
        const lastN = fullGT.substring(fullGT.length - n, fullGT.length);
        const shortGT = `${firstN}...${lastN}`;
        const bpGT = `${firstN}...${middle.length}bp...${lastN}`;

        // // Determine if to use ...BP... shortened version or normal shortened version
        // if (!shortGTDupTester[shortGT]) {
        //     shortGTDupTester[shortGT] = true;
        // } else {
        //     shortGTDupPresent = true;
        // }

        gtObj = { fullGT, shortGT, bpGT };
    } else {
        gtObj = { fullGT };
    }
    return gtObj;
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

const CoverageTable = React.memo(function CoverageTable({ samplegeno = [], genotypeLabels = [], varRef }) {
    if (samplegeno.length === 0) {
        return <span className="font-italic">No coverage data available.</span>;
    }

    const mapNumgtToGT = {};
    const rows = [];

    // Keep track of duplicates for shortened titles
    let shortGTDupPresent = false;
    const mapGTToShortenedTitles = {};
    const shortGTDupTester = {};

    // Add shortened ref to titlemap
    const refShortened = shortenGT(varRef, 2);
    mapGTToShortenedTitles[varRef] = refShortened;

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
                        const gtObj = shortenGT(fullGT, 2);
                        const { shortGT = null } = gtObj;

                        // Determine if to use ...BP... shortened version or normal shortened version
                        if (!shortGTDupTester[shortGT]) {
                            shortGTDupTester[shortGT] = true;
                        } else {
                            shortGTDupPresent = true;
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
                    const { bpGT = null, shortGT = null } = shortenGT(varRef, 2);
                    refAndAltCols.push(<th key={i} data-Tip={varRef} className="text-left">Ref ({bpGT || shortGT || varRef})</th>);
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
});

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
    genotypeQuality: PropTypes.number,
    variantQuality: PropTypes.number,
    strandFisherScore: PropTypes.number,
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

const CompoundHetTable = React.memo(function CompoundHetTable(props) {
    const { cmphetArr } = props;

    if (cmphetArr.length === 0) {
        return <span className="font-italic">No other variants on the same gene have passed the CGAP filter for rare exonic or splicing variants or clinvar variants.</span>;
    }

    function loadStatus(loadstatus) {
        switch (loadstatus) {
            case "error":
                // TODO: tooltip broken; need to rework to account for the weirdness with the tooltip handlers getting unhooked
                return <span data-tip="An error occurred while pulling this data. Reload page to try again."><i className="icon icon-exclamation-triangle fas text-warning mr-05"/> Error</span>;
            case "loading":
                return <i className="icon icon-fw icon-circle-notch icon-spin fas"/>;
            default:
                return loadstatus || "-";
        }
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
                    <th data-tip="Location on worst effect transcript" className="text-left">Location</th>
                    <th data-tip="Coding effect on worst effect transcript" className="text-left">Coding Effect</th>
                </tr>
            </thead>
            <tbody>
                { cmphetArr.map((obj, i) => {
                    const {
                        comhet_mate_variant: variant = null,
                        comhet_phase: phase = null,
                        comhet_gene: gene = null,
                        comhet_impact_gene: impactGene = null,
                        comhet_transcript: transcript = null,
                        comhet_impact_transcript: impactTranscript = null,
                        href = null,
                        location = null,
                        coding_effect = null
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
                            <td className="text-600 text-left">
                                { href ? <a href={href}>{variant}</a> : variant }
                            </td>
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
                            <td className="text-left">{ loadStatus(location) }</td>
                            <td className="text-left">{ loadStatus(coding_effect) }</td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
});
CompoundHetTable.propTypes = {
    getTipForField: PropTypes.func,
    cmphetArr: PropTypes.array
};


class CompoundHetTableWrapper extends React.Component {
    constructor(props) {
        super();
        this.getMateData = this.getMateData.bind(this);
        this.constructGetMatesQuery = this.constructGetMatesQuery.bind(this);

        // Derive initial state from cmphetArr prop
        const { cmphetArr: propCmphetArr = [] } = props;
        const cmphetArr = [];
        propCmphetArr.forEach((cmphet) => {
            const cmphetCopy = { ...cmphet };
            cmphetCopy["location"] = "loading";
            cmphetCopy["coding_effect"] = "loading";
            cmphetArr.push(cmphetCopy);
        });

        this.state = { cmphetArr };
    }

    componentDidMount() {
        // start doing ajax requests to pull in data for each mate
        const { cmphetArr } = this.state;
        if (cmphetArr.length === 0) {
            // No cmphets to get info for, skip doing request.
            return false;
        }
        this.getMateData();
    }

    constructGetMatesQuery() {
        const { file, CALL_INFO } = this.props;
        const { cmphetArr } = this.state;

        let queryString = `/search/?type=VariantSample&file=${file}&CALL_INFO=${CALL_INFO}`;

        // Populate with variant titles
        cmphetArr.forEach((cmphet) => {
            const {
                comhet_mate_variant: variant = null,
            } = cmphet;
            queryString += ("&variant.display_title=" + variant);
        });
        return encodeURI(queryString);
    }

    getMateData() {
        const encodedQueryString = this.constructGetMatesQuery();
        // console.log("getQueryString", encodedQueryString);

        // Request variant mates
        return ajax.promise(encodedQueryString, 'GET', {})
            .then((response) => {
                console.log("getMateData response", response); // for testing

                const { "@graph": responseItems = [], total } = response;

                if (typeof total !== 'number'){
                    // TODO if we have >25, show error/warning that only first 25 are updated.
                    // Can also add 'limit=100' or some other to increase limit from 25.
                    throw response;
                }

                this.setState(function({ cmphetArr: prevCmphetArr = [] }){

                    const cmphetArr = []; // update each object in state with href

                    if (responseItems.length > 0) { // request succeeded and provided results
                        const variantToStateIndexMap = {};
                        const variantToGeneMap = {};

                        // create copies of each state object
                        prevCmphetArr.forEach(function(cmphet, i){
                            const { comhet_mate_variant: variant, comhet_gene: gene } = cmphet;
                            const cmphetCopy = { ...cmphet };
                            variantToStateIndexMap[variant] = i;
                            cmphetArr.push(cmphetCopy);

                            // add associated gene to map
                            variantToGeneMap[variant] = gene;
                        });

                        // update each state object with link data
                        responseItems.forEach(function(svObj){
                            const { "@id": svAtId = null, variant = null } = svObj;
                            // console.log("svObj", svObj);
                            const { display_title: variantTitle = null, genes = [] } = variant || {};
                            if (variantToStateIndexMap[variantTitle] != undefined) {
                                const stateIndex = variantToStateIndexMap[variantTitle];
                                cmphetArr[stateIndex]["href"] = svAtId;

                                // if there's an associated gene for this comphet, find it's location and coding effect
                                genes.forEach(function(gene){
                                    const {
                                        genes_most_severe_consequence = null,
                                        genes_most_severe_gene = null
                                    } = gene || {};

                                    const { "@id": geneAtId = "" } = genes_most_severe_gene || {};
                                    const geneSplit = geneAtId.split("/");
                                    const [ ,, thisGene = null ] = geneSplit || [];

                                    const associatedGene = variantToGeneMap[variantTitle];
                                    if (thisGene === associatedGene) {
                                        const { location = null, coding_effect = null } = genes_most_severe_consequence || {};

                                        cmphetArr[stateIndex]["location"] = location;
                                        cmphetArr[stateIndex]["coding_effect"] = coding_effect;
                                    } else {
                                        cmphetArr[stateIndex]["location"] = null;
                                        cmphetArr[stateIndex]["coding_effect"] = null;
                                    }
                                });
                            }
                        });
                    } else {
                        // No results... update to stop loading
                        prevCmphetArr.forEach((cmphet) => {
                            const cmphetCopy = { ...cmphet };
                            cmphetCopy["location"] = null;
                            cmphetCopy["coding_effect"] = null;
                            cmphetArr.push(cmphetCopy);
                        });
                    }

                    return { cmphetArr };
                });
            })
            .catch((error) => {
                console.log("Error occurred", error);
                // Update to stop loading, replace with a load-failed indicator
                this.setState(function({ cmphetArr: prevCmphetArr = [] }){
                    const cmphetArr = [];
                    prevCmphetArr.forEach((cmphet) => {
                        const cmphetCopy = { ...cmphet };
                        cmphetCopy["location"] =  "error";
                        cmphetCopy["coding_effect"] =  "error";
                        cmphetArr.push(cmphetCopy);
                    });
                    return { cmphetArr };
                });
            });
    }

    render() {
        const { cmphetArr = [] } = this.state;
        return <CompoundHetTable {...{ cmphetArr }} />;
    }
}
CompoundHetTableWrapper.propTypes = {
    CALL_INFO: PropTypes.string,
    file: PropTypes.string,
    cmphetArr: PropTypes.array
};