'use strict';

import React from 'react';
import _ from 'underscore';

import { itemUtil } from '@hms-dbmi-bgm/shared-portal-components/es/components/util/object';
import { capitalizeSentence } from '@hms-dbmi-bgm/shared-portal-components/es/components/util/value-transforms';
import { LocalizedTime, formatPublicationDate } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/LocalizedTime';
import { basicColumnExtensionMap,
    DisplayTitleColumnWrapper,
    DisplayTitleColumnDefault,
    DisplayTitleColumnUser } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/table-commons';
import { Schemas, typedefs } from './../util';

import { variantSampleColumnExtensionMap, structuralVariantSampleColumnExtensionMap, VariantSampleDisplayTitleColumn } from './variantSampleColumnExtensionMap';
import QuickPopover from '../item-pages/components/QuickPopover';
import { generateRelationshipMapping, QCMFlag, sortAndAddRolePropsToQCMs } from '../item-pages/CaseView';
import { CurrentFamilyController, findCanonicalFamilyIndex } from '../item-pages/CaseView/CurrentFamilyController';

// eslint-disable-next-line no-unused-vars
const { Item, ColumnDefinition } = typedefs;

export const DEFAULT_WIDTH_MAP = { 'lg' : 200, 'md' : 180, 'sm' : 120, 'xs' : 120 };



/**
 * Theoretically we could change all these render functions to just be functional React components, maybe a later todo.
 * And move any compute-logic into here for memoization.
 *
 * Colors are bound to 'data-status' attribute values in SCSS to statuses, so we re-use those here rather than
 * creating separate 'color map' for this, and override tooltip with custom value.
 *
 * IMPORTANT:
 * WE MEMOIZE THIS AND RE-RENDER SAME THING EVEN IF PROPS CHANGE FOR PERFORMANCE (2nd arg to React.memo).
 * May need to change in future (e.g. if re-load content without re-instantiating table)
 */
const MultiLevelColumn = React.memo(function MultiLevelColumn(props){
    const {
        topLeft,
        status,
        statusTip = null,
        mainTitle = null,
        dateTitle = "Created:",
        bottom = null,
        showBottomAsDate = true,
        date,
        datePlaceholder = "N/A",
        titleTip = null,
        titleTipDelayShow = null,
        "data-html": tooltipEnableHtml
    } = props;

    let bottomSection = null;

    if (showBottomAsDate) {
        bottomSection = (
            <div className="col-date text-smaller text-secondary">
                { dateTitle && <span className="mr-04">{ dateTitle }</span>}
                { date ? <LocalizedTime timestamp={date} formatType="date-xs" className="text-600"/> : datePlaceholder }
            </div>);
    } else {
        bottomSection = (
            <div className="col-date text-smaller text-secondary">
                { bottom || <br/> }
            </div>);
    }

    return (
        <div className="multi-field-cell">
            <div className="top-row">
                <span className="col-topleft">
                    { topLeft }
                </span>
                <i className="status-indicator-dot ml-07" data-status={status} data-tip={statusTip || Schemas.Term.toName("status", status)} data-html />
            </div>
            <h4 className="col-main" data-tip={titleTip} data-delay-show={titleTipDelayShow} data-html={tooltipEnableHtml}>
                <span>{ mainTitle || "-" }</span>
            </h4>
            { bottomSection }
        </div>
    );
}, function(){ return false; });


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
    const titleTip = (typeof title === "string" && title.length > 20 && title) || null;
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
        <MultiLevelColumn {...{ date, status, statusTip, titleTip }}
            titleTipDelayShow={750}
            dateTitle="Accession Date:" topLeft={<span className="accession text-muted">{ accession }</span>}
            mainTitle={
                <a href={caseHref} className="adv-block-link">
                    { accession && case_title ? case_title : display_title }
                </a>
            }/>
    );
});




export const columnExtensionMap = {
    ...basicColumnExtensionMap,
    ...variantSampleColumnExtensionMap,
    ...structuralVariantSampleColumnExtensionMap,
    'display_title' : { // TODO: Look into a better way to do this
        'title' : "Title",
        'widthMap' : { 'lg' : 280, 'md' : 250, 'sm' : 200 },
        'minColumnWidth' : 90,
        'order' : -100,
        'render' : function renderDisplayTitleColumn(result, parentProps){
            const { href, context, rowNumber, detailOpen, toggleDetailOpen } = parentProps;
            const { '@type': itemTypeList = ["Item"] } = result;
            let renderElem;
            if (itemTypeList[0] === "User") {
                renderElem = <DisplayTitleColumnUser {...{ result }}/>;
            } else if (itemTypeList[0] === "Case") {
                renderElem = <DisplayTitleColumnCase {...{ result }}/>;
            } else if (itemTypeList[0] === "VariantSample") {
                renderElem = <VariantSampleDisplayTitleColumn {...{ result }} />;
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
    'report': {
        'title': "Report",
        'render': function renderReportColumn(result, parentProps) {
            const {
                '@id' : resultHref,
                report = null
            } = result;
            const {
                display_title: reportTitle = null,
                accession = null,
                last_modified: {
                    date_modified = null
                } = {},
            } = report || {};

            if (!report || !report.accession) {
                return null;
            }

            const showAccessionSeparately = accession !== reportTitle;
            return (
                <MultiLevelColumn status="not implemented" statusTip="Not Implemented" dateTitle="Last Modified:"
                    date={date_modified}
                    topLeft={showAccessionSeparately ? <span className="accession text-muted">{ accession }</span> : null}
                    mainTitle={<a href={resultHref} className="adv-block-link">{ reportTitle }</a>}/>
            );
        }
    },
    'family': {
        'render' : function renderFamilyColumn(result, parentProps) {
            const { family } = result;
            if (!family) return null;
            const {
                '@id' : atId = null,
                accession = null,
                last_modified: {
                    date_modified: date = null
                } = {},
                family_id = null,
                uuid = null
            } = family;

            let status = null;
            let statusTip = null;
            if (uuid && family_id) {
                status = "complete";
                statusTip = "Family is created with required fields.";
            } else {
                status = "incomplete";
                statusTip = "Family exists, but some field is missing: uuid or family_id.";
            }

            return (
                <MultiLevelColumn {...{ date, status, statusTip }} dateTitle="Last Modified:"
                    topLeft={<span className="accession text-muted">{ accession }</span>}
                    mainTitle={<a href={atId} className="adv-block-link">{ family_id }</a>} />
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

            const individualTitle = individual_id ? individual_id : display_title;

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
                <MultiLevelColumn {...{ date, status, statusTip }} dateTitle="Accession Date:"
                    topLeft={<span className="accession text-muted">{ accession }</span>}
                    mainTitle={<a href={atId} className="adv-block-link">{ individualTitle }</a>}/>
            );
        }
    },
    /** "Sequencing" column title */
    'sample': {
        'render' : function renderSequencingColumn(result, parentProps){
            const { '@id' : resultHrefPath, sample = null } = result;
            if (!sample) return null; // Unsure if possible, but fallback to null / '-' in case so (not showing datetitle etc)
            const {
                workup_type = null,
                sequencing_date: date = null,
                files = []
            } = sample || {};

            let status = null;
            let statusTip = null;

            let fastqPresent = false;
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const { uuid = null, '@type': [type], status: fileStatus = null } = file || {};
                if (type === "FileFastq" &&
                    (uuid && fileStatus && fileStatus !== "uploading" && fileStatus !== "upload_failed")
                ) {
                    fastqPresent = true;
                    break;
                }
            }

            if (fastqPresent) {
                statusTip = "Fastq file(s) uploaded";
                status = "complete";
            } else {
                statusTip = "No fastq files";
                status = "incomplete";
            }

            return (
                <MultiLevelColumn {...{ date, status, statusTip }} dateTitle="Sequence Date:"
                    mainTitle={<a href={resultHrefPath + "#case-info.bioinformatics"} className="adv-block-link">{ workup_type }</a>}/>
            );
        }
    },
    /** "Bioinformatics" column title */
    'sample_processing.analysis_type': {
        'render' : function renderBioinformaticsColumn(result, parentProps){
            const { sample_processing = null } = result;
            if (!sample_processing) return null; // Fallback to null / '-' in case so (not showing datetitle etc)

            // TODO: Make & use more easily-memoizable per-column components like `BioinformaticsMultiLevelColumn`
            return <BioinformaticsMultiLevelColumn result={result} />;
        }
    },
    /** "Sample" column title */
    'sample.specimen_type': {
        'render' : function renderSampleColumn(result, parentProps){
            const { sample = null } = result;
            const { uuid = null, bam_sample_id = null, '@id': sampleId, accession, specimen_type = null, specimen_collection_date: date } = sample || {};
            if (!sample || !specimen_type) return null;

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
                <MultiLevelColumn {...{ date, status, statusTip }} dateTitle="Collection Date:"
                    topLeft={<span className="accession text-muted">{ accession }</span>}
                    mainTitle={<a href={sampleId} className="adv-block-link">{ capitalizeSentence(specimen_type) }</a>} />
            );
        }
    },
    /** "QC" column title */
    'quality_control_flags.flag' : {
        'render': function(result, props) {
            return <QCMultilevelColumn {...{ result }} />;
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
                <span className="value">
                    <i className="status-indicator-dot mr-07" data-status={result.status} />
                    { statusFormatted }
                </span>
            );
        }
    },
    'workflow.title' : {
        'title' : "Workflow",
        'render' : function(result, props){
            const { "@id": link } = result;
            if (!result.workflow || !result.workflow.title) return null;
            const { title }  = result.workflow;
            const workflowHref = itemUtil.atId(result.workflow);
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


const BioinformaticsMultiLevelColumn = React.memo(function BioinformaticsMultiLevelColumn({ result }){
    const { sample, sample_processing, vcf_file, '@id': resultHrefPath } = result;
    const {
        analysis_type = null,
        analysis_version = null,
        last_modified: { date_modified: date = null } = {}
    } = sample_processing;
    const {
        files = [],
        /* processed_files = [] */
    } = sample || {};

    const filesLen = files.length;
    const mainTitle = analysis_type + (analysis_version ? " (" + analysis_version + ")" : "");

    let status = null;
    let statusTip = null;

    // Ensure fastQs exist
    if (filesLen > 0) {
        statusTip = "Fastq file(s) uploaded";
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const { uuid = null, status: fileStatus = null } = file;
            if (!uuid || fileStatus === "uploading" || fileStatus === "upload_failed" || !fileStatus) {
                statusTip = "No fastq files";
                status = "not started";
                break;
            }
        }
    }

    // If fastQs are present... check if ingested
    if (filesLen > 0 && status === null) {
        status = "running";
        const { file_ingestion_status: ingestionStatus = null } = vcf_file || {};
        if (ingestionStatus === "Ingested") {
            statusTip = "Variants are ingested";
            status = "complete";
        }
    }

    // Check if overall QCs passed (not yet implemented) -- to add later

    // Unlikely to show in non-Case item results, so didn't add Case filter
    return (
        <MultiLevelColumn {...{ date, status, statusTip }} dateTitle="Last Modified:"
            mainTitle={
                <a href={resultHrefPath + "#case-info.bioinformatics"} className="adv-block-link">
                    { analysis_type }
                </a>
            }/>
    );
});


const QCMultilevelColumn = React.memo(function QCMultilevelColumn({ result }) {
    const {
        family: canonicalFamilyPartialEmbed = {},
        sample_processing = {},
        quality_control_flags = {},
        '@id': resultHrefPath
    } = result;
    const {
        last_modified: { date_modified: date = null } = {},
        quality_control_metrics: qualityControlMetrics = [],
        families: spFamilies = []
    } = sample_processing;

    // Find full canonical family for this case
    const familiesWithViewPermission = CurrentFamilyController.filterFamiliesWithViewPermission(spFamilies);
    const canonicalFamilyIdx = findCanonicalFamilyIndex(familiesWithViewPermission, canonicalFamilyPartialEmbed);

    const {
        relationships = []
    } = spFamilies[canonicalFamilyIdx] || {};

    // Create a mapping of individuals to relationship and sex
    const relationshipMapping = generateRelationshipMapping(relationships);

    const { completed_qcs = [], warn = 0, fail = 0 } = quality_control_flags;

    // title = null, children = [], className, popID, tooltip, placement, htmlContent

    let qcFlags = <a href={resultHrefPath + "#case-info.bioinformatics"} className="adv-block-link">No Flags</a>;
    if (warn !== 0 || fail !== 0) {
        qcFlags = (
            <div>
                <a href={resultHrefPath + "#case-info.bioinformatics"} className="adv-block-link">
                    <span className="mr-05">{fail} <i className={`icon icon-flag fas text-danger ml-05`} /></span>
                    <span className="ml-05">{warn} <i className={`icon icon-flag fas text-warning ml-05`} /></span>
                </a>
                <QuickPopover className="ml-05 mb-03 p-0" tooltip="Click for QC Summary">
                    <QCPopover {...{ qualityControlMetrics, relationshipMapping }} />
                </QuickPopover>
            </div>
        );
    }

    const bottom = completed_qcs.length !== 0 ?
        <div><span className="text-600">{completed_qcs.join(", ")}</span> QC(s) Completed</div>:
        <div>QCs Incomplete</div>;

    return (
        <MultiLevelColumn {...{ bottom }} showBottomAsDate={false} mainTitle={qcFlags}/>
    );
});


const QCPopover = React.memo(function QCPopover({ qualityControlMetrics, relationshipMapping }) {

    if (qualityControlMetrics.length === 0) { return "No Quality Control Metrics Available"; }

    const sortedQCMS = sortAndAddRolePropsToQCMs(qualityControlMetrics, relationshipMapping);
    const flagClasses = "mb-02 d-flex align-items-center justify-content-between";

    return (
        <div className="p-2">
            <table className="table table-sm table-borderless">
                <tbody>
                    { sortedQCMS.map((qcm, i) => {
                        const { atID, role, sequencing_type, bam_sample_id, warn = [], fail = [] } = qcm;

                        const warnFlags = warn.map((flag) => <QCMFlag key={flag} cls={flagClasses} type="warn" title={flag} />);
                        const failFlags = fail.map((flag) => <QCMFlag key={flag} cls={flagClasses} type="fail" title={flag} />);

                        return (
                            <tr key={atID + bam_sample_id } className={`${ i !== sortedQCMS.length - 1 && "border-bottom"}`}>
                                <td className="text-left text-600 text-capitalize text-larger pl-03 align-top align-left p-2">
                                    {role}:
                                </td>
                                <td className="text-left align-top text-larger align-left p-2">{sequencing_type}</td>
                                <td className="p-2">{ warnFlags } { failFlags } { warnFlags.length == 0 && failFlags.length == 0 && "No Flags"}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
});
