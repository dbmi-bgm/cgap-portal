'use strict';

import React from 'react';
import _ from 'underscore';

import { object } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
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
 * Not sure if this memoization is fully worthwhile as is often comparing strings (== arrays of characters), tho
 * it'd probably do that in react virtual dom diff otherwise later anyway... need to check.
 *
 * Another thought - it's unlikely that the props passed to this component will _ever_ change, I think.
 * Maybe we could have something like 'shouldComponentUpdate(){ return false; }` to prevent it from ever even
 * attempting to compare props for performance gain (since many table cells).
 *
 * Colors are bound to 'data-status' attribute values in SCSS to statuses, so we re-use those here rather than 
 * creating separate 'color map' for this, and override tooltip with custom value.
 */
const MultiLevelColumn = React.memo(function MultiLevelColumn(props){
    const {
        topLeft,
        status,
        statusTip = null,
        mainTitle = null,
        dateTitle = "Created:",
        date
    } = props;
    return (
        <div className="multi-field-cell">
            <div className="top-row">
                <span className="col-topleft">
                    { topLeft }
                </span>
                <i className="status-indicator-dot ml-07" data-status={status} data-tip={statusTip || Schemas.Term.toName("status", status)} data-html />
            </div>
            <h4 className="col-main">
                { mainTitle || "-" }
            </h4>
            <div className="col-date text-center text-smaller">
                <span className="text-600">{ dateTitle } </span>
                { date ? <LocalizedTime timestamp={date} formatType="date-sm"/> : "N/A" }
            </div>
        </div>
    );
});


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
        date_created: date = null,
        case_title = null,
        individual = null,
        family = null,
        sample_processing = null
    } = result;

    const mainTitle = accession && case_title ? case_title : display_title;

    const { uuid: indvID = null } = individual || {};
    const { uuid: familyID = null } = family || {};
    const { uuid: spID = null } = sample_processing || {};

    let status = null;
    let statusTip = null;
    if (indvID && familyID && spID) {
        status = "complete";
        statusTip = "Case, Individual, Family and Sample Processing are created with required fields.";
    } else {
        status = "incomplete";
        statusTip = "Case exists, but some linked item is missing: Family, Individual, or Sample Processing.";
    }

    return (
        <a href={caseHref} className="adv-block-link w-100 title-block d-flex flex-column" data-tip={tooltip} data-delay-show={750}>
            <MultiLevelColumn {...{ mainTitle, date, status, statusTip }} dateTitle="Accessioned:" topLeft={<span className="accession">{ accession }</span>} />
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
                display_title: mainTitle = null,
                accession = null,
                last_modified : { date_modified: date = null } = {}
            } = report || {};

            if (!report || !report.accession) {
                return null;
            }

            const showAccessionSeparately = accession !== mainTitle;
            return (
                <a href={resultHref} className="adv-block-link">
                    <MultiLevelColumn {...{ mainTitle, date, status: "not implemented", statusTip: "Not Implemented" }} dateTitle="Last Modified:" topLeft={showAccessionSeparately ? <span className="accession">{ accession }</span> : null} />
                </a>
            );
        }
    },
    'family': {
        'render' : function renderFamilyColumn(result, parentProps) {
            const { '@type' : itemTypeList = ["Item"], family } = result;
            if (!family) return null;
            const {
                '@id' : atId = null,
                accession = null,
                date_created: date = null,
                family_id: mainTitle = null,
                uuid = null
            } = family;

            let status = null;
            let statusTip = null;
            if (uuid && mainTitle) {
                status = "complete";
                statusTip = "Family is created with required fields.";
            } else {
                status = "incomplete";
                statusTip = "Family exists, but some field is missing: uuid or family_id.";
            }

            return (
                <a href={atId} className="adv-block-link">
                    <MultiLevelColumn {...{ mainTitle, date, status, statusTip }} dateTitle="Last Modified:" topLeft={<span className="accession">{ accession }</span>} />
                </a>
            );
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
                date_created: date = null,
                individual_id = null,
                uuid = null
            } = individual;

            const mainTitle = individual_id ? individual_id : display_title;

            let status = null;
            let statusTip = null;
            if (uuid && individual_id) {
                status = "complete";
                statusTip = "Individual is created with required fields.";
            } else {
                status = "incomplete";
                statusTip = "Individual exists, but some field is missing: uuid or individual_id.";
            }

            return (
                <a href={atId} className="adv-block-link">
                    <MultiLevelColumn {...{ mainTitle, date, status, statusTip }} dateTitle="Accessioned:" topLeft={<span className="accession">{ accession }</span>} />
                </a>
            );
        }
    },
    /** "Sequencing" column title */
    'sample': {
        'render' : function renderSequencingColumn(result, parentProps){
            const { '@id' : resultHrefPath, sample = null } = result;
            if (!sample) return null; // Unsure if possible, but fallback to null / '-' in case so (not showing datetitle etc)
            const {
                workup_type: mainTitle = null,
                sequencing_date: date = null,
                files = []
            } = sample || {};

            let status = null;
            let statusTip = null;

            let fastqPresent = false;
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const { '@type': [type] } = file || {};
                if (type === "FileFastq") {
                    fastqPresent = true;
                    break;
                }
            }

            if (fastqPresent) {
                statusTip = "Fastq file(s) uploaded";
                status = "complete";
            } else {
                statusTip = "No fastq files";
                stauts = "incomplete";
            }

            /** @DEPRECATED as of 9/16/20 -- keeping here until confirmation new tips will stay.
            let status, statusTip;
            if (complProcLen > 0){
                status = "released";
                if (complProcLen === 1) {
                    statusTip = `Process <span class="text-600">${completed_processes[0]}</span> has completed`;
                } else {
                    statusTip = `This sample/case has <strong>${complProcLen}</strong> completed processes`;
                }
            } else {
                status = "uploading";
                statusTip = "This sample/case has no completed processes yet";
            }
            */

            return (
                <a href={resultHrefPath + "#case-info.bioinformatics"} className="adv-block-link">
                    <MultiLevelColumn {...{ mainTitle, date, status, statusTip }} dateTitle="Sequenced:" />
                </a>
            );
        }
    },
    /** "Bioinformatics" column title */
    'sample_processing.analysis_type': {
        'render' : function renderBioinformaticsColumn(result, parentProps){
            const { '@id' : resultHrefPath, sample = null, sample_processing = null } = result;
            if (!sample_processing) return null; // Unsure if possible, but fallback to null / '-' in case so (not showing datetitle etc)
            const {
                analysis_type: mainTitle = null,
                last_modified: { date_modified: date = null } = {}
            } = sample_processing;
            const {
                files = [],
                processed_files = []
            } = sample || {};

            let status = null;
            let statusTip = null;

            // Ensure fastQs exist
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const { uuid = null, status: fileStatus = null } = file;
                if (!uuid || fileStatus === "uploading" || fileStatus === "upload_failed" || !fileStatus) {
                    statusTip = "No fastq files";
                    status = "not started";
                    break;
                } else {
                    statusTip = "Fastq file(s) uploaded";
                    status = "in progress";
                }
            }

            // If fastQs are present...
            if (status === "in progress") {
                // Check if VCFs have been ingested & if QCs passed
                for (let j = 0; j < processed_files.length; j++) {
                    const procFile = processed_files[j];
                    const { file_ingestion_status: ingestionStatus = null, file_format = null } = procFile || {};
                    const { file_format: fileType } = file_format || {};
                    if ((fileType === "vcf_gz" || fileType === "gvcf_gz")
                        && ingestionStatus === "Ingested") {
                        statusTip = "Variants are ingested";
                        status = "complete";

                        // TODO: Add QC status from overall QC status once implemented
                    } // Else, not VCF or not yet ingested, ignore
                }
            }

            // Unlikely to show in non-Case item results, so didn't add Case filter
            return (
                <a href={resultHrefPath + "#case-info.bioinformatics"} className="adv-block-link">
                    <MultiLevelColumn {...{ mainTitle, date, status, statusTip }} dateTitle="Last Update:" />
                </a>
            );
        }
    },
    /** "Sample" column title */
    'sample.specimen_type': {
        'render' : function renderSampleColumn(result, parentProps){
            const { sample = null } = result;
            const { uuid = null, bam_sample_id = null, '@id': sampleId, accession, specimen_type: mainTitle, specimen_collection_date: date } = sample || {};
            // Unlikely to show in non-Case item results, so didn't add Case filter

            let status = null;
            let statusTip = null;
            if (uuid && bam_sample_id) {
                status = "complete";
                statusTip = "Sample is created with required fields.";
            } else {
                status = "incomplete";
                statusTip = "Sample exists, but some field is missing: uuid or bam_sample_id.";
            }
            return (
                <a href={sampleId} className="adv-block-link">
                    <MultiLevelColumn {...{ mainTitle, date, status, statusTip }} dateTitle="Collected:" topLeft={<span className="accession">{ accession }</span>} />
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
            const { bam_snapshot = null, uuid = null } = result;
            if (bam_snapshot) {
                return (
                    <div className="mx-auto">
                        <a target="_blank" rel="noreferrer" href={`/${uuid}/@@download`}>
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

