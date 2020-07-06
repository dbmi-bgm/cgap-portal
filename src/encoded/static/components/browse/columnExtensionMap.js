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
                <i className="item-status-indicator-dot ml-07" data-status={status}/>
            </div>
            <h4 className="col-main">
                { main || "-" }
            </h4>
            <div className="col-date" style={{ textAlign: "center", fontSize: "12px" }}>
                <strong>{dateTitle} </strong>
                <LocalizedTime timestamp={date} formatType="date-sm" />
            </div>
        </div>
    );
}


/**
 * @todo
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

/** Used to show "Case.individual" ('Individual' item-type) */
export const DisplayTitleColumnIndividual = React.memo(function DisplayTitleIndividualDefault({ result, link, onClick }) {
    // `href` and `context` reliably refer to search href and context here, i.e. will be passed in from VirtualHrefController.
    const title = itemUtil.getTitleStringFromContext(result); // Gets display_title || title || accession || ...
    const tooltip = (typeof title === "string" && title.length > 20 && title) || null;
    const {
        individual : {
            display_title = null,
            status = null,
            date_created = null
        } = {},
        case_id = null
    } = result;

    return (
        <div key="title-container" className="title-block d-flex flex-column" data-tip={tooltip} data-delay-show={750}>
            { renderAdvancedColumn(display_title, status, case_id, "Accessioned:", date_created) }
        </div>);
});




export const columnExtensionMap = {
    ...basicColumnExtensionMap,
    // 'display_title' : {
    //     'title' : "Title",
    //     'widthMap' : { 'lg' : 280, 'md' : 250, 'sm' : 200 },
    //     'minColumnWidth' : 90,
    //     'order' : -100,
    //     'render' : function renderDisplayTitleColumn(result, parentProps){
    //         const { href, context, rowNumber, detailOpen, toggleDetailOpen } = parentProps;
    //         const { '@type' : itemTypeList = ["Item"] } = result;
    //         let renderElem;
    //         if (itemTypeList[0] === "User") {
    //             renderElem = <DisplayTitleColumnUser {...{ result }}/>;
    //         } else if (itemTypeList[0] === "Individual") {
    //             renderElem = <DisplayTitleColumnIndividual {...{ result }}/>;
    //         } else {
    //             renderElem = <DisplayTitleColumnDefault {...{ result }}/>;
    //         }
    //         return (
    //             <DisplayTitleColumnWrapper {...{ result, href, context, rowNumber, detailOpen, toggleDetailOpen }}>
    //                 { renderElem }
    //             </DisplayTitleColumnWrapper>
    //         );
    //     }
    // },
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
    'accession': {
        'widthMap' : { 'lg' : 280, 'md' : 250, 'sm' : 200 },
        'render' : function renderCaseColumn (result, parentProps) {
            const {
                '@id' : resultHref,
                '@type' : itemTypeList = ["Item"],
                last_modified: { date_modified } = {},
                status = null,
                accession = null,
                aliases: [ firstAlias ] = [],
                display_title
            } = result;

            const link = <a href={resultHref}>{ firstAlias || display_title }</a>;

            if (itemTypeList[0] === "Case") {
                return renderAdvancedColumn(accession, status, link, "Last Modified:", date_modified || null);
            }

            return link;
        }
    },
    'report': {
        'title': "Report",
        'widthMap' : { 'lg' : 280, 'md' : 250, 'sm' : 200 },
        'render': function renderReportColumn(result, parentProps) {
            const {
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
                return "-";
            }

            if (itemTypeList[0] === "Case") {
                return (
                    <a href={result['@id']} style={{ color: "inherit", textDecoration: "inherit" }}>
                        {renderAdvancedColumn(accession, status, display_title, "Last Modified:", date_modified)}
                    </a>);
            }
            return (<a href={result['@id']}> { display_title } </a>);
        }
    },
    'individual': {
        'title': "Individual",
        'widthMap' : { 'lg' : 280, 'md' : 250, 'sm' : 200 },
        'render' : function renderIndividualColumn(result, parentProps){
            const { href, context, rowNumber, detailOpen, toggleDetailOpen } = parentProps;
            const { '@type' : itemTypeList = ["Item"] } = result;

            if (itemTypeList[0] === "Case") {
                return (
                    <DisplayTitleColumnWrapper {...{ result, href, context, rowNumber, detailOpen, toggleDetailOpen }}>
                        <DisplayTitleColumnIndividual {...{ result }}/>
                    </DisplayTitleColumnWrapper>);
            }
            return <DisplayTitleColumnIndividual {...{ result }}/>;
        }
    },
    'sample_processing.completed_processes': {
        'render' : function renderBioinformaticsColumn(result, parentProps){
            const { sample_processing: { completed_processes = [], last_modified = {} } } = result;
            return <a href={result['@id'] + "#case-summary.bioinformatics"} style={{ color: "inherit", textDecoration: "inherit" }}>{renderAdvancedColumn(null, null, completed_processes, "Last Updated:", last_modified.date_modified || null)}</a>;
        }
    },
    'sample_processing.sample': {
        'render' : function renderSequencingColumn(result, parentProps){
            const { individual, sample_processing: { samples = [] } } = result;
            const selectedSample = findSelectedCaseSample(samples, individual);
            if (!selectedSample) return null;
            const { workup_type, specimen_accession_date } = selectedSample;
            return <a href={result['@id'] + "#case-summary.bioinformatics"} style={{ color: "inherit", textDecoration: "inherit" }}>{renderAdvancedColumn(null, null, workup_type, "Accessioned:", specimen_accession_date)}</a>;
        }
    },
    'sample_processing': {
        'title': "This won't work right",
        'render' : function renderSampleColumn(result, parentProps){
            const { individual, sample_processing: { samples = [] } } = result;
            const selectedSample = findSelectedCaseSample(samples, individual);
            if (!selectedSample) return null;
            const { accession, status, specimen_type, specimen_collection_date } = selectedSample;
            return renderAdvancedColumn(accession, status, specimen_type, "Collected:", specimen_collection_date);
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
    }
};

