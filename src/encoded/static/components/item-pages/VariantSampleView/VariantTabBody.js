'use strict';

import React, { useCallback, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import DropdownButton from 'react-bootstrap/esm/DropdownButton';
import DropdownItem from 'react-bootstrap/esm/DropdownItem';
import { console, schemaTransforms } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';

import { Schemas } from './../../util';
import { ExternalDatabasesSection } from './ExternalDatabasesSection';

/**
 * Excluding the Gene Area (under position in mockuop https://gyazo.com/81d5b75b167bddef1b4c0a97f1640c51)
 */

export const VariantTabBody = React.memo(function VariantTabBody ({ context, schemas, currentTranscriptIdx }) {
    const { variant } = context;
    const { csq_clinvar: variationID } = variant;
    const [ showingTable, setShowingTable ] = useState("v3"); // Allowed: "v2", "v3", and maybe "summary" in future; could be converted integer instd of of text.

    const onSelectShowingTable = useCallback(function(evtKey, e){
        e.stopPropagation();
        setShowingTable(evtKey);
        return;
    });

    const { getTipForField, clinvarExternalHref } = useMemo(function(){

        const ret = {
            getTipForField: function(){ return null; },
            clinvarIDSchemaProperty: null,
            clinvarExternalHref: null
        };

        if (schemas){
            // Helper func to basically just shorten `schemaTransforms.getSchemaProperty(field, schemas, itemType);`.
            ret.getTipForField = function(field, itemType = "Variant"){
                // Func is scoped within GeneTabBody (uses its 'schemas')
                const schemaProperty = schemaTransforms.getSchemaProperty(field, schemas, itemType);
                return (schemaProperty || {}).description || null;
            };
            if (variationID) {
                const clinvarIDSchemaProperty = schemaTransforms.getSchemaProperty("csq_clinvar", schemas, "Variant");
                ret.clinvarExternalHref = clinvarIDSchemaProperty.link.replace("<ID>", variationID);
            }
        }

        return ret;
    }, [ schemas, variationID ]);

    const titleDict = useMemo(function(){
        return {
            "v2": <React.Fragment><span className="text-600">GnomAD</span> V2 Exome</React.Fragment>,
            "v3": <React.Fragment><span className="text-600">GnomAD</span> V3</React.Fragment>
        };
    });

    return (
        <div className="variant-tab-body card-body">
            <div className="row">

                <div className="col-12 col-xl-6 d-flex flex-column">

                    <div className="inner-card-section flex-grow-1 pb-2 pb-xl-1">
                        <div className="info-header-title">
                            <h4>
                                { clinvarExternalHref ?
                                    <a href={clinvarExternalHref} rel="noopener noreferrer" target="_blank">
                                        ClinVar
                                        <i className="icon icon-external-link-alt fas ml-07 text-small"/>
                                    </a>
                                    : "ClinVar"
                                }
                            </h4>
                        </div>
                        <div className="info-body clinvar-info-body">
                            <ClinVarSection {...{ getTipForField, context, schemas, clinvarExternalHref }} />
                        </div>
                    </div>

                    <div className="inner-card-section flex-grow-0 pb-2 pb-xl-0">
                        <div className="info-header-title">

                            <DropdownButton size="lg py-1" variant="outline-dark select-gnomad-version" onSelect={onSelectShowingTable}
                                title={titleDict[showingTable]} >
                                <DropdownItem eventKey="v3" active={showingTable === "v3"}>{ titleDict.v3 }</DropdownItem>
                                <DropdownItem eventKey="v2" active={showingTable === "v2"}>{ titleDict.v2 }</DropdownItem>
                            </DropdownButton>

                            {/* todo link/icon to GnomAD -- is there a gnomad link somewhere ? */}

                        </div>
                        <div className="info-body overflow-auto">
                            <GnomADTable {...{ context, schemas, getTipForField }} prefix={showingTable === "v2" ? "csq_gnomade2" : "csq_gnomadg"} />
                        </div>
                    </div>


                </div>
                <div className="col-12 col-xl-6 d-flex flex-column">

                    <div className="inner-card-section flex-grow-1 pb-2 pb-xl-1">
                        <div className="info-header-title">
                            <h4>External Resources</h4>
                        </div>
                        <div className="info-body">
                            {/* We could maybe rename+put `ExternalDatabasesSection` into own file (from GeneTabBody.js), parameterize itemtype for schemas, and re-use ? */}
                            <ExternalResourcesSection {...{ context, schemas, currentTranscriptIdx }} />
                        </div>
                    </div>

                    <div className="inner-card-section flex-grow-0 pb-2 pb-xl-0">
                        <div className="info-header-title">
                            <h4>Predictors</h4>
                        </div>
                        <div className="info-body">
                            <PredictorsSection {...{ context, getTipForField, currentTranscriptIdx }} />
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
});

/**
 * In some scenarios we may have arrays for some fields, esp for gnomad v2 exome.
 * This is a simple workaround to standardize to show only first value, if this is case & >1 value (rare).
 * In future we may change how this logic works (so instead of [0], the index of the least rare total frequency to be shown.)
 */
function standardizeGnomadValue(value, fallbackElem = <em data-tip="Not Available"> - </em>){
    if (typeof value === "number") return value;
    if (Array.isArray(value) && _.every(value, function(v){ return typeof v === "number"; })) {
        return value[0]; // Pick first
    }
    return fallbackElem;
}

const GnomADTable = React.memo(function GnomADTable(props){
    const { context, getTipForField, prefix = "csq_gnomadg" } = props;
    const { variant } = context;
    const {
        // Allele Counts
        [prefix + "_ac"]: gnomad_ac,      // Total
        [prefix + "_ac-xx"]: gnomad_ac_female, // Female
        [prefix + "_ac-xy"]: gnomad_ac_male, // Male
        // Allele Frequences
        [prefix + "_af"]: gnomad_af,
        [prefix + "_af-xx"]: gnomad_af_female,
        [prefix + "_af-xy"]: gnomad_af_male,
        // Allele Numbers
        [prefix + "_an"]: gnomad_an,
        [prefix + "_an-xx"]: gnomad_an_female,
        [prefix + "_an-xy"]: gnomad_an_male,
        // Homozygote Numbers
        [prefix + "_nhomalt"]: gnomad_nhomalt,
        [prefix + "_nhomalt-xx"]: gnomad_nhomalt_female,
        [prefix + "_nhomalt-xy"]: gnomad_nhomalt_male
    } = variant;

    const populationsAncestryList = [
        // Todo: eventually collect from schemas?
        ["afr", "African-American/African"],
        ["ami", "Amish"],
        ["amr", "Latino"],
        ["asj", "Ashkenazi Jewish"],
        ["eas", "East Asian"],
        ["fin", "Finnish"],
        ["nfe", "Non-Finnish European"],
        ["sas", "South Asian"],
        ["mid", "Middle Eastern"],
        ["oth", "Other Ancestry"]
    ];
    const ancestryRowData = _.sortBy(
        populationsAncestryList.map(function([popStr, populationTitle]){
            const {
                [prefix + "_ac-" + popStr]: alleleCount,
                [prefix + "_af-" + popStr]: alleleFreq,
                [prefix + "_an-" + popStr]: alleleNum,
                [prefix + "_nhomalt-" + popStr]: homozygoteNum,
            } = variant;
            return { popStr, populationTitle, alleleCount, alleleFreq, alleleNum, homozygoteNum };
        }),
        function({ alleleFreq }){
            return -alleleFreq;
        }
    );
    const ancestryTableRows = ancestryRowData.map(function({ popStr, populationTitle, alleleCount, alleleFreq, alleleNum, homozygoteNum }){
        return (
            <tr key={populationTitle}>
                <td className="text-600 text-left">{ populationTitle }</td>
                <td>{ standardizeGnomadValue(alleleCount) }</td>
                <td>{ standardizeGnomadValue(alleleNum) }</td>
                <td>{ standardizeGnomadValue(homozygoteNum) }</td>
                <td className="text-left">{ alleleFreq === 0 ? "0.0000" : standardizeGnomadValue(alleleFreq) }</td>
            </tr>
        );
    });

    return (
        <table className="w-100">
            <thead>
                <tr>
                    <th className="text-left">Population</th>
                    <th data-tip={getTipForField(prefix + "_ac")}>Allele Count</th>
                    <th data-tip={getTipForField(prefix + "_an")}>Allele Number</th>
                    <th data-tip={getTipForField(prefix + "_nhomalt")}># of Homozygotes</th>
                    <th className="text-left" data-tip={getTipForField(prefix + "_af")}>Allele Frequency</th>
                </tr>
            </thead>
            <tbody>
                { ancestryTableRows }
                <tr className="border-top">
                    <td className="text-600 text-left">Female</td>
                    <td>{ standardizeGnomadValue(gnomad_ac_female) }</td>
                    <td>{ standardizeGnomadValue(gnomad_an_female) }</td>
                    <td>{ standardizeGnomadValue(gnomad_nhomalt_female) }</td>
                    <td className="text-left">{ gnomad_af_female === 0 ? "0.0000" : standardizeGnomadValue(gnomad_af_female) }</td>
                </tr>
                <tr>
                    <td className="text-600 text-left">Male</td>
                    <td>{ standardizeGnomadValue(gnomad_ac_male) }</td>
                    <td>{ standardizeGnomadValue(gnomad_an_male) }</td>
                    <td>{ standardizeGnomadValue(gnomad_nhomalt_male) }</td>
                    <td className="text-left">{ gnomad_af_male === 0 ? "0.0000" : standardizeGnomadValue(gnomad_af_male) }</td>
                </tr>
                <tr className="border-top">
                    <td className="bg-light text-left"><strong>Total</strong></td>
                    <td className="bg-light text-600">{ standardizeGnomadValue(gnomad_ac) }</td>
                    <td className="bg-light text-600">{ standardizeGnomadValue(gnomad_an) }</td>
                    <td className="bg-light text-600">{ standardizeGnomadValue(gnomad_nhomalt) }</td>
                    <td className="bg-light text-600 text-left">{ gnomad_af === 0 ? "0.0000" : standardizeGnomadValue(gnomad_af) }</td>
                </tr>
            </tbody>
        </table>
    );
});



function ClinVarSection({ context, getTipForField, schemas, clinvarExternalHref }){
    const { variant } = context;
    const {
        csq_clinvar: variationID,
        csq_clinvar_clnsig: clinicalSignificance,
        csq_clinvar_clnsigconf: conflictingClinicalSignificance,
        clinvar_submission = [], // TODO - missing in data rn.
        csq_clinvar_clnrevstat: reviewStatus
    } = variant;

    if (!variationID) {
        // No ClinVar info available ??
        return (
            <div className="d-flex align-items-center justify-content-center text-large h-100">
                <h4 className="font-italic text-400 my-0 pb-08">No record in ClinVar</h4>
            </div>
        );
    }

    const submissionLen = clinvar_submission.length;
    const submissionsRendered = clinvar_submission.map(function(submission, idx){
        const { clinvar_submission_accession } = submission;
        return <ClinVarSubmissionEntry submission={submission} key={clinvar_submission_accession || idx} index={idx} />;
    });

    return (
        <React.Fragment>

            <div className="row mb-1">
                <div className="col">
                    <label data-tip={getTipForField("csq_clinvar")} className="mr-1 mb-0">ID: </label>
                    { clinvarExternalHref?
                        <a href={clinvarExternalHref} target="_blank" rel="noopener noreferrer">
                            { variationID }
                            <i className="icon icon-external-link-alt fas ml-07 text-small"/>
                        </a>
                        : <span>{ variationID }</span> }
                </div>
                <div className="col">
                    <label data-tip={getTipForField("clinvar_submission")} className="mr-1 mb-0">Submissions: </label>
                    <span>
                        { submissionLen }
                    </span>
                </div>
            </div>

            <div className="row">
                <div className="col-3">
                    <label data-tip={getTipForField("csq_clinvar_clnsig")} className="mb-03">Interpretation: </label>
                </div>
                <div className="col-9">
                    { clinicalSignificance }
                </div>
            </div>

            <div className="row">
                <div className="col-3">
                    <label data-tip={getTipForField("csq_clinvar_clnrevstat")} className="mb-0">Review Status: </label>
                </div>
                <div className="col-9">
                    { reviewStatus }
                </div>
            </div>

            <hr/>

            <div>
                <div className="row mb-08">
                    <div className="col-3">
                        <h6 className="my-0 text-600">Classification</h6>
                    </div>
                    <div className="col-2">
                        <h6 className="my-0 text-600">Date</h6>
                    </div>
                    <div className="col-4">
                        <h6 className="my-0 text-600">Submitted By</h6>
                    </div>
                    <div className="col-3">
                        <h6 className="my-0 text-600">Links</h6>
                    </div>
                </div>

                { submissionsRendered }

            </div>

        </React.Fragment>
    );
}

function ClinVarSubmissionEntry({ submission, index = 0 }){
    const fallbackElem = <em data-tip="Not Available"> - </em>;
    const {
        clinvar_submission_interpretation = null,
        clinvar_submission_submitter = fallbackElem,
        clinvar_submission_accession = fallbackElem // change into link when available
    } = submission;

    const interpretation = clinvar_submission_interpretation || fallbackElem;
    const fakeStatusValue = clinvar_submission_interpretation ? clinvar_submission_interpretation.toLowerCase() : null;

    return (
        <div className={"my-1 border rounded p-1" + (index % 2 === 0 ? " bg-light" : "")}>
            <div className="row align-items-center text-small">
                <div className="col-3" data-field="clinvar_submission_interpretation">
                    <i className="status-indicator-dot mr-07 ml-05" data-status={fakeStatusValue} />
                    { interpretation }
                </div>
                <div className="col-2">
                    { fallbackElem }
                </div>
                <div className="col-4">
                    { clinvar_submission_submitter }
                </div>
                <div className="col-3">
                    { clinvar_submission_accession }
                </div>
            </div>
        </div>
    );
}

function PredictorsSection({ context, getTipForField, currentTranscriptIdx }){
    const { variant } = context;
    const fallbackElem = <em data-tip="Not Available"> - </em>;
    const {
        csq_gerp_rs = fallbackElem,
        csq_gerp_rs_rankscore = fallbackElem,
        csq_phylop100way_vertebrate = fallbackElem,
        csq_phylop100way_vertebrate_rankscore = fallbackElem,
        csq_cadd_phred = fallbackElem,
        csq_cadd_raw_rankscore = fallbackElem,
        transcript = [],
        spliceaiMaxds = fallbackElem,
        csq_primateai_pred = fallbackElem,
        csq_primateai_score = fallbackElem,
        csq_primateai_rankscore = fallbackElem,
        csq_sift_score = fallbackElem,
        csq_sift_pred = fallbackElem,
        csq_sift_converted_rankscore = fallbackElem,
        csq_polyphen2_hvar_score = fallbackElem,
        csq_polyphen2_hvar_pred = fallbackElem,
        csq_polyphen2_hvar_rankscore = fallbackElem,
        csq_revel_rankscore = fallbackElem,
        csq_revel_score = fallbackElem,
        csq_phylop30way_mammalian = fallbackElem,
        csq_phastcons100way_vertebrate = fallbackElem
    } = variant;

    // Not too sure whether to use table or <row> and <cols> here..
    // Went with <table> since is more semantically correct for the data we're
    // displaying, IMO...

    return (
        <React.Fragment>

            <div className="d-flex align-items-center">
                <h5 className="col-auto px-0 mt-0 mb-08">Conservation</h5>
                {/* todo: boxes/identifiers at right */}
            </div>

            <div className="table-container">
                <table className="w-100">
                    <PredictorsTableHeading/>
                    <tbody>
                        <tr>
                            <td className="text-left">
                                <label className="mb-0" data-tip={getTipForField("csq_gerp_rs")}>GERP++</label>
                            </td>
                            <td className="text-left">{ csq_gerp_rs }</td>
                            <td className="text-left">{ fallbackElem }</td>
                            <td className="text-left">{ csq_gerp_rs_rankscore }</td>
                        </tr>
                        <tr>
                            <td className="text-left">
                                <label className="mb-0" data-tip={getTipForField("csq_phylop100way_vertebrate")}>PhyloP (100 Vertebrates)</label>
                            </td>
                            <td className="text-left">{ csq_phylop100way_vertebrate }</td>
                            <td className="text-left">{ fallbackElem }</td>
                            <td className="text-left">{ csq_phylop100way_vertebrate_rankscore }</td>
                        </tr>
                        <tr>
                            <td className="text-left">
                                <label className="mb-0" data-tip={getTipForField("csq_cadd_phred")}>CADD</label>
                            </td>
                            <td className="text-left">{ csq_cadd_phred }</td>
                            <td className="text-left">{ fallbackElem }</td>
                            <td className="text-left">{ csq_cadd_raw_rankscore }</td>
                        </tr>
                         <tr>
                            <td className="text-left">
                                <label className="mb-0" data-tip={getTipForField("csq_phylop30way_mammalian")}>PhyloP (30 Mammals)</label>
                            </td>
                            <td className="text-left">{ csq_phylop30way_mammalian }</td>
                            <td className="text-left">{ fallbackElem }</td>
                            <td className="text-left">{ fallbackElem }</td>
                        </tr>
                        <tr>
                            <td className="text-left">
                                <label className="mb-0" data-tip={getTipForField("csq_phastcons100way_vertebrate")}>PhastCons (100 Vertebrates)</label>
                            </td>
                            <td className="text-left">{ csq_phastcons100way_vertebrate }</td>
                            <td className="text-left">{ fallbackElem }</td>
                            <td className="text-left">{ fallbackElem }</td>
                        </tr>
                    </tbody>
                </table>
            </div>



            <div className="d-flex align-items-center">
                <h5 className="col-auto px-0 mt-16 mb-08">Missense</h5>
                {/* todo: boxes/identifiers at right */}
            </div>

            <div className="table-container">
                <table className="w-100">
                    <PredictorsTableHeading/>
                    <tbody>
                        <tr>
                            <td className="text-left">
                                <label className="mb-0" data-tip={getTipForField("csq_sift_score")}>SIFT</label>
                            </td>
                            <td className="text-left">{ csq_sift_score }</td>
                            <td className="text-left">{ csq_sift_pred }</td>
                            <td className="text-left">{ csq_sift_converted_rankscore }</td>
                        </tr>
                        <tr>
                            <td className="text-left">
                                <label className="mb-0" data-tip={getTipForField("csq_polyphen2_hvar_score")}>PolyPhen2</label>
                            </td>
                            <td className="text-left">{ csq_polyphen2_hvar_score }</td>
                            <td className="text-left">{ csq_polyphen2_hvar_pred }</td>
                            <td className="text-left">{ csq_polyphen2_hvar_rankscore }</td>
                        </tr>
                        <tr>
                            <td className="text-left">
                                <label className="mb-0" data-tip={getTipForField("csq_primateai_score")}>PrimateAI DL Score</label>
                            </td>
                            <td className="text-left">{ csq_primateai_score }</td>
                            <td className="text-left">{ csq_primateai_pred }</td>
                            <td className="text-left">{ csq_primateai_rankscore }</td>
                        </tr>
                        <tr>
                            <td className="text-left">
                                <label className="mb-0" data-tip={getTipForField("csq_revel_score")}>REVEL</label>
                            </td>
                            <td className="text-left">{ csq_revel_score }</td>
                            <td className="text-left">{ fallbackElem }</td>
                            <td className="text-left">{ csq_revel_rankscore }</td>
                        </tr>
                    </tbody>
                </table>
            </div>



            <div className="d-flex align-items-center">
                <h5 className="col-auto px-0 mt-16 mb-08">Splice</h5>
                {/* todo: boxes/identifiers at right */}
            </div>

            <div className="table-container">
                <table className="w-100">
                    <thead>
                        <tr>
                            <th className="text-left w-25">Prediction Tool</th>
                            <th className="text-left w-75">Score</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td className="text-left">
                                <label className="mb-0" data-tip={getTipForField("spliceaiMaxds")}>SpliceAI</label>
                            </td>
                            <td className="text-left">{ spliceaiMaxds }</td>
                        </tr>
                    </tbody>
                </table>
            </div>

        </React.Fragment>
    );
}

function PredictorsTableHeading(){
    return (
        <thead>
            <tr>
                <th className="text-left w-25">Prediction Tool</th>
                <th className="text-left w-25">Score</th>
                <th className="text-left w-25">Prediction</th>
                <th className="text-left w-25">Rank Score (0 to 1)</th>
            </tr>
        </thead>
    );
}


function ExternalResourcesSection({ context, schemas, currentTranscriptIdx }){
    const { variant } = context;
    const { transcript = [], } = variant;
    const externalDatabaseFieldnames = [
        "csq_clinvar"
    ];

    const transcriptFieldNames = [
        "csq_feature",
        "csq_ccds",
        "csq_ensp",
        "csq_swissprot",
        "csq_trembl"
    ];

    if (!variant) {
        return null;
    }

    // For now we kind of create combo object of these above ^, transforming "transcript" to be single item for vals to be plucked from
    const currentItem = {
        "transcript" : [{}] // Keeping as arr only for consistency w. parent `context` otherwise for code itself it could've been {} instd of [{}].
    };

    externalDatabaseFieldnames.forEach(function(fieldName){
        currentItem[fieldName] = variant[fieldName];
    });

    const currentTranscript = transcript[currentTranscriptIdx] || {}; // Fallback to blank values.
    transcriptFieldNames.forEach(function(fieldName){
        const newFieldName = "transcript." + fieldName;
        externalDatabaseFieldnames.push(newFieldName);
        currentItem.transcript[0][fieldName] = currentTranscript[fieldName];
    });


    return (
        <ExternalDatabasesSection itemType="Variant" {...{ currentItem, schemas, externalDatabaseFieldnames }} />
    );
}

