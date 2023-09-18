'use strict';

import React, { useCallback, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import DropdownButton from 'react-bootstrap/esm/DropdownButton';
import DropdownItem from 'react-bootstrap/esm/DropdownItem';
import { console, schemaTransforms } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { ExternalDatabasesSection, ClinVarSection, standardizeGnomadValue } from './AnnotationSections';
import QuickPopover from '../components/QuickPopover';

/**
 * Excluding the Gene Area (under position in mockuop https://gyazo.com/81d5b75b167bddef1b4c0a97f1640c51)
 */

export const VariantTabBody = React.memo(function VariantTabBody (props) {
    const { context, schemas, currentTranscriptIdx, currentClinVarResponse, currentClinVarResponseLoading } = props;
    const { variant } = context;
    const {
        csq_clinvar: variationID,
        annotation_id: annotationID,
        hg19_chr, hg19_pos, ALT, REF
    } = variant;

    const [ showingTable, setShowingTable ] = useState("v3"); // Allowed: "v2", "v3", and maybe "summary" in future; could be converted integer instd of of text.

    const onSelectShowingTable = useCallback(function(evtKey, e){
        e.stopPropagation();
        setShowingTable(evtKey);
        return;
    });

    const { getTipForField, clinvarExternalHref } = useMemo(function(){ // TODO: consider moving to AnnotationSections & sharing between SV & SNV

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

                const { description, extended_description } = schemaProperty || {};
                if (extended_description) { return extended_description; }
                return description || null;
            };
            if (variationID) {
                const clinvarIDSchemaProperty = schemaTransforms.getSchemaProperty("csq_clinvar", schemas, "Variant");
                ret.clinvarExternalHref = clinvarIDSchemaProperty.link.replace("<ID>", variationID);
            }
        }

        return ret;
    }, [ schemas, variant ]);

    const titleDict = useMemo(function(){
        return {
            "v2": <React.Fragment><span className="text-600">gnomAD</span> v2 exome</React.Fragment>,
            "v3": <React.Fragment><span className="text-600">gnomAD</span> v3</React.Fragment>
        };
    });

    const gnomadExternalLink = useMemo(function(){
        const isDeletion = !ALT || ALT === "-"; // Can't link to deletions in gnomAD at moment.
        if (showingTable === "v3" && annotationID && !isDeletion) {
            return (
                "https://gnomad.broadinstitute.org/variant/"
                + annotationID // <- Do not wrap in encodeURIComponent -- transformed value isn't found.
                + "?dataset=gnomad_r3"
            );
        } else if (showingTable === "v2" && hg19_chr && hg19_pos && !isDeletion && REF) {
            return (
                "https://gnomad.broadinstitute.org/variant/"
                + (`chr${hg19_chr}:${hg19_pos}${REF}_${ALT}`)
                + "?dataset=gnomad_r2_1"
            );
        }
        return null;
    }, [ variant, showingTable ]);

    return (
        <div className="variant-tab-body card-body">
            <div className="row">

                <div className="col-12 col-xl-6 d-flex flex-column">

                    <div className="inner-card-section flex-grow-1 pb-2 pb-xl-1">
                        <div className="info-header-title">
                            <h4>
                                ClinVar
                                { clinvarExternalHref ?
                                    <a href={clinvarExternalHref} rel="noopener noreferrer" target="_blank"
                                        className="px-1" data-tip="View this variant in ClinVar">
                                        <i className="icon icon-external-link-alt fas ml-07 text-small"/>
                                    </a>
                                    : null }
                            </h4>
                        </div>
                        <div className={"info-body clinvar-info-body" + (currentClinVarResponse ? " has-clinvar-response" : "")}>
                            <ClinVarSection {...{ getTipForField, context, schemas, clinvarExternalHref, currentClinVarResponse }} />
                        </div>
                    </div>

                    <div className="inner-card-section flex-grow-0 pb-2 pb-xl-0">
                        <div className="info-header-title justify-content-start">

                            <DropdownButton size="lg py-1" variant="outline-secondary select-gnomad-version" onSelect={onSelectShowingTable}
                                title={titleDict[showingTable]} >
                                <DropdownItem eventKey="v3" active={showingTable === "v3"}>{ titleDict.v3 }</DropdownItem>
                                <DropdownItem eventKey="v2" active={showingTable === "v2"}>{ titleDict.v2 }</DropdownItem>
                            </DropdownButton>

                            { gnomadExternalLink ?
                                <h4>
                                    <a href={gnomadExternalLink} target="_blank" rel="noopener noreferrer"
                                        className="text-small px-1" data-tip={"View this variant in gnomAD " + showingTable}>
                                        <i className="icon icon-external-link-alt fas"/>
                                    </a>
                                </h4>
                                : null }

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
                                <label className="mb-0">GERP++</label>
                                <QuickPopover popID="GERP++" className="p-0 ml-02 icon-sm" htmlContent={getTipForField("csq_gerp_rs")} />
                            </td>
                            <td className="text-left">{ csq_gerp_rs }</td>
                            <td className="text-left">{ fallbackElem }</td>
                            <td className="text-left">{ csq_gerp_rs_rankscore }</td>
                        </tr>
                        <tr>
                            <td className="text-left">
                                <label className="mb-0">CADD</label>
                                <QuickPopover popID="CADD" className="p-0 ml-02 icon-sm" htmlContent={getTipForField("csq_cadd_phred")} />
                            </td>
                            <td className="text-left">{ csq_cadd_phred }</td>
                            <td className="text-left">{ fallbackElem }</td>
                            <td className="text-left">{ csq_cadd_raw_rankscore }</td>
                        </tr>
                        <tr>
                            <td className="text-left">
                                <label className="mb-0">phyloP (30 Mammals)</label>
                                <QuickPopover popID="phylop30" className="p-0 ml-02 icon-sm" htmlContent={getTipForField("csq_phylop30way_mammalian")} />
                            </td>
                            <td className="text-left">{ csq_phylop30way_mammalian }</td>
                            <td className="text-left">{ fallbackElem }</td>
                            <td className="text-left">{ fallbackElem }</td>
                        </tr>
                        <tr>
                            <td className="text-left">
                                <label className="mb-0">phyloP (100 Vertebrates)</label>
                                <QuickPopover popID="phylop100" className="p-0 ml-02 icon-sm" htmlContent={getTipForField("csq_phylop100way_vertebrate")} />
                            </td>
                            <td className="text-left">{ csq_phylop100way_vertebrate }</td>
                            <td className="text-left">{ fallbackElem }</td>
                            <td className="text-left">{ csq_phylop100way_vertebrate_rankscore }</td>
                        </tr>
                        <tr>
                            <td className="text-left">
                                <label className="mb-0">phastCons (100 Vertebrates)</label>
                                <QuickPopover popID="phastcons" className="p-0 ml-02 icon-sm" htmlContent={getTipForField("csq_phastcons100way_vertebrate")}/>
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
                                <label className="mb-0">SIFT</label>
                                <QuickPopover popID="SIFT" className="p-0 ml-02 icon-sm" htmlContent={getTipForField("csq_sift_score")} />
                            </td>
                            <td className="text-left">{ csq_sift_score }</td>
                            <td className="text-left">{ csq_sift_pred }</td>
                            <td className="text-left">{ csq_sift_converted_rankscore }</td>
                        </tr>
                        <tr>
                            <td className="text-left">
                                <label className="mb-0">PolyPhen2</label>
                                <QuickPopover popID="PolyPhen2" className="p-0 ml-02 icon-sm" htmlContent={getTipForField("csq_polyphen2_hvar_score")} />
                            </td>
                            <td className="text-left">{ csq_polyphen2_hvar_score }</td>
                            <td className="text-left">{ csq_polyphen2_hvar_pred }</td>
                            <td className="text-left">{ csq_polyphen2_hvar_rankscore }</td>
                        </tr>
                        <tr>
                            <td className="text-left">
                                <label className="mb-0">PrimateAI DL Score</label>
                                <QuickPopover popID="PrimateAI" className="p-0 ml-02 icon-sm" htmlContent={getTipForField("csq_primateai_score")} />
                            </td>
                            <td className="text-left">{ csq_primateai_score }</td>
                            <td className="text-left">{ csq_primateai_pred }</td>
                            <td className="text-left">{ csq_primateai_rankscore }</td>
                        </tr>
                        <tr>
                            <td className="text-left">
                                <label className="mb-0">REVEL</label>
                                <QuickPopover popID="REVEL" className="p-0 ml-02 icon-sm" htmlContent={getTipForField("csq_revel_score")} />
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
                                <label className="mb-0">SpliceAI</label>
                                <QuickPopover popID="SpliceAI" className="p-0 ml-02 icon-sm" htmlContent={getTipForField("spliceaiMaxds")} />
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
    const {
        transcript = [],
        CHROM: hg38CHR,
        POS: hg38POS
    } = variant;

    if (!variant) {
        return null;
    }

    const externalDatabaseFieldnames = [
        "csq_clinvar"
    ];

    // Prepended with "transcript." and added to above `externalDatabaseFieldnames`.
    const transcriptFieldNames = [
        "csq_feature",
        "csq_ccds",
        "csq_ensp",
        "csq_swissprot",
        "csq_trembl"
    ];

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


    // Additional things not in a single schema field.
    const externalResourcesAppend = [];
    if (hg38CHR && hg38POS) {
        const chrPosVal = `chr${hg38CHR}:${hg38POS}`;
        externalResourcesAppend.push(
            <div className="row mb-03" key="POS">
                <div className="col-12 col-lg">
                    <label className="mb-0 black-label" htmlFor="external_resource_for_ucsc_hg38" data-tip="See position in UCSC Genome Browser">
                        UCSC Genome Browser
                    </label>
                </div>
                <div className="col-12 col-lg-auto">
                    <a href={"https://genome.ucsc.edu/cgi-bin/hgTracks?db=hg38&position=" + chrPosVal} className="d-block" target="_blank" rel="noopener noreferrer" id="external_resource_for_ucsc_hg38">
                        <span className="align-middle">{ chrPosVal }</span>
                        <i className="ml-05 icon icon-fw icon-external-link-alt fas text-smaller text-secondary" />
                    </a>
                </div>
            </div>
        );
    }
    externalResourcesAppend.push(hgmdSearchLink);

    return (
        <ExternalDatabasesSection itemType="Variant" {...{ currentItem, schemas, externalDatabaseFieldnames }} appendItems={externalResourcesAppend} />
    );
}

const hgmdSearchLink = [
    <div className="row mb-03" key="POS">
        <div className="col-12 col-lg">
            <label className="mb-0 black-label" htmlFor="external_resource_for_hgmdidsearch" data-tip="HGMD Public (Human Gene Mutation Database)">
                HGMD (Professional)
            </label>
        </div>
        <div className="col-12 col-lg-auto">
            <a href="https://my.qiagendigitalinsights.com/bbp/view/hgmd/pro/search_mut.php" className="d-block" target="_blank" rel="noopener noreferrer" id="external_resource_for_hgmdidsearch">
                <span className="align-middle">Search</span>
                <i className="ml-05 icon icon-fw icon-external-link-alt fas text-smaller text-secondary" />
            </a>
        </div>
    </div>
];