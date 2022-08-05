'use strict';

import React, { useCallback, useMemo, useState } from 'react';
import memoize from 'memoize-one';
import _ from 'underscore';
import { console, ajax } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Checkbox } from '@hms-dbmi-bgm/shared-portal-components/es/components/forms/components/Checkbox';
import { LocalizedTime } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/LocalizedTime';

import { GenesMostSevereDisplayTitle, GenesMostSevereHGVSCColumn, ProbandGenotypeLabelColumn } from './../../../browse/variantSampleColumnExtensionMap';
import { DiscoveryCandidacyColumn, ACMGClassificationColumn } from './../VariantSampleSelection';
import { AutoGrowTextArea } from './../../components/AutoGrowTextArea';
import { projectReportSettings } from './../../ReportView/project-settings-draft';



export const ReportGenerationView = React.memo(function ReportGenerationView (props) {
    const {
        context,
        fetchedReportItem,
        fetchReportItem,
        onResetForm,
        variantSampleListItem,
        visible = true
    } = props;
    const { sample, sample_processing } = context || {};
    const { indication: indicationFromSample } = sample || {};
    const { analysis_type: analysisTypeFromSampleProcessing } = sample_processing || {};
    const { report_sections } = projectReportSettings;
    const {
        "@id": fetchedReportAtID,
        "indication": savedIndication,
        "analysis_performed": savedAnalysisPerformed,
        "result_summary": savedResultSummary,
        "recommendations": savedRecommendations,
        "extra_notes": savedExtraNotes,
        "methodology": savedMethodology,
        "references": savedReferences,
        "findings_texts": savedFindingsTexts,
        "last_modified": { date_modified: reportLastModified = null } = {}
    } = fetchedReportItem || {};

    const [ isPatching, setIsPatching ] = useState(false);

    const sortedSectionKeys = useMemo(function(){
        return Object.keys(report_sections).sort(function(a, b){
            const { [a]: { order: orderA = Infinity }, [b]: { order: orderB = Infinity } } = report_sections;
            return orderA < orderB ? -1 : 1;
        });
    }, [ report_sections ]);

    const { variant_samples: vsObjects = [] } = variantSampleListItem || {};
    const variantSamples = vsObjects.map(function({ variant_sample_item }){
        return variant_sample_item;
    });

    const renderedSections = [];
    const warnings = [];

    sortedSectionKeys.forEach(function(sectionKey){
        const { [sectionKey]: sectionOptions } = report_sections;
        const { included = true, title = null, defaultValue } = sectionOptions;

        if (!included) {
            // TODO: If we add checkboxes here for toggling if in report or not,
            // we could skip filtering and instead pre-populate the checkbox values with 'included'
            return;
        }

        const inputGroupProps = {
            sectionKey,
            sectionOptions,
            //"disabled": !fetchedReportAtID,
            "key": sectionKey,
            visible
        };

        // TODO: Consider converting case-switch into an object of render functions
        // Especially if we need to do same thing as here for the report PDF body generation.
        switch (sectionKey) {
            case "indication":
                renderedSections.push(
                    <TextAreaGroup {...inputGroupProps} title={title || "Indication"}
                        defaultValue={savedIndication || indicationFromSample} />
                );
                break;
            case "analysis_performed":
                renderedSections.push(
                    <TextAreaGroup {...inputGroupProps} title={title || "Tests / Analysis Performed"}
                        defaultValue={savedAnalysisPerformed || analysisTypeFromSampleProcessing} />
                );
                break;
            case "result_summary":
                renderedSections.push(
                    <TextAreaGroup {...inputGroupProps} title={title || "Result Summary"}
                        defaultValue={savedResultSummary || defaultValue} />
                );
                break;
            case "findings_table":
                // TODO
                renderedSections.push(
                    <ReportFindingsTable {...{ variantSamples, visible }} reportItem={fetchedReportItem} />
                );
                break;
            case "recommendations":
                renderedSections.push(
                    <TextAreaGroup {...inputGroupProps} title={title || "Recommendations"}
                        defaultValue={savedRecommendations || defaultValue} />
                );
                break;
            case "extra_notes":
                renderedSections.push(
                    <TextAreaGroup {...inputGroupProps} title={title || "Additional Case Notes"} rows={5}
                        defaultValue={savedExtraNotes || defaultValue} />
                );
                break;
            case "methodology":
                renderedSections.push(
                    <TextAreaGroup {...inputGroupProps} title={title || "Methodology"} rows={3}
                        defaultValue={savedMethodology || defaultValue} />
                );
                break;
            case "references":
                renderedSections.push(
                    <TextAreaGroup {...inputGroupProps} title={title || "References"} rows={5}
                        defaultValue={savedReferences || defaultValue} />
                );
                break;
            default:
                warnings.push(
                    <React.Fragment key={sectionKey}>
                        Section { title ? <> &lsquo;{ title }&rsquo; (<code>{ sectionKey }</code>)</> : <code>{ sectionKey }</code> } not supported.
                    </React.Fragment>
                );
        }
    });

    let renderedWarnings = null;
    if (warnings.length > 0) {
        renderedWarnings = (
            <div className="border-top border-bottom border-danger py-2 mb-16">
                <h6 className="mt-0 mb-04 text-danger">Warnings:</h6>
                <ul className="my-0 pl-36">
                    { warnings.map(function(warning, idx){ return <li key={idx}>{ warning }</li>; }) }
                </ul>
            </div>
        );
    }


    const onSubmit = useCallback(function(e){
        e.stopPropagation();
        e.preventDefault();
        const formData = new FormData(e.target);
        const patchPayload = {};
        const deleteFields = [];

        setIsPatching(true);

        sortedSectionKeys.forEach(function(sectionKey){
            const { [sectionKey]: sectionOptions } = report_sections;
            const { included = true, title = null, defaultValue } = sectionOptions;
            if (!included) {
                return;
            }
            if (sectionKey === "findings_table") {
                // Special case
                patchPayload.findings_texts = {};
                for (var k of formData.keys()) {
                    if (k.substring(0, 17) !== "finding_tag_text_") {
                        continue;
                    }
                    const findingTag = k.substring(17);
                    patchPayload.findings_texts[findingTag] = formData.get(k);
                }
                return;
            }
            if (formData.has(sectionKey)) {
                const formValue = formData.get(sectionKey);
                if (formValue === "") {
                    if (fetchedReportItem[sectionKey]) {
                        deleteFields.push(sectionKey);
                    }
                } else {
                    patchPayload[sectionKey] = formValue;
                }
            } else if (sectionKey === "indication") {
                // If disabled, use default auto-populated value.
                patchPayload[sectionKey] = indicationFromSample;
            } else if (sectionKey === "analysis_performed") {
                patchPayload[sectionKey] = analysisTypeFromSampleProcessing;
            }

        });

        const targetHref = fetchedReportAtID + (deleteFields.length > 0 ? "?delete_fields=" + deleteFields.join(",") : "");
        ajax.promise(targetHref, "PATCH", {}, JSON.stringify(patchPayload)).then(function(resp){
            console.info("PATCHed Report", resp);
            fetchReportItem(function(){
                setIsPatching(false);
            });
        });


        // const formObject = Object.fromEntries(formData);
        // TODO: Doesn't grab disabled fields, need to grab values from these manually.
        console.log("SUBMITTING", Object.fromEntries(formData), patchPayload);
    }, [ projectReportSettings, context, fetchReportItem ]);

    return (
        <form onSubmit={onSubmit} className="d-block pt-16 container">

            <div className="row">

                <h4 className="col text-300 mb-24">
                    Input or adjust the fields below to complete your report
                </h4>

                <div className="col-auto d-flex align-items-center">
                    <div className="last-saved text-small">
                        <i className="icon icon-clock far mr-06" data-tip="Last Modified" />
                        <LocalizedTime timestamp={reportLastModified} formatType="date-time-md" />
                    </div>
                    <div className="ml-12">
                        <button type="submit" className="btn btn-primary align-items-center d-flex" disabled={isPatching}>
                            <i className={`icon icon-fw icon-${isPatching ? "circle-notch spin" : "save"} fas mr-08`}/>
                            Save
                        </button>
                        {/*
                        <div className="btn-group" role="group">
                            <button type="submit" className="btn btn-primary align-items-center d-flex" disabled={isPatching}>
                                <i className={`icon icon-fw icon-${isPatching ? "circle-notch spin" : "save"} fas mr-08`}/>
                                Save
                            </button>
                            <button type="button" className="btn btn-primary align-items-center d-flex"
                                onClick={onResetForm} data-tip="Revert unsaved changes">
                                <i className="icon icon-fw icon-undo fas mr-08"/>
                                Reset
                            </button>
                        </div>
                        */}
                    </div>
                </div>

            </div>

            { renderedWarnings }

            { renderedSections }

        </form>
    );
});

function TextAreaGroup (props) {
    const {
        sectionKey,
        sectionOptions,
        children = null,
        title = null,
        disabled: propDisabled,
        ...passProps
    } = props;
    const { readonly = false, required = false } = sectionOptions || {};
    const inputElementID = "report_generation_" + sectionKey;
    return (
        <div className="form-group mb-2 border-bottom pb-24">
            { children ? children : title ? <label htmlFor={inputElementID}>{ title }</label> : null }
            <AutoGrowTextArea {...passProps} id={inputElementID} disabled={propDisabled || readonly} name={sectionKey} />
        </div>
    );
}
TextAreaGroup.defaultProps = {
    "rows": 1,
    "defaultValue": ""
};

const ReportFindingsTable = React.memo(function ReportFindingsTable (props) {
    const { variantSamples, reportItem, visible = true } = props;
    const {
        table_tags: {
            tags: tableTagOptions = []
        }
    } = projectReportSettings;
    const { findings_texts = {} } = reportItem || {};

    const findingsTableGroupings = _.groupBy(variantSamples, "finding_table_tag");
    const findingsTableKeysFound = Object.keys(findingsTableGroupings);
    const findingsTableKeysFoundLen = findingsTableKeysFound.length;
    const noGroupsFound = findingsTableKeysFoundLen === 1 && typeof findingsTableKeysFound[0] === "undefined";

    if (noGroupsFound) {
        return (
            <div className="border-top border-bottom py-2 mb-16">
                <h5>No finding table tags applied to any variant samples.</h5>
            </div>
        );
    }

    const renderedTables = tableTagOptions.map(function(tagOptions, idx){
        const { id, title, always_visible = false, none_tagged_fallback_text } = tagOptions || {};
        const samplesForTag = findingsTableGroupings[id] || [];
        const samplesForTagLen = samplesForTag.length;
        const savedTagNoteText = findings_texts[id] || null;

        if (samplesForTagLen === 0 && !always_visible) {
            // Exclude, unless options say to always show this table even if no results.
            return null;
        }

        const header = (
            <h5>
                <span className="text-600 text-uppercase">{ title }</span>
                <span className="text-400">{` - ${samplesForTagLen} Variant${samplesForTagLen === 1 ? "" : "s"}`}</span>
            </h5>
        );

        if (samplesForTagLen === 0) {
            return (
                <div className="mb-24" key={idx}>
                    <ReportFindingsTableNoSamplesFallback {...{ header, visible, id }}
                        defaultValue={savedTagNoteText || none_tagged_fallback_text} />
                </div>
            );
        }

        return (
            <div className="mb-24" key={idx}>
                { header }
                <ReportFindingsFindingTable variantSamples={samplesForTag} tagOptions={tagOptions} />
                {/* <label className="d-block text-small">Finding Notes</label> */}
                {/* <AutoGrowTextArea visible={visible} defaultValue={savedTagNoteText} rows={1} name={"finding_tag_text_" + id} /> */}
            </div>
        );
    }).filter(function(renderedTable){
        return !!renderedTable;
    });

    // console.log("FINDINGs GROUPS", findingsTableGroupings, findingsTableKeysFound);

    return (
        <div className="mb-2 findings-tables-section border-bottom">
            { renderedTables }
        </div>
    );
});

function ReportFindingsTableNoSamplesFallback (props) {
    const { header, id, visible, defaultValue, includeDefaultChecked = true } = props;
    const [ includeChecked, setIncludeChecked ] = useState(includeDefaultChecked);
    const onCheck = useCallback(function(e){
        setIncludeChecked(function(currentIncludeChecked){
            return !currentIncludeChecked;
        });
    });
    return (
        <React.Fragment>
            <div className="d-flex align-items-center">
                { header }
                <Checkbox name={"include_finding_tag_text_" + id} onChange={onCheck} checked={includeChecked} className="ml-16">
                    Add text in place of table?
                </Checkbox>
            </div>
            <AutoGrowTextArea {...{ defaultValue, visible }} rows={1} disabled={!includeChecked} name={"finding_tag_text_" + id} className="mb-16" />
        </React.Fragment>
    );
}


const ReportFindingsFindingTable = React.memo(function ReportFindingsFindingTable (props) {
    const { variantSamples = [], tagOptions } = props;
    const {
        table_columns: {
            gene: showGeneCol = true,
            variant: showVariantCol = true,
            genotype: showGenotypeCol = true,
            discovery_strength: showDiscoveryCol = true,
            acmg_classification: showACMGClassificationCol = true
        } = {},
        show_icons,
        primary_theme
    } = tagOptions || {};

    const bodyRows = variantSamples.map(function(vs, idx){
        const {
            variant : { genes : [ firstGene = null ] = [] } = {},
            interpretation: clinicalInterpretationNote = null,
            discovery_interpretation: discoveryInterpretationNote = null
        } = vs;
        const cols = [];
        if (showGeneCol) cols.push(
            <td key={0}>
                <GenesMostSevereDisplayTitle result={vs} align="left" showTips={false} truncate={false} />
            </td>
        );
        if (showVariantCol) cols.push(
            <td key={1}>
                <GenesMostSevereHGVSCColumn gene={firstGene} align="left" showTips={false} truncate={false} />
            </td>
        );
        if (showGenotypeCol) cols.push(
            <td key={2}>
                <ProbandGenotypeLabelColumn result={vs} align="left" showTips={false} truncate={false} showIcon={show_icons} />
            </td>
        );
        if (showACMGClassificationCol) cols.push(
            <td key={3}>
                <ACMGClassificationColumn clinicalInterpretationNote={clinicalInterpretationNote} showIcon={show_icons} />
            </td>
        );
        if (showDiscoveryCol) cols.push(
            <td key={4}>
                <DiscoveryCandidacyColumn discoveryInterpretationNote={discoveryInterpretationNote} showIcon={show_icons} />
            </td>
        );
        return <tr key={idx}>{ cols }</tr>;
    });

    return (
        <table className={"report-findings-table table table-striped" + (primary_theme ? " primary-theme" : "")}>
            <thead>
                <ReportFindingsFindingTableHeader tagOptions={tagOptions} />
            </thead>
            <tbody>
                { bodyRows }
            </tbody>
        </table>
    );
});

function ReportFindingsFindingTableHeader({ tagOptions }){
    const {
        table_columns: {
            gene: showGeneCol = true,
            variant: showVariantCol = true,
            genotype: showGenotypeCol = true,
            discovery_strength: showDiscoveryCol = true,
            acmg_classification: showACMGClassificationCol = true
        } = {}
    } = tagOptions || {};

    const headerCols = [];

    if (showGeneCol) headerCols.push(
        <th scope="col" key={0}>
            Gene
        </th>
    );
    if (showVariantCol) headerCols.push(
        <th scope="col" key={1}>
            Variant
        </th>
    );
    if (showGenotypeCol) headerCols.push(
        <th scope="col" key={2}>
            Genotype
        </th>
    );
    if (showACMGClassificationCol) headerCols.push(
        <th scope="col" key={3}>
            Classification
        </th>
    );
    if (showDiscoveryCol) headerCols.push(
        <th scope="col" key={4}>
            Strength
        </th>
    );

    return <tr>{ headerCols }</tr>;
}
