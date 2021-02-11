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
    const { csq_clinvar: variationID } = variant;

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
        csq_gnomadg_ac: gnomad_ac,      // Total
        'csq_gnomadg_ac-xx': gnomad_ac_female, // Female
        'csq_gnomadg_ac-xy': gnomad_ac_male, // Male
        // Allele Frequences
        csq_gnomadg_af: gnomad_af,
        'csq_gnomadg_af-xx': gnomad_af_female,
        'csq_gnomadg_af-xy': gnomad_af_male,
        // Allele Numbers
        csq_gnomadg_an: gnomad_an,
        'csq_gnomadg_an-xx': gnomad_an_female,
        'csq_gnomadg_an-xy': gnomad_an_male,
        // Homozygote Numbers
        csq_gnomadg_nhomalt: gnomad_nhomalt,
        'csq_gnomadg_nhomalt-xx': gnomad_nhomalt_female,
        'csq_gnomadg_nhomalt-xy': gnomad_nhomalt_male
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
                ["csq_gnomadg_ac-" + popStr]: alleleCount,
                ["csq_gnomadg_af-" + popStr]: alleleFreq,
                ["csq_gnomadg_an-" + popStr]: alleleNum,
                ["csq_gnomadg_nhomalt-" + popStr]: homozygoteNum,
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
                    <th data-tip={getTipForField("csq_gnomadg_ac")}>Allele Count</th>
                    <th data-tip={getTipForField("csq_gnomadg_an")}>Allele Number</th>
                    <th data-tip={getTipForField("csq_gnomadg_nhomalt")}># of Homozygotes</th>
                    <th className="text-left" data-tip={getTipForField("csq_gnomadg_af")}>Allele Frequency</th>
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
        csq_gerp_rs: gerp = fallbackElem,
        csq_phylop100way_vertebrate = fallbackElem,
        csq_cadd_phred = fallbackElem,
        transcript = [],
        spliceaiMaxds = fallbackElem,
        csq_primateai_score = fallbackElem,
        csq_sift_score = fallbackElem,
        csq_polyphen2_hvar_score = fallbackElem
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
                            <td className="text-left">{ gerp }</td>
                            {/* TODO for all:
                            <td className="text-left">{ prediction }/td>
                            <td className="text-left">{ score }</td>
                            */}
                        </tr>
                        <tr>
                            <td className="text-left">
                                <label className="mb-0" data-tip={getTipForField("csq_phylop100way_vertebrate")}>PhyloP (100 Vertebrates)</label>
                            </td>
                            <td className="text-left">{ csq_phylop100way_vertebrate }</td>
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
                                <label className="mb-0" data-tip={getTipForField("csq_cadd_phred")}>CADD</label>
                            </td>
                            <td className="text-left">{ csq_cadd_phred }</td>
                        </tr>
                        <tr>
                            <td className="text-left">
                                <label className="mb-0" data-tip={getTipForField("csq_sift_score")}>SIFT</label>
                            </td>
                            <td className="text-left">{ csq_sift_score }</td>
                        </tr>
                        <tr>
                            <td className="text-left">
                                <label className="mb-0" data-tip={getTipForField("csq_polyphen2_hvar_score")}>PolyPhen2</label>
                            </td>
                            <td className="text-left">{ csq_polyphen2_hvar_score }</td>
                        </tr>
                        <tr>
                            <td className="text-left">
                                <label className="mb-0" data-tip={getTipForField("csq_primateai_score")}>PrimateAI DL Score</label>
                            </td>
                            <td className="text-left">{ csq_primateai_score }</td>
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

