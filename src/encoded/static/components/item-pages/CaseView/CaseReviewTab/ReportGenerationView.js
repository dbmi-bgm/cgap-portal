'use strict';

import React, { useCallback, useMemo, useState } from 'react';
import memoize from 'memoize-one';
import _ from 'underscore';
import { console } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';

import { AutoGrowTextArea } from './../../components/AutoGrowTextArea';
import { projectReportSettings } from './../../ReportView/project-settings-draft';


export function ReportGenerationView (props) {
    const {
        context: {
            sample,
            sample_processing
        },
        fetchedReportItem,
        onResetForm,
        variantSampleListItem
    } = props;
    const { indication: indicationFromSample } = sample || {};
    const { analysis_type: analysisTypeFromSampleProcessing } = sample_processing || {};
    const { report_sections } = projectReportSettings;
    const {
        "@id": fetchedReportAtID,
        "indication": savedIndication,
        "analysis_performed": savedAnalysisPerformed,
        "result_summary": savedResultSummary,
        "recommendations": savedRecommendations,
        "methodology": savedMethodology,
        "references": savedReferences,
    } = fetchedReportItem || {};

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
            "key": sectionKey
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
                    <ReportFindingsTable {...{ variantSamples }} />
                );
                break;
            case "recommendations":
                renderedSections.push(
                    <TextAreaGroup {...inputGroupProps} title={title || "Recommendations"}
                        defaultValue={savedRecommendations || defaultValue} />
                );
                break;
            case "additional_case_notes":
                renderedSections.push(
                    <TextAreaGroup {...inputGroupProps} title={title || "Additional Case Notes"} rows={5}
                        defaultValue={null} placeholder="Under Development..." disabled={true} />
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
                    <React.Fragment>
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
        console.log("SUBMITTED", e.target, Object.fromEntries(formData));
    }, []);

    console.log("KEYS", sortedSectionKeys);

    return (
        <form onSubmit={onSubmit} className="d-block">

            <div className="row">

                <h4 className="col text-300 mb-24">
                    Input or adjust the fields below to complete your report
                </h4>

                <div className="col-auto">
                    <div className="btn-group" role="group">
                        <button type="submit" className="btn btn-primary align-items-center d-flex">
                            <i className="icon icon-save fas mr-08"/>
                            Save
                        </button>
                        <button type="button" className="btn btn-primary align-items-center d-flex"
                            onClick={onResetForm} data-tip="Revert unsaved changes">
                            <i className="icon icon-undo fas mr-08"/>
                            Reset
                        </button>
                    </div>
                </div>

            </div>

            { renderedWarnings }

            { renderedSections }

        </form>
    );
}

function TextAreaGroup (props) {
    const {
        sectionKey,
        sectionOptions,
        children = null,
        title = null,
        disabled: propDisabled,
        ...passProps
    } = props;
    const { readonly = false, required = false } = sectionOptions;
    const inputElementID = "report_generation_" + sectionKey;
    return (
        <div className="form-group">
            { children ? children : <label htmlFor={inputElementID}>{ title }</label> }
            <AutoGrowTextArea {...passProps} id={inputElementID} disabled={propDisabled || readonly} name={sectionKey} />
        </div>
    );
}
TextAreaGroup.defaultProps = {
    "rows": 1,
    "defaultValue": ""
};

const ReportFindingsTable = React.memo(function ReportFindingsTable (props) {
    const { variantSamples } = props;
    const { table_tags: { tags: tableTagOptions } } = projectReportSettings;

    const tagOptionsMapping = useMemo(function(){
        const tagMap = {};
        tableTagOptions.forEach(function(tag){
            tagMap[tag.id] = tag;
        });
        return tagMap;
    }, [ tableTagOptions ]);

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

    const renderedTables = tableTagOptions.map(function(findingTag, idx){
        // const samplesForTag = findingsTableGroupings[findingTag];
        const tagOptions = tagOptionsMapping[findingTag];

        if (!tagOptions) {
            // Unsupported tag.. return.. some error..
        }

        const { title, always_visible } = tagOptions || {};

        if (typeof findingTag === "undefined") {
            // ...
        }

        console.log(findingTag);

        return (
            <div key={idx}>
                <h5>
                    { title }
                </h5>
            </div>
        );
    }).filter(function(renderedTable){
        return !!renderedTable;
    });

    console.log("FINDINGs GROUPS", findingsTableGroupings);
    return null;
});

