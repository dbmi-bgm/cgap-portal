'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';

import { object, layout } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { StackedBlockTable, StackedBlock, StackedBlockList, StackedBlockName, StackedBlockNameLabel } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/StackedBlockTable';
import { responsiveGridState } from './../util/layout';


export const CaseDetailPane = React.memo(function CaseDetailPane (props) {
    const { paddingWidthMap, paddingWidth, containerWidth, windowWidth, result, minimumWidth } = props;
    const { family = null, secondary_families = null } = result;

    let usePadWidth = paddingWidth || 0;
    if (paddingWidthMap){
        usePadWidth = paddingWidthMap[responsiveGridState(windowWidth)] || paddingWidth;
    }
    const commonFamilySectionProps = {
        containerWidth, result, minimumWidth, paddingWidth: usePadWidth
    };

    let families = [];
    if (family !== null) {
        families.push(family);
        if (secondary_families !== null && secondary_families.length > 0) {
            families = families.concat(secondary_families);
        }
    }

    // Once primary/other family objects added to Case schema, update to use those instead
    const familySections = families.map(function(family){
        return <FamilySection {...commonFamilySectionProps} key={family['@id']} {...{ result, family }} />;
    });

    return (
        <div className="family-info-wrapper">
            <div className="family-addinfo">
                <div className="row">
                    <div className="col-md-6 addinfo-properties-section">
                        <div className="row mb-05 clearfix">
                            <div className="col-4 col-sm-3 text-500">
                                Cohort:
                            </div>
                            <div className="col-8 col-sm-9 family-addinfo-val">
                                { object.itemUtil.generateLink(result.cohort) || <small><em>None</em></small> }
                            </div>
                        </div>
                        <div className="row mb-05 clearfix">
                            <div className="col-4 col-sm-3 text-500">
                                Project:
                            </div>
                            <div className="col-8 col-sm-9 family-addinfo-val">
                                { object.itemUtil.generateLink(result.project) || <small><em>None</em></small> }
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div style={{ width: containerWidth ? (containerWidth - usePadWidth) : null }} className="family-tables-container overflow-auto"> {/*formerly files-tables-container */}
                { familySections }
            </div>
        </div>
    );
});
CaseDetailPane.propTypes = {
    'result' : PropTypes.object.isRequired,
    'containerWidth' : PropTypes.number,
    'paddingWidth' : PropTypes.number,
    'windowWidth' : PropTypes.number,
    'href' : PropTypes.string,
    'minimumWidth' : PropTypes.number
};
CaseDetailPane.defaultProps = {
    'paddingWidth' : 0,
    'minimumWidth' : 725,
};

/**
 * Renders a collapsible button that opens to reveal a FamilyReportStackedTable containing information
 * about each individual/sample/case in the current family.
 */
class FamilySection extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            open: false,
        };
        this.onToggle = _.throttle(this.onToggle.bind(this), 750, { 'trailing' : false });
    }

    onToggle() {
        const { open } = this.state;
        this.setState({ open: !open });
    }

    render() {
        const { open } = this.state;
        const { family, result, containerWidth, minimumWidth, paddingWidth } = this.props;
        return (
            <div className="family-table-section">
                <h4 className="pane-section-title" onClick={this.onToggle}>
                    <div className="col-auto pr-0">
                        <i className={"toggle-open-icon icon icon-fw fas icon-" + (open ? 'minus' : 'plus')} />
                    </div>
                    <div className="col">
                        { family.display_title }: <span className="text-200 font-italic">Family &amp; Report History</span>
                    </div>
                </h4>
                { open ? (
                    <FamilyReportStackedTable
                        {...{ result, family }} preventExpand={false}
                        width={containerWidth ? (Math.max(containerWidth - paddingWidth, minimumWidth) /* account for padding of pane */) : null}
                        fadeIn={false} collapseLongLists
                    />
                ) : null }
            </div>
        );
    }
}

/**
 * Used within Case Search
 *
 * Shows individuals within a passed-in family, as well as any sample analyses objects related to that Case.
 * Takes in the current case item ('result' prop) and a single family associated with said case
 * and renders a table containing all of the accessions/various IDs for each individual, sample,
 * and report/case in that family. Result rows are sorted by individual (first proband, then individuals
 * with samples, then the rest).
 *
 * TODO: highlight current case throughout the table using 'result' prop.
 */
export class FamilyReportStackedTable extends React.PureComponent {

    static StackedBlock = StackedBlock

    static builtInHeaders(){
        // Keeping these builtInHeader methods separate in case we want to build in custom columns later
        return [
            { columnClass: 'individual',    className: 'text-left',         title: 'Individual',    initialWidth: 220   },
            { columnClass: 'libraries',     className: 'text-left',         title: 'Libraries',     initialWidth: 220   },
            { columnClass: 'analysis',                                      title: 'Analysis',      initialWidth: 200   },
            /* report column has no label, but has left alignment, so we add 12px padding left to visually align header to it better */
            { columnClass: 'report',        className: 'text-left pl-12',   title: 'Report',        initialWidth: 200   }
        ];
    }

    /* Built-in headers */
    static staticColumnHeaders(columnHeaders){
        return _.map(FamilyReportStackedTable.builtInHeaders(), function(staticCol){
            return _.extend(
                _.clone(staticCol),
                _.findWhere(columnHeaders, { 'title' : staticCol.title }) || {}
            );
        }) || [];
    }

    static propTypes = {
        // 'columnHeaders'             : PropTypes.array,
        'result'                    : PropTypes.object,
        'family'                    : PropTypes.object,
        'collapseLongLists'         : PropTypes.bool,
        'preventExpand'             : PropTypes.bool,
    };

    static defaultProps = {
        'fadeIn'        : true,
        'width'          : "100%",
        'collapseLongLists' : true,
        'showMetricColumns' : null,
        'preventExpand'     : false
    };

    static renderEmptyBlock(columnClass) {
        return (
            <StackedBlock {...{ columnClass }} subtitleVisible={false}
                label={<StackedBlockNameLabel title={null} accession={null} subtitle={null} subtitleVisible={false}/>}>
                <StackedBlockName>
                    <span className="name-title"></span>
                </StackedBlockName>
            </StackedBlock>
        );
    }

    constructor(props){
        super(props);
        this.renderSampleBlock = this.renderSampleBlock.bind(this);
        this.renderIndividualBlock = this.renderIndividualBlock.bind(this);
        this.renderIndividualBlockList = this.renderIndividualBlockList.bind(this);
    }

    /**
     * Renders an sample analysis block, and nested blocks for the reports and cases that use the current sample
     * @param {object} sample               A single sample item/object
     * @param {object} reportBlockMapping   Mapping of report atIDs to a JSX element representing a report block
     * @param {object} caseToReportMap      Mapping of case atIDs to a report atID
     *
     * Mappings are created and passed in from this.renderIndividualBlock because of difficulty mapping
     * samples to specific cases. Each case in Family.analysis_groups[i] is checked for the current sample.
     * Once a case using this sample is found, caseToReportMap and reportBlockMapping are used to render a
     * report block containing case AND report information.
     */
    renderSampleBlock(sample, reportBlockMapping = null, caseToReportMap = null){
        const { family = null } = this.props;
        const { analysis_groups: analysisGroups = [] } = family || {};
        const { '@id': atId = null, workup_type = null, accession = null } = sample || {};

        return (
            <StackedBlock columnClass="libraries" hideNameOnHover={false} key={atId} id={atId}
                label={<StackedBlockNameLabel title="Sample" subtitle="Library" accession={accession} subtitleVisible/>}>
                <StackedBlockName>
                    <span className="name-title">
                        { atId ? <a href={atId} className="name-title">{ workup_type }</a> : <span className="name-title">{ workup_type }</span>}
                    </span>
                </StackedBlockName>
                <StackedBlockList className="analysis" title="Analysis">
                    {analysisGroups.filter(function(group){
                        const { samples = [] } = group || {};
                        if (samples.length > 0) {
                            if (_.any(samples, function({ "@id": agSampleID }){
                                return agSampleID === atId;
                            })) {
                                return true;
                            } else {
                                return false;
                            }
                        }
                        return true;
                    }).map((group) => {
                        const { analysis_type = null, cases = [] } = group || {};
                        let reportBlock = null;

                        // Figure out which report is associated with the current analysis group & sample
                        cases.forEach((groupCase) => {
                            const { '@id': thisCaseAtId = null, sample: caseSample = null } = groupCase || {};
                            const { '@id': sampleAtId = null } = caseSample || {};
                            if (sampleAtId === atId) {

                                const reportBlockId = caseToReportMap[thisCaseAtId];
                                const fallbackKey = 'case-' + thisCaseAtId;

                                if (reportBlockId) {
                                    reportBlock = reportBlockMapping[reportBlockId];
                                // TODO: Rework this entire method of passing case through; didn't realize case was necessary early on and needed this
                                } else if (
                                    reportBlockMapping[fallbackKey]
                                ) {
                                    reportBlock = reportBlockMapping[fallbackKey] || null;
                                }
                            }
                        });

                        return (
                            <StackedBlock key={analysis_type} columnClass="analysis" hideNameOnHover={false}
                                label={<StackedBlockNameLabel title={null} subtitle={null} accession={null} subtitleVisible/>}>
                                <StackedBlockName>
                                    <span className="name-title">{ analysis_type }</span>
                                </StackedBlockName>
                                <StackedBlockList className="report" title="Report">
                                    { reportBlock ? <StackedBlockList className="report" title="Report">{reportBlock}</StackedBlockList> : FamilyReportStackedTable.renderEmptyBlock("report") }
                                </StackedBlockList>
                            </StackedBlock>);
                    }
                    )}
                </StackedBlockList>
            </StackedBlock>
        );
    }

    renderIndividualBlock(individual, role) {
        const { "@id": atId = null, individual_id = null, display_title = null, case: cases = [], accession = null, samples: indvSamples = [] } = individual || {};

        // reportToReportBlockMap maps report atIds to JSX elements rendering a report block containing case & report info.
        // Note: in cases where there is a case but no report, a key with `case-{caseReportID}` is entered here, mapping to a report-less case block
        const reportToReportBlockMap = {};
        const caseToReportMap = {}; // maps case atIds to report atIds

        // Populate mappings with case and report info for rendering alongside appropriate samples in renderSampleBlock
        cases.forEach((currCase) => {
            const { '@id': caseAtId = null, case_title = null, sample = null, report = null } = currCase || {};
            const { '@id': sampleAtId = null } = sample || {};
            const { '@id' : reportAtId = null, display_title : reportTitle = null } = report || {};

            if (sampleAtId && reportAtId) {
                reportToReportBlockMap[reportAtId] = (
                    <StackedBlock columnClass="report" hideNameOnHover={false} key={reportAtId} id={reportAtId}
                        label={<StackedBlockNameLabel title={null} accession={null} subtitleVisible/>}>
                        <StackedBlockName>
                            <div className="d-flex text-left">
                                <span className="mr-07 text-nowrap">Case ID:</span>
                                { caseAtId ? <a href={caseAtId} className="name-title text-capitalize">{ case_title }</a> : <span className="name-title text-capitalize">{ case_title }</span>}
                            </div>
                            <div className="d-flex text-left">
                                <span className="mr-07 text-nowrap">Report:</span>
                                { reportAtId ? <a href={reportAtId} className="name-title text-capitalize">{ reportTitle }</a> : <span className="name-title text-capitalize">{ reportTitle }</span>}
                            </div>
                        </StackedBlockName>
                    </StackedBlock>);
                caseToReportMap[caseAtId] = reportAtId;
            } else { // render an appropriate block when there is a case but no report by mapping case+[caseAtID] : JSX block
                reportToReportBlockMap['case-' + caseAtId] = (
                    <StackedBlock columnClass="report" hideNameOnHover={false} key={reportAtId} id={reportAtId}
                        label={<StackedBlockNameLabel title={null} accession={null} subtitleVisible/>}
                    >
                        <StackedBlockName>
                            <div className="d-flex text-left">
                                <span className="mr-07 text-nowrap">Case ID:</span>
                                { caseAtId ?
                                    <a href={caseAtId} className="name-title text-capitalize">{ case_title }</a>
                                    : <span className="name-title text-capitalize">{ case_title }</span>
                                }
                            </div>
                        </StackedBlockName>
                    </StackedBlock>);
                caseToReportMap[caseAtId] = reportAtId;
            }
        });

        return (
            <StackedBlock hideNameOnHover={false} columnClass="individual"
                key={atId} id={atId}
                label={
                    <StackedBlockNameLabel title="CGAP ID" accession={accession} subtitleVisible/>}
            >
                <StackedBlockName>
                    { atId ? <a href={atId} className="name-title text-capitalize">{ role || display_title }</a> : <span className="name-title text-capitalize">{ role || display_title }</span>}
                    { individual_id ? `(${individual_id})`: null }
                </StackedBlockName>
                <StackedBlockList className="libraries" title="Libraries">
                    { indvSamples.map((thisSample) => this.renderSampleBlock(thisSample, reportToReportBlockMap, caseToReportMap))}
                </StackedBlockList>
            </StackedBlock>
        );
    }

    renderIndividualBlockList() {
        const { family = null, preventExpand } = this.props;
        const { members = [], proband = null, relationships = [] } = family || {};

        const showMoreExtTitle = (
            <React.Fragment>
                { preventExpand ? <a href={object.itemUtil.atId(family)}>(view Family)</a> : null }
            </React.Fragment>
        );

        // Create a mapping of individual accessions to relationships/sex
        const relationshipMapping = {};
        relationships.forEach((item) => {
            const { relationship = null, sex = null, individual = null } = item;
            relationshipMapping[individual] = { sex, relationship };
        });

        // Sort individuals (proband first, then individuals with samples, then all others)
        const sortedMembers = _(members).chain().sortBy(function(member) {
            const { accession = null } = member;
            const { accession: pAccession = null } = proband;
            return accession === pAccession;
        }).sortBy(function(member) {
            const { samples = [] } = member;
            return samples.length > 0;
        }).value().reverse();

        // Render each individual's block in according to relationship
        const indvBlocks = sortedMembers.map((familyMember) => {
            const { accession: currId = null, display_title = null } = familyMember;
            const { relationship: currRelationship = null } = relationshipMapping[currId] || {};
            return this.renderIndividualBlock(familyMember, currRelationship || display_title );
        });

        return (
            <StackedBlockList className="individuals" title="Individuals" showMoreExtTitle={showMoreExtTitle}>
                { indvBlocks }
            </StackedBlockList>
        );
    }

    /**
     * Here we render nested divs for a 'table' of experiments with shared elements spanning multiple rows,
     * e.g. Individual's height is the combined height of its containing sample rows.
     *  _______________________________________________________
     * |                                                       |
     * |             Sample Library       Analysis & Report    |
     * |                                                       |
     * | Individual  __________________________________________|
     * |                                                       |
     * |             Sample Library       Analysis & Report    |
     * |                                                       |
     * |_______________________________________________________|
     *
     * Much of styling/layouting is defined in CSS.
     */
    render(){
        const { columnHeaders: propColHeaders, showMetricsColumns, width, preventExpand = false } = this.props;
        const columnHeaders = FamilyReportStackedTable.staticColumnHeaders(propColHeaders, showMetricsColumns);
        return (
            <div className="stacked-block-table-outer-container overflow-auto">
                <StackedBlockTable {...{ preventExpand, columnHeaders, width }} stackDepth="0" collapseShow="3"
                    fadeIn allFiles={[]} collapseLongLists={true} defaultCollapsed={true}
                    handleFileCheckboxChange={this.handleFileCheckboxChange}>
                    { this.renderIndividualBlockList()}
                </StackedBlockTable>
            </div>
        );
    }
}

/**
 * Used within Accessioning tab on Case View
 *
 * Takes in the current case item ('result' prop) and a single family associated with said case
 * and renders a table containing all of the accessions/various IDs for each individual, sample,
 * and report/case in that family. Current case is highlighted throughout the table, and results
 * are sorted by individual (first proband, then individuals with samples, then the rest).
 */
export class FamilyAccessionStackedTable extends React.PureComponent {

    static StackedBlock = StackedBlock

    static builtInHeaders(){
        // Keeping these builtInHeader methods separate in case we want to build in custom columns later
        return [
            { columnClass: 'individual',    title: 'Individual',     initialWidth: 220   },
            { columnClass: 'libraries',     title: 'Sequencing Libraries',    initialWidth: 220   },
            { columnClass: 'report',    title: 'Report',          initialWidth: 200  }
        ];
    }

    /* Built-in headers */
    static staticColumnHeaders(columnHeaders){
        return _.map(FamilyAccessionStackedTable.builtInHeaders(), function(staticCol){
            return _.extend(
                _.clone(staticCol),
                _.findWhere(columnHeaders, { 'title' : staticCol.title }) || {}
            );
        }) || [];
    }

    static propTypes = {
        'columnHeaders'             : PropTypes.array,
        'result'                    : PropTypes.object,
        'family'                    : PropTypes.object,
        'collapseLongLists'         : PropTypes.bool,
        'preventExpand'             : PropTypes.bool,
    };

    static defaultProps = {
        'fadeIn'        : true,
        'width'         : "100%", // TODO: Fix, seems to fail prop validation
        'collapseLongLists' : true,
        'showMetricColumns' : null,
        'preventExpand'     : false
    };

    static renderEmptyBlock(columnClass) {
        return (
            <StackedBlock {...{ columnClass }} subtitleVisible={false}
                label={<StackedBlockNameLabel title={null} accession={null} subtitle={null} subtitleVisible={false}/>}>
                <StackedBlockName>
                    <span className="name-title">-</span>
                </StackedBlockName>
            </StackedBlock>
        );
    }

    constructor(props){
        super(props);
        this.renderSampleBlock = this.renderSampleBlock.bind(this);
        this.renderIndividualBlock = this.renderIndividualBlock.bind(this);
        this.renderIndividualBlockList = this.renderIndividualBlockList.bind(this);
    }

    /**
     * Renders a sample block, and nested blocks for the reports/cases that use the current sample
     * @param {object} sample       A single sample item/object
     * @param {array} reportBlocks  An array of pre-defined JSX elements containing markup
     *                              for report/case blocks that use the current sample
     *                              (logic for determining what blocks to map to what samples
     *                              is located in this.renderIndividualBlock)
     */
    renderSampleBlock(sample, reportBlocks = null){
        const { result } = this.props;
        const { sample: resultSample = null } = result;
        const { '@id': resultSampleAtId = null } = resultSample;


        const { '@id': atId = null, specimen_collection_date = null, specimen_type = null,
            workup_type = null, accession = null, sequence_id = null,
            bam_sample_id = null, other_specimen_ids, specimen_accession = null } = sample;

        // Check if this is the current case
        const isSampleForResult = resultSampleAtId === atId;

        const sampleAccessionTable = (
            <div className="w-100" style={{ maxWidth: "70%" }}>
                <table className="accession-table w-100">
                    <tbody>
                        { bam_sample_id ?
                            <tr>
                                <td className="accession-table-title">BAM Sample ID</td>
                                <td>{ bam_sample_id }</td>
                            </tr>: null }
                        { sequence_id ?
                            <tr>
                                <td className="accession-table-title">Sequence ID</td>
                                <td>{ sequence_id }</td>
                            </tr>: null }
                        { specimen_accession ?
                            <tr>
                                <td className="accession-table-title">Specimen Accession</td>
                                <td>{ specimen_accession }</td>
                            </tr>: null
                        }
                        { other_specimen_ids ?
                            other_specimen_ids.map((obj) => {
                                const { id_type = null, id = null } = obj;
                                return (
                                    <tr key={id+id_type}>
                                        <td className="accession-table-title">{id_type}</td>
                                        <td>{ id }</td>
                                    </tr>);
                            }): null
                        }
                        <tr>
                            <td className="accession-table-title">CGAP Sample ID</td>
                            <td>{accession}</td>
                        </tr>
                        { specimen_type ?
                            <tr>
                                <td className="accession-table-title">Sample Type</td>
                                <td>{specimen_type }</td>
                            </tr>: null}
                        { specimen_collection_date ?
                            <tr>
                                <td className="accession-table-title">Collected</td>
                                <td>{specimen_collection_date }</td>
                            </tr>: null }
                    </tbody>
                </table>
            </div>);

        return (
            <StackedBlock columnClass="libraries" hideNameOnHover={false} key={atId} id={atId}>
                { (atId && workup_type) ?
                    <StackedBlockName className="flex-row align-items-center justify-content-between">
                        <div className="d-flex">
                            <a href={atId} data-tip="View Sample" className={`name-title ${isSampleForResult ? 'current-case' : ''}`}>
                                { workup_type }
                            </a>
                        </div>
                        { sampleAccessionTable }
                    </StackedBlockName> :
                    <StackedBlockName>
                        { workup_type ? null : "No workup type found for sample"}
                        { atId ?
                            <a href={atId} data-tip={workup_type ? null: "View Sample"} className="name-title">
                                { workup_type || accession }
                            </a> : <span className="name-title">{ workup_type || accession }</span>}
                    </StackedBlockName>
                }

                <StackedBlockList className="report" title="Report">
                    { reportBlocks ? reportBlocks : FamilyAccessionStackedTable.renderEmptyBlock("report") }
                </StackedBlockList>
            </StackedBlock>
        );
    }

    /**
     * Renders a row for an individual, and then its nested sample and case/report blocks.
     * @param {object} individual       The current row's individual item object
     * @param {string} role             Relationship of the current individual to this family's proband
     * @param {string} familyId         AtId for the family represented by this table
     * @param {string} familyAccession  Accession for the family represented by this table
     *
     * Note: because an individual may be connected to many cases (which may or may not use the same samples),
     * this method also contains logic for mapping the various samples this chosen individual may have to its
     * various cases/associated reports. Individuals.cases[i].sample is compared to the current individual's samples
     * to determine what samples are aligned with what cases, and render appropriate sample blocks
     * (and nested case/report blocks).
     */
    renderIndividualBlock(individual = null, role = null, familyId = null, familyAccession = null) {
        const { result = null, family = null } = this.props;
        const { analysis_groups: analysisGroups = [] } = family || {};
        const { "@id": resultCaseAtId = null } = result || {};

        // Individual from params
        const { "@id": atId = null, individual_id = null, display_title = null, case: cases = [], accession = null, samples: indvSamples = [] } = individual || {};

        // A mapping of sample @ids to an array of report/case blocks
        const sampleToCaseReportBlockMap = {};

        // Generate a set of report/case blocks for each case
        cases.forEach((currCase) => {
            const { '@id': caseAtId = null, accession: caseAccession = null, case_title = null, sample = null, report = null } = currCase || {};
            const { '@id': sampleAtId = null } = sample || {};
            const { '@id' : reportAtId = null, accession: reportAccession = null } = report || {};

            // Is this case the current case?
            const isResultCase = caseAtId === resultCaseAtId;

            // Used as title for report/case block
            let analysisType = null;

            // Search each analysis group for one with the current case
            analysisGroups.forEach((analysisGroup) => {
                const { cases: casesInAnalysisGroup = [], analysis_type = null } = analysisGroup || {};
                casesInAnalysisGroup.forEach((agCase) => {
                    const { '@id': agCaseAtId } = agCase || {};
                    if (agCaseAtId === caseAtId) {
                        analysisType = analysis_type;
                    }
                });
            });

            if (sampleAtId) {
                const thisReportBlock = (
                    <StackedBlock columnClass="report" hideNameOnHover={false} key={reportAtId} id={reportAtId}>
                        <StackedBlockName className="flex-row align-items-center justify-content-between">
                            <div className="d-flex">
                                { reportAtId ?
                                    <a href={reportAtId} className={"name-title" + (isResultCase ? " current-case": "")}>
                                        { analysisType }
                                    </a> : <span className={"name-title" + (isResultCase ? " current-case": "")}>{ analysisType }</span>}
                            </div>
                            <div className="w-100" style={{ maxWidth: "70%" }}>
                                <table className="accession-table w-100">
                                    <tbody>
                                        { case_title ?
                                            <tr>
                                                <td className="accession-table-title">Case ID</td>
                                                <td>{case_title}</td>
                                            </tr>
                                            : null}
                                        { caseAtId ?
                                            <tr>
                                                <td className="accession-table-title">CGAP Case ID</td>
                                                <td>{caseAccession}</td>
                                            </tr>
                                            : null}
                                        { reportAtId ?
                                            <tr>
                                                <td className="accession-table-title">Report ID</td>
                                                <td>{reportAccession}</td>
                                            </tr>
                                            : null}
                                    </tbody>
                                </table>
                            </div>
                        </StackedBlockName>
                    </StackedBlock>);

                if (sampleToCaseReportBlockMap[sampleAtId] === undefined) {
                    sampleToCaseReportBlockMap[sampleAtId] = [thisReportBlock];
                } else {
                    sampleToCaseReportBlockMap[sampleAtId].push(thisReportBlock);
                }
            }
        });

        return ( // We can pass 'className={..}' to this if needed.
            <StackedBlock hideNameOnHover={false} columnClass="individual" key={atId} id={atId}>
                <StackedBlockName className="flex-row align-items-center justify-content-between">
                    <div className="d-flex flex-column individual-role">
                        { atId ?
                            <a href={atId} className={`name-title text-capitalize ${(result.individual['@id'] === individual['@id']) ? "current-case" : ""}`}>
                                { role || display_title }
                            </a> : <span className={`name-title text-capitalize ${(result.individual['@id'] === individual['@id']) ? "current-case" : ""}`}>{ role || display_title }</span>}
                        <span className="d-block text-small">({ individual_id ? individual_id : (display_title !== accession) ? display_title : "N/A" })</span>
                    </div>
                    <div className="w-100" style={{ maxWidth: "70%" }}>
                        <table className="accession-table w-100">
                            <tbody>
                                { individual_id ?
                                    <tr>
                                        <td className="accession-table-title">Institutional ID</td>
                                        <td>{ individual_id }</td>
                                    </tr> : null }
                                { accession ?
                                    <tr>
                                        <td className="accession-table-title">CGAP Individual ID</td>
                                        <td>{ accession }</td>
                                    </tr> : null }
                                { familyId ?
                                    <tr>
                                        <td className="accession-table-title">Family ID</td>
                                        <td>{ familyId }</td>
                                    </tr> : null }
                                { familyAccession ?
                                    <tr>
                                        <td className="accession-table-title">CGAP Family ID</td>
                                        <td>{ familyAccession }</td>
                                    </tr> : null }
                            </tbody>
                        </table>
                    </div>
                </StackedBlockName>
                <StackedBlockList className="libraries" title="Libraries">
                    { indvSamples.map((thisSample) =>
                    {
                        const { '@id' : thisSampleAtId } = thisSample || {};

                        const reportBlocks = sampleToCaseReportBlockMap[thisSampleAtId];
                        return this.renderSampleBlock(thisSample, reportBlocks);
                    })}
                </StackedBlockList>
            </StackedBlock>
        );
    }

    renderIndividualBlockList() {
        const { family = null } = this.props;
        const { members = [], proband = null, relationships = [], accession: familyAccession = null, family_id: familyId } = family || {};

        // Create a mapping of individual accessions to relationships/sex
        const relationshipMapping = {};
        relationships.forEach((item) => {
            const { relationship = null, sex = null, individual = null } = item;
            relationshipMapping[individual] = { sex, relationship };
        });

        // Sort individuals (proband first, then individuals with samples, then all others)
        const sortedMembers = _(members).chain().sortBy(function(member) {
            const { accession = null } = member;
            const { accession: pAccession = null } = proband;
            return accession === pAccession;
        }).sortBy(function(member) {
            const { samples = [] } = member;
            return samples.length > 0;
        }).value().reverse();

        const indvBlocks = sortedMembers.map((familyMember) => {
            const currId = familyMember['accession'];
            const { relationship: currRelationship = null, sex: currSex = null } = relationshipMapping[currId] || {};
            return this.renderIndividualBlock(familyMember, currRelationship || currId , familyId, familyAccession );
        });

        return (
            <StackedBlockList className="individuals" title="Individuals" defaultCollapsed={false}>
                { indvBlocks }
            </StackedBlockList>
        );
    }

    /**
     * Here we render nested divs for a 'table' of experiments with shared elements spanning multiple rows,
     * e.g. Individual's height is the combined height of its containing sample rows.
     *  _______________________________________________________
     * |                                                       |
     * |             Sequencing Libraries       Report         |
     * |                                                       |
     * | Individual  __________________________________________|
     * |                                                       |
     * |             Sequencing Libraries       Report         |
     * |                                                       |
     * |_______________________________________________________|
     *
     * Much of styling/layouting is defined in CSS.
     */
    render(){
        const {
            columnHeaders: propColHeaders,
            className = null,
            collapseShow = 3,
            showMetricsColumns,
            // TODO: forgot if `width` is actually necessary anymore; used to be display:table-cell blocks with float left before was refactored to flex.
            // If not needed, we could delete here and in SPC, else pass down via like utility function `getWideContainerWidth(windowWidth)`.
            width,
            preventExpand
        } = this.props;
        const columnHeaders = FamilyAccessionStackedTable.staticColumnHeaders(propColHeaders, showMetricsColumns);
        const cls = "stacked-block-table-outer-container overflow-auto" + (cls ? " " + cls : "");
        return (
            <div className={cls}>
                <StackedBlockTable {...{ columnHeaders, width, preventExpand, collapseShow }} stackDepth={0}
                    fadeIn allFiles={[]} collapseLongLists={true} defaultCollapsed={true}
                    handleFileCheckboxChange={this.handleFileCheckboxChange}>
                    { this.renderIndividualBlockList()}
                </StackedBlockTable>
            </div>
        );
    }
}

