'use strict';

import React from 'react';
import _ from 'underscore';

import { console, object } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { itemUtil } from '@hms-dbmi-bgm/shared-portal-components/es/components/util/object';
import { LocalizedTime, formatPublicationDate } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/LocalizedTime';
import { basicColumnExtensionMap,
    DisplayTitleColumnWrapper,
    DisplayTitleColumnDefault,
    DisplayTitleColumnUser } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/table-commons';
import { Schemas, typedefs } from './../util';

// eslint-disable-next-line no-unused-vars
const { Item, ColumnDefinition } = typedefs;

export const DEFAULT_WIDTH_MAP = { 'lg' : 200, 'md' : 180, 'sm' : 120, 'xs' : 120 };



/**
 * Theoretically we could change all these render functions to just be functional React components, maybe a later todo.
 * And move any compute-logic into here for memoization.
 */

function renderAdvancedColumn(topLeft, status, main, dateTitle, date) {
    return (
        <div className="multi-field-cell">
            <div className="top-row">
                <span className="col-topleft">
                    { topLeft }
                </span>
                <i className="item-status-indicator-dot ml-07" data-status={status} data-tip={Schemas.Term.toName("status", status)} />
            </div>
            <h4 className="col-main">
                { main || "-" }
            </h4>
            <div className="col-date" style={{ textAlign: "center", fontSize: "12px" }}>
                <strong>{dateTitle} </strong>
                { date ? <LocalizedTime timestamp={date} formatType="date-sm"/> : "N/A" }
            </div>
        </div>
    );
}


/**
 * @todo
 * Deprecated; primary case sample now located in case.samples. Keeping since may be useful in future
 * Use as a memoized function in a reusable component later.
 * Ideally we could have "SampleProcessingTableCell", "Sample...TableCell", which all use
 * `findSelectedCaseSample` to grab current sample and then feed appropriate fields from it
 * into `renderAdvancedColumn` (or the component that it'll eventually become)
 */
function findSelectedCaseSample(allSamples, selectedIndividual){
    const { '@id' : selectedID } = selectedIndividual || {};

    if (!selectedID) return null;
    const samplesLen = allSamples.length;
    for (let i = 0; i < samplesLen; i++) {
        const { individual : { '@id' : sampleIndividualID = "N/A" } = {} } = allSamples[i];
        if (selectedID === sampleIndividualID) {
            // Return as soon as possible (as soon as find match), we don't need to iterate over each.
            return allSamples[i];
        }
    }
    return null;
}

/** Used to show "Case" item-type */
export const DisplayTitleColumnCase = React.memo(function DisplayTitleCaseDefault({ result }) {
    const title = itemUtil.getTitleStringFromContext(result); // Gets display_title || title || accession || ...
    const tooltip = (typeof title === "string" && title.length > 20 && title) || null;
    const {
        '@id' : caseHref,
        display_title = null,
        accession = null,
        status = null,
        date_created = null,
        case_title = null
    } = result;

    const mainTitle = accession && case_title ? case_title : display_title;

    return (
        <a href={caseHref} className="adv-block-link w-100 title-block d-flex flex-column" data-tip={tooltip} data-delay-show={750}>
            { renderAdvancedColumn(<span className="accession">{ accession }</span>, status, mainTitle, "Accessioned:", date_created) }
        </a>
    );
});




export const columnExtensionMap = {
    ...basicColumnExtensionMap,
    'display_title' : { // TODO: Look into a better way to do this
        'title' : "Title",
        'widthMap' : { 'lg' : 280, 'md' : 250, 'sm' : 200 },
        'minColumnWidth' : 90,
        'order' : -100,
        'render' : function renderDisplayTitleColumn(result, parentProps){
            const { href, context, rowNumber, detailOpen, toggleDetailOpen } = parentProps;
            const { '@type' : itemTypeList = ["Item"] } = result;
            let renderElem;
            if (itemTypeList[0] === "User") {
                renderElem = <DisplayTitleColumnUser {...{ result }}/>;
            } else if (itemTypeList[0] === "Case") {
                renderElem = <DisplayTitleColumnCase {...{ result }}/>;
            } else {
                renderElem = <DisplayTitleColumnDefault {...{ result }}/>;
            }
            return (
                <DisplayTitleColumnWrapper {...{ result, href, context, rowNumber, detailOpen, toggleDetailOpen }}>
                    { renderElem }
                </DisplayTitleColumnWrapper>
            );
        }
    },
    // TODO: change to organization
    'lab.display_title' : {
        'title' : "Lab",
        'widthMap' : { 'lg' : 200, 'md' : 180, 'sm' : 160 },
        'render' : function labTitle(result, props){
            const { lab, submitted_by : { display_title : submitterTitle } = {} } = result;
            if (!lab) return null;
            const labLink = <a href={object.atIdFromObject(lab)}>{ lab.display_title }</a>;
            if (!submitterTitle){
                return labLink;
            }
            return (
                <span>
                    <i className="icon icon-fw icon-user far user-icon" data-html data-tip={'<small>Submitted by</small> ' + result.submitted_by.display_title} />
                    { labLink }
                </span>
            );
        }
    },
    'report': {
        'title': "Report",
        'render': function renderReportColumn(result, parentProps) {
            const {
                '@id' : resultHref,
                '@type' : itemTypeList = ["Item"],
                report = null
            } = result;
            const {
                display_title = null,
                accession = null,
                status = null,
                last_modified : { date_modified = null } = {}
            } = report || {};

            if (!report || !report.accession) {
                return null;
            }

            // May appear in other non-Case results, where advanced column will look strange, so check and use default rendering otherwise
            if (itemTypeList[0] === "Case") {
                const showAccessionSeparately = accession !== display_title;
                return (
                    <a href={resultHref} className="adv-block-link">
                        { renderAdvancedColumn(showAccessionSeparately ? <span className="accession">{ accession }</span>: null, status, display_title, "Last Modified:", date_modified) }
                    </a>
                );
            }
            return (<a href={result['@id']}> { display_title } </a>);
        }
    },
    'family': {
        'render' : function renderFamilyColumn(result, parentProps) {
            const { '@type' : itemTypeList = ["Item"], family } = result;
            if (!family) return null;
            const {
                '@id' : atId = null,
                display_title = null,
                accession = null,
                status = null,
                date_created = null,
                family_id = null
            } = family;

            // May appear in other non-Case results, where advanced column will look strange, so check and use default rendering otherwise
            if (itemTypeList[0] === "Case") {
                return (
                    <a href={atId} className="adv-block-link">
                        { renderAdvancedColumn(<span className="accession">{ accession }</span>, status, family_id, "Accessioned:", date_created) }
                    </a>
                );
            }
            return (<a href={atId}> { display_title } </a>);
        }
    },
    'individual': {
        'title': "Individual",
        'widthMap' : { 'lg' : 280, 'md' : 250, 'sm' : 200 },
        'render' : function renderIndividualColumn(result, parentProps){
            const { '@type' : itemTypeList = ["Item"], individual } = result;
            if (!individual) return null;
            const {
                '@id' : atId = null,
                display_title = null,
                accession = null,
                status = null,
                date_created = null
            } = individual;

            // May appear in other non-Case results, where advanced column will look strange, so check and use default rendering otherwise
            if (itemTypeList[0] === "Case") {
                return (
                    <a href={atId} className="adv-block-link">
                        { renderAdvancedColumn(<span className="accession">{ accession }</span>, status, display_title, "Accessioned:", date_created) }
                    </a>
                );
            }
            return (<a href={atId}> { display_title } </a>);
        }
    },
    'sample_processing.analysis_type': {
        'render' : function renderBioinformaticsColumn(result, parentProps){
            const {
                '@id' : resultHrefPath,
                sample_processing: { analysis_type = null, last_modified = {} }
            } = result;
            // Unlikely to show in non-Case item results, so didn't add Case filter
            return (
                <a href={resultHrefPath + "#case-info.bioinformatics"} className="adv-block-link">
                    { renderAdvancedColumn(null, null, analysis_type, "Last Update:", last_modified.date_modified || null)}
                </a>);
        }
    },
    'sample': {
        'render' : function renderSequencingColumn(result, parentProps){
            const { '@id' : resultHrefPath, '@type' : itemTypeList = ["Item"], sample = null } = result;
            const { '@id': sampleId, workup_type, sequencing_date } = sample || {};
            console.log("sample", sample);
            // May appear in other non-Case results, where advanced column will look strange, so check and use default rendering otherwise
            if (itemTypeList[0] === "Case") {
                return (
                    <a href={resultHrefPath + "#case-info.bioinformatics"} className="adv-block-link">
                        { renderAdvancedColumn(null, null, workup_type, "Sequenced:", sequencing_date) }
                    </a>);
            }
            return (<a href={sampleId}> { display_title } </a>);
        }
    },
    'sample.specimen_type': {
        'render' : function renderSampleColumn(result, parentProps){
            const { '@type' : itemTypeList = ["Item"], sample = null } = result;
            const { '@id': sampleId, accession, status, specimen_type, specimen_collection_date } = sample || {};
            // Unlikely to show in non-Case item results, so didn't add Case filter
            return (
                <a href={sampleId} className="adv-block-link">
                    {renderAdvancedColumn(<span className="accession">{ accession }</span>, status, specimen_type, "Collected:", specimen_collection_date)}
                </a>);
        }
    },
    'date_published' : {
        'widthMap' : { 'lg' : 140, 'md' : 120, 'sm' : 120 },
        'render' : function(result, props){
            if (!result.date_published) return null;
            return <span className="value">{ formatPublicationDate(result.date_published) }</span>;
        },
        'order' : 504
    },
    'google_analytics.for_date' : {
        'title' : 'Analytics Date',
        'widthMap' : { 'lg' : 140, 'md' : 120, 'sm' : 120 },
        'render' : function googleAnalyticsDate(result, props){
            if (!result.google_analytics || !result.google_analytics.for_date) return null;
            return <LocalizedTime timestamp={result.google_analytics.for_date} formatType="date-sm" localize={false} />;
        }
    },
    'age' : {
        "title" : "Age",
        "widthMap" : { 'lg' : 100, 'md' : 90, 'sm' : 80 },
        "render" : function(result, props){
            const { age, age_units } = result;
            if (typeof age !== "number" || isNaN(age)) {
                return null;
            }
            let showAge = age;
            if (age_units) {
                showAge = age + " " + age_units + (age === 1 ? "" : "s");
            }
            return <span className="value">{ showAge }</span>;
        }
    },
    'age_at_death' : {
        "title" : "Age at Death",
        "widthMap" : { 'lg' : 100, 'md' : 90, 'sm' : 80 },
        "render" : function(result, props){
            const { age_at_death: age, age_at_death_units: age_units } = result;
            if (typeof age !== "number" || isNaN(age)) {
                return null;
            }
            let showAge = age;
            if (age_units) {
                showAge = age + " " + age_units + (age === 1 ? "" : "s");
            }
            return <span className="value">{ showAge }</span>;
        }
    },
    'status' : {
        'title' : 'Status',
        'widthMap' : { 'lg' : 120, 'md' : 120, 'sm' : 100 },
        'order' : 501,
        'render' : function statusIndicator(result, props){
            const statusFormatted = Schemas.Term.toName('status', result.status);
            return (
                <React.Fragment>
                    <i className="item-status-indicator-dot mr-07" data-status={result.status}/>
                    <span className="value">{ statusFormatted }</span>
                </React.Fragment>
            );
        }
    },
    'workflow.title' : {
        'title' : "Workflow",
        'render' : function(result, props){
            const { "@id": link } = result;
            if (!result.workflow || !result.workflow.title) return null;
            const { title }  = result.workflow;
            const workflowHref = object.itemUtil.atId(result.workflow);
            let retLink;
            if (workflowHref){
                retLink = <a href={workflowHref || link}>{ title }</a>;
            } else {
                retLink = title;
            }
            return <span className="value">{ retLink }</span>;
        }
    },
    'bam_snapshot': {
        'render' : function(result, props) {
            const { bam_snapshot = null } = result;
            if (bam_snapshot) {
                return (
                    <div className="mx-auto">
                        <a target="__blank" href={bam_snapshot}>
                            View BAM Snapshot
                        </a>
                        <i className="ml-1 icon-sm icon fas icon-external-link-alt"></i>
                    </div>
                );
            }
            return null;
        }
    }
};

