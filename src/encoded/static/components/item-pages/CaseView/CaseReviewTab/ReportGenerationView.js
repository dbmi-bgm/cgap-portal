'use strict';

import React, { useCallback, useMemo, useState } from 'react';
import memoize from 'memoize-one';
import _ from 'underscore';
import { console } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';

import { AutoGrowTextArea } from './../../components/AutoGrowTextArea';
import { projectReportSettings } from './../../ReportView/project-settings-draft';


export function ReportGenerationView (props) {
    const { context, fetchedReportItem } = props;
    const { sample, sample_processing } = context || {};
    const { indication: indicationFromSample } = sample || {};
    const { analysis_type: analysisTypeFromSampleProcessing } = sample_processing || {};
    const { report_sections } = projectReportSettings;
    const { "@id": fetchedReportAtID } = fetchedReportItem || {};

    console.log("TTT", fetchedReportItem);

    const sortedSectionKeys = Object.keys(report_sections).sort(function(a, b){
        const { [a]: { order: orderA = Infinity }, [b]: { order: orderB = Infinity } } = report_sections;
        return orderA < orderB ? -1 : 1;
    });


    const renderedSections = [];
    const warnings = [];

    sortedSectionKeys.forEach(function(sectionKey){
        const { [sectionKey]: sectionOptions } = report_sections;
        const { included = true, title = null } = sectionOptions;

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
                        defaultValue={indicationFromSample} />
                );
                break;
            case "analysis_performed":
                renderedSections.push(
                    <TextAreaGroup {...inputGroupProps} title={title || "Tests / Analysis Performed"}
                        defaultValue={analysisTypeFromSampleProcessing} />
                );
                break;
            case "result_summary":
                renderedSections.push(
                    <TextAreaGroup {...inputGroupProps} title={title || "Result Summary"} />
                );
                break;
            case "findings_table":
                // TODO
                break;
            case "recommendations":
                renderedSections.push(
                    <TextAreaGroup {...inputGroupProps} title={title || "Recommendations"} />
                );
                break;
            case "additional_case_notes":
                renderedSections.push(
                    <TextAreaGroup {...inputGroupProps} title={title || "Additional Case Notes"} rows={5} />
                );
                break;
            case "methodology":
                renderedSections.push(
                    <TextAreaGroup {...inputGroupProps} title={title || "Methodology"} rows={3} />
                );
                break;
            case "references":
                renderedSections.push(
                    <TextAreaGroup {...inputGroupProps} title={title || "References"} rows={5} />
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

    console.log("KEYS", sortedSectionKeys);

    return (
        <form className="d-block">

            <h4 className="text-300 mb-24">
                Input or adjust the fields below to complete your report
            </h4>

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
        ...passProps
    } = props;
    const { readonly = false, required = false } = sectionOptions;
    const inputElementID = "report_generation_" + sectionKey;
    return (
        <div className="form-group">
            { children ? children : <label htmlFor={inputElementID}>{ title }</label> }
            <AutoGrowTextArea {...passProps} id={inputElementID} disabled={readonly} />
        </div>
    );
}
TextAreaGroup.defaultProps = {
    "rows": 1,
    "defaultValue": ""
};
