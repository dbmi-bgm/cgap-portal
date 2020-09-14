'use strict';

import React, { useMemo, useState } from 'react';
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
    const { clinvar_variationid: variationID } = variant;

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
                const clinvarIDSchemaProperty = schemaTransforms.getSchemaProperty("clinvar_variationid", schemas, "Variant");
                ret.clinvarExternalHref = clinvarIDSchemaProperty.link.replace("<ID>", variationID);
            }
        }

        return ret;
    }, [ schemas, variationID ]);

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
                            <h4>
                                {/* todo link to GnomAD -- is there a gnomad link somewhere ? */}
                                GnomAD
                            </h4>
                        </div>
                        <div className="info-body overflow-auto">
                            <GnomADTable {...{ context, schemas, getTipForField }} />
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

const GnomADTable = React.memo(function GnomADTable({ context, getTipForField }){
    const { variant } = context;
    const {
        // Allele Counts
        gnomad_ac,      // Total
        gnomad_ac_female, // Female
        gnomad_ac_male, // Male
        // Allele Frequences
        gnomad_af, gnomad_af_female, gnomad_af_male,
        // Allele Numbers
        gnomad_an, gnomad_an_female, gnomad_an_male,
        // Homozygote Numbers
        gnomad_nhomalt, gnomad_nhomalt_female, gnomad_nhomalt_male
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
        ["oth", "Other Ancestry"]
    ];
    const ancestryRowData = _.sortBy(
        populationsAncestryList.map(function([popStr, populationTitle]){
            const {
                ["gnomad_ac_" + popStr]: alleleCount,
                ["gnomad_af_" + popStr]: alleleFreq,
                ["gnomad_an_" + popStr]: alleleNum,
                ["gnomad_nhomalt_" + popStr]: homozygoteNum,
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
                <td>{ alleleCount }</td>
                <td>{ alleleNum }</td>
                <td>{ homozygoteNum }</td>
                <td className="text-left">{ alleleFreq || "0.0000" }</td>
            </tr>
        );
    });

    return (
        <table className="w-100">
            <thead>
                <tr>
                    <th className="text-left">Population</th>
                    <th data-tip={getTipForField("gnomad_ac")}>Allele Count</th>
                    <th data-tip={getTipForField("gnomad_an")}>Allele Number</th>
                    <th data-tip={getTipForField("gnomad_nhomalt")}># of Homozygotes</th>
                    <th className="text-left" data-tip={getTipForField("gnomad_af")}>Allele Frequency</th>
                </tr>
            </thead>
            <tbody>
                { ancestryTableRows }
                <tr className="border-top">
                    <td className="text-600 text-left">Female</td>
                    <td>{ gnomad_ac_female }</td>
                    <td>{ gnomad_an_female }</td>
                    <td>{ gnomad_nhomalt_female }</td>
                    <td className="text-left">{ gnomad_af_female || "0.0000" }</td>
                </tr>
                <tr>
                    <td className="text-600 text-left">Male</td>
                    <td>{ gnomad_ac_male }</td>
                    <td>{ gnomad_an_male }</td>
                    <td>{ gnomad_nhomalt_male }</td>
                    <td className="text-left">{ gnomad_af_male || "0.0000" }</td>
                </tr>
                <tr className="border-top">
                    <td className="bg-light text-left"><strong>Total</strong></td>
                    <td className="bg-light text-600">{ gnomad_ac }</td>
                    <td className="bg-light text-600">{ gnomad_an }</td>
                    <td className="bg-light text-600">{ gnomad_nhomalt }</td>
                    <td className="bg-light text-600 text-left">{ gnomad_af || "0.0000" }</td>
                </tr>
            </tbody>
        </table>
    );
});

function ClinVarSection({ context, getTipForField, schemas, clinvarExternalHref }){
    const { variant } = context;
    const {
        clinvar_variationid: variationID,
        clinvar_clnsig: clinicalSignificance,
        clinvar_clnsigconf: conflictingClinicalSignificance,
        clinvar_submission = [],
        clinvar_clnrevstat: reviewStatus
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
                    <label data-tip={getTipForField("clinvar_variationid")} className="mr-1 mb-0">ID: </label>
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
                    <label data-tip={getTipForField("clinvar_clnsig")} className="mb-03">Interpretation: </label>
                </div>
                <div className="col-9">
                    { clinicalSignificance }
                </div>
            </div>

            <div className="row">
                <div className="col-3">
                    <label data-tip={getTipForField("clinvar_clnrevstat")} className="mb-0">Review Status: </label>
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
    const fakeStatusValue = clinvar_submission_interpretation ? ClinVarSubmissionEntry.interpretationStatusMap[clinvar_submission_interpretation.toLowerCase()] || null : null;

    return (
        <div className={"my-1 border rounded p-1" + (index % 2 === 0 ? " bg-light" : "")}>
            <div className="row align-items-center text-small">
                <div className="col-3" data-field="clinvar_submission_interpretation">
                    <i className="item-status-indicator-dot mr-07 ml-05" data-status={fakeStatusValue} />
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
// We re-use color definitions for Item.status to color our interpretation status icon.
ClinVarSubmissionEntry.interpretationStatusMap = {
    "risk factor" : "deleted", // red
    "benign" : "released", // green
    "likely benign" : "released", // green
    "uncertain significance" : "in review" // yellow
};

function PredictorsSection({ context, getTipForField, currentTranscriptIdx }){
    const { variant } = context;
    const fallbackElem = <em data-tip="Not Available"> - </em>;
    const {
        conservation_gerp = fallbackElem,
        conservation_phylop100 = fallbackElem,
        cadd_phred = fallbackElem,
        transcript = [],
        spliceai_maxds = fallbackElem,
        primateai_primatedl_score = fallbackElem
    } = variant;

    // Should we instead find transcript with largest score instead of using current?
    const currentTranscript = transcript[currentTranscriptIdx];
    const {
        vep_sift_score = fallbackElem,
        vep_sift_prediction = fallbackElem,
        vep_polyphen_score = fallbackElem,
        vep_polyphen_prediction = fallbackElem
    } = currentTranscript || {};

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
                                <label className="mb-0" data-tip={getTipForField("conservation_gerp")}>GERP++</label>
                            </td>
                            <td className="text-left">{ conservation_gerp }</td>
                            {/* TODO for all:
                            <td className="text-left">{ prediction }/td>
                            <td className="text-left">{ score }</td>
                            */}
                        </tr>
                        <tr>
                            <td className="text-left">
                                <label className="mb-0" data-tip={getTipForField("conservation_phylop100")}>PhyloP (100 Vertabrates)</label>
                            </td>
                            <td className="text-left">{ conservation_phylop100 }</td>
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
                                <label className="mb-0" data-tip={getTipForField("cadd_phred")}>CADD</label>
                            </td>
                            <td className="text-left">{ cadd_phred }</td>
                        </tr>
                        <tr>
                            <td className="text-left">
                                <label className="mb-0" data-tip={getTipForField("transcript.vep_sift_score")}>SIFT</label>
                            </td>
                            <td className="text-left">{ vep_sift_score }</td>
                        </tr>
                        <tr>
                            <td className="text-left">
                                <label className="mb-0" data-tip={getTipForField("transcript.vep_polyphen_score")}>PolyPhen2</label>
                            </td>
                            <td className="text-left">{ vep_polyphen_score }</td>
                        </tr>
                        <tr>
                            <td className="text-left">
                                <label className="mb-0" data-tip={getTipForField("primateai_primatedl_score")}>PrimateAI DL Score</label>
                            </td>
                            <td className="text-left">{ primateai_primatedl_score }</td>
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
                    <PredictorsTableHeading/>
                    <tbody>
                        <tr>
                            <td className="text-left">
                                <label className="mb-0" data-tip={getTipForField("spliceai_maxds")}>SpliceAI</label>
                            </td>
                            <td className="text-left">{ spliceai_maxds }</td>
                        </tr>
                    </tbody>
                </table>
            </div>

        </React.Fragment>
    );
}

function PredictorsTableHeading(){
    return (
        <thead className="bg-transparent">
            <tr>
                <th className="text-left w-75">Prediction Tool</th>
                <th className="text-left w-25">Score</th>
                {/* TODO (and change all to w-25):
                <th className="text-left w-25">Prediction</th>
                <th className="text-left w-25">Rank Score (0 to 1)</th>
                */}
            </tr>
        </thead>
    );
}


function ExternalResourcesSection({ context, schemas, currentTranscriptIdx }){
    const { variant } = context;
    const { transcript = [], } = variant;
    const externalDatabaseFieldnames = [
        "clinvar_variationid"
    ];

    const transcriptFieldNames = [
        "vep_feature",
        "vep_ccds",
        "vep_ensp",
        "vep_swissprot",
        "vep_trembl"
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

