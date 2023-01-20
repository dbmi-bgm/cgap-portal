'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import memoize from 'memoize-one';

import { object, layout } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { StackedBlockTable, StackedBlock, StackedBlockList, StackedBlockName, StackedBlockNameLabel } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/StackedBlockTable';
import { responsiveGridState } from './../util/layout';
import { findCanonicalFamilyIndex } from './../item-pages/CaseView/CurrentFamilyController';


export class CaseDetailPane extends React.PureComponent {

    static propTypes = {
        'result' : PropTypes.object.isRequired,
        'detailPaneStateCache' : PropTypes.object.isRequired,
        'updateDetailPaneStateCache' : PropTypes.func.isRequired,
        'setDetailHeightFromPane' : PropTypes.func.isRequired,
        'containerWidth' : PropTypes.number,
        'paddingWidth' : PropTypes.number,
        'windowWidth' : PropTypes.number,
        'href' : PropTypes.string,
        'minimumWidth' : PropTypes.number
    };

    static defaultProps = {
        'paddingWidth' : 0,
        'minimumWidth' : 725,
    };

    constructor(props){
        super(props);
        const { detailPaneStateCache = {}, result: { "@id": resultID } } = props;
        this.toggleOpenFamily = this.toggleOpenFamily.bind(this);
        this.state = detailPaneStateCache[resultID] || {
            // Keyed by family index (b.c. unsure if a family "@id" exists, and if so, if lack of view permission for it is possible)
            familiesOpen: {}
        };

        this.memoized = {
            findCanonicalFamilyIndex: memoize(findCanonicalFamilyIndex),
            getSecondaryFamilies: memoize(function(familyList, canonicalFamilyReference){
                return familyList.filter(function(family){
                    return family !== canonicalFamilyReference;
                });
            })
        };
    }

    /** Save own state to DetailPaneStateCache.detailPaneStateCache */
    componentWillUnmount(){
        const { result: { "@id": resultID }, updateDetailPaneStateCache } = this.props;

        if (typeof updateDetailPaneStateCache !== "function") {
            return;
        }

        const { familiesOpen } = this.state;

        const anyOpen = Object.keys(familiesOpen).length > 0;
        updateDetailPaneStateCache(resultID, anyOpen ? { ...this.state } : null);
    }

    toggleOpenFamily(familyIndx){
        this.setState(function({ familiesOpen: prevOpen }){
            const familiesOpen = { ...prevOpen };
            familiesOpen[familyIndx] = !(familiesOpen[familyIndx] || false);
            return { familiesOpen };
        }, ()=>{
            const { setDetailHeightFromPane } = this.props;
            if (typeof setDetailHeightFromPane === "function") {
                setDetailHeightFromPane();
            }
        });
    }

    render(){
        const { paddingWidthMap, paddingWidth, containerWidth, windowWidth, result, minimumWidth, detailPaneStateCache, updateDetailPaneStateCache } = this.props;
        const { familiesOpen } = this.state;
        const {
            family: partialFamilyEmbed,
            sample_processing: {
                families: spFamilies = [],
            },
            cohort,
            project
        } = result;

        // Allow to throw error if not found -- or should we support Cases without any families present/visible?
        const canonicalFamilyIndex = this.memoized.findCanonicalFamilyIndex(spFamilies, partialFamilyEmbed);
        const canonicalFamily = canonicalFamilyIndex > -1 ? spFamilies[canonicalFamilyIndex] : null;
        const secondaryFamilies = this.memoized.getSecondaryFamilies(spFamilies, canonicalFamily);

        let usePadWidth = paddingWidth || 0;
        if (paddingWidthMap){
            usePadWidth = paddingWidthMap[responsiveGridState(windowWidth)] || paddingWidth;
        }
        const commonFamilySectionProps = {
            containerWidth, result, minimumWidth, paddingWidth: usePadWidth,
            detailPaneStateCache, updateDetailPaneStateCache
        };

        let families = [];
        if (canonicalFamily !== null) {
            // Reorder + ensure we add canonical family first to this list.
            families.push(canonicalFamily);
            if (secondaryFamilies.length > 0) {
                families = families.concat(secondaryFamilies);
            }
        }

        // Once primary/other family objects added to Case schema, update to use those instead
        const familySections = families.map((family, familyIndex) => {
            const { '@id': familyID } = family;
            const open = familiesOpen[familyIndex];
            return (
                <FamilySection {...commonFamilySectionProps} {...{ family, familyIndex, open }}
                    key={familyID} onToggleOpen={this.toggleOpenFamily} />
            );
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
                                    { object.itemUtil.generateLink(cohort) || <small><em>None</em></small> }
                                </div>
                            </div>
                            <div className="row mb-05 clearfix">
                                <div className="col-4 col-sm-3 text-500">
                                    Project:
                                </div>
                                <div className="col-8 col-sm-9 family-addinfo-val">
                                    { object.itemUtil.generateLink(project) || <small><em>None</em></small> }
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
    }
}


/**
 * Renders a collapsible button that opens to reveal a FamilyReportStackedTable containing information
 * about each individual/sample/case in the current family.
 */
class FamilySection extends React.Component {

    constructor(props) {
        super(props);
        this.onToggle = _.throttle(this.onToggle.bind(this), 750, { 'trailing' : false });
    }

    onToggle(e) {
        e.preventDefault();
        e.stopPropagation();
        const { onToggleOpen, familyIndex } = this.props;
        onToggleOpen(familyIndex);
    }

    render() {
        const { family, result, open, containerWidth, minimumWidth, paddingWidth } = this.props;
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
                        {...{ result, family }} preventExpand={true}
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
 * @todo (?) Highlight current case throughout the table using 'result' prop.
 * @todo Maybe we can migrate to simpler flex/css instead of StackedTable eventually..
 */
export class FamilyReportStackedTable extends React.PureComponent {

    // Keeping these builtInHeader methods separate in case we want to build in custom columns later
    static builtInHeaders = [
        { columnClass: 'individual',    className: 'text-left',         title: 'Individual',                initialWidth: 200   },
        { columnClass: 'libraries',     className: 'text-left',         title: 'Sequencing Libraries',      initialWidth: 80    },
        /* report + analysis columns have no labels, but have left alignment, so we add 12px padding left to visually align header to it better */
        { columnClass: 'analysis',      className: 'text-left pl-12',         title: 'Analysis',            initialWidth: 80    },
        { columnClass: 'report',        className: 'text-left pl-12',   title: 'Report',                    initialWidth: 260   }
    ];

    /* Built-in headers */
    static staticColumnHeaders(columnHeaders){
        return FamilyReportStackedTable.builtInHeaders.map(function(staticCol){
            const foundColumnFromParamHeaders = _.findWhere(columnHeaders, { 'title' : staticCol.title });
            return { ...staticCol, ...(foundColumnFromParamHeaders || {}) };
        });
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
        this.memoized = {
            staticColumnHeaders: memoize(FamilyReportStackedTable.staticColumnHeaders)
        };
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
                    <div className="name-title text-left pt-2 pb-2">
                        { atId ? <a href={atId}>{ workup_type }</a> : <span>{ workup_type }</span> }
                    </div>
                </StackedBlockName>
                <StackedBlockList className="analysis" title="Analysis">
                    { analysisGroups.filter(function({ samples: analysisGroupSamples = [] }){
                        if (analysisGroupSamples.length > 0) {
                            if (_.any(analysisGroupSamples, function({ "@id": agSampleID }){
                                return agSampleID === atId;
                            })) {
                                return true;
                            } else {
                                return false;
                            }
                        }
                        return true;
                    }).map((analysisGroup) => {
                        const { analysis_type = null, analysis_version = null, cases: groupCases = [] } = analysisGroup || {};

                        // Figure out which report is associated with the current analysis group & sample
                        const groupCase = groupCases.find(function(groupCase){
                            const { sample: { '@id': groupCaseSampleAtId = null } = {} } = groupCase || {};
                            if (groupCaseSampleAtId === atId) {
                                return true;
                            }
                            return false;
                        });

                        const { '@id': groupCaseAtId = null } = groupCase || {};

                        const reportBlockId = caseToReportMap[groupCaseAtId];
                        const fallbackKey = 'case-' + groupCaseAtId;
                        const analysis_title = analysis_type + (analysis_version ? " (" + analysis_version + ")" : "");
                        let reportBlock = null;

                        if (reportBlockId) {
                            reportBlock = reportBlockMapping[reportBlockId];
                        // TODO: Rework this entire method of passing case through; didn't realize case was necessary early on and needed this
                        } else if (reportBlockMapping[fallbackKey]) {
                            reportBlock = reportBlockMapping[fallbackKey] || null;
                        }

                        return (
                            <StackedBlock key={analysis_type} columnClass="analysis" hideNameOnHover={false}
                                label={<StackedBlockNameLabel title={null} subtitle={null} accession={null} subtitleVisible/>}>
                                <StackedBlockName>
                                    <span className="name-title text-left d-block">{ analysis_title }</span>
                                </StackedBlockName>
                                <StackedBlockList className="report" title="Report">
                                    { reportBlock ? <StackedBlockList className="report" title="Report">{reportBlock}</StackedBlockList> : FamilyReportStackedTable.renderEmptyBlock("report") }
                                </StackedBlockList>
                            </StackedBlock>
                        );
                    }) }
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
                        label={<StackedBlockNameLabel title={null} accession={null} subtitleVisible/>}>
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
            <StackedBlock hideNameOnHover={false} columnClass="individual" key={atId} id={atId}
                label={<StackedBlockNameLabel title="CGAP ID" accession={accession} subtitleVisible/>}>
                <StackedBlockName>
                    <div className="name-title pt-2 pb-2 text-left">
                        { atId ?
                            <a href={atId} className="text-capitalize">
                                { role || display_title }
                            </a>
                            : <span className="text-capitalize">{ role || display_title }</span>
                        }
                        { individual_id ? <span> ({individual_id})</span> : null }
                    </div>
                </StackedBlockName>
                <StackedBlockList className="libraries" title="Sequencing Libraries">
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
        const columnHeaders = this.memoized.staticColumnHeaders(propColHeaders, showMetricsColumns);
        return (
            <div className="stacked-block-table-outer-container overflow-auto">
                <StackedBlockTable {...{ preventExpand, columnHeaders, width }} stackDepth="0" collapseShow="3"
                    fadeIn collapseLongLists={true} defaultCollapsed={true}
                    handleFileCheckboxChange={this.handleFileCheckboxChange}>
                    { this.renderIndividualBlockList()}
                </StackedBlockTable>
            </div>
        );
    }
}

/**
 * Used within Accessioning tab on Case View.
 *
 * Takes in the current case item ('result' prop) and a single family associated with said case
 * and renders a table containing all of the accessions/various IDs for each individual, sample,
 * and report/case in that family. Current case is highlighted throughout the table, and results
 * are sorted by individual (first proband, then individuals with samples, then the rest).
 *
 * @todo Move into static/item-pages/CaseView (either own file or inside index.js or (preferred?) new file AccesioningTab.js)
 */
export class FamilyAccessionStackedTable extends React.PureComponent {

    // Keeping these builtInHeaders separate in case we want to build in custom columns later
    static builtInHeaders = [
        { columnClass: 'individual',    title: 'Individual',            initialWidth: 220   },
        { columnClass: 'libraries',     title: 'Sequencing',            initialWidth: 220   },
        { columnClass: 'report',        title: 'Report',                initialWidth: 200   }
    ];

    /* Built-in headers */
    static staticColumnHeaders(columnHeaders){
        return FamilyAccessionStackedTable.builtInHeaders.map(function(staticCol){
            const foundColumnFromParamHeaders = _.findWhere(columnHeaders, { 'title' : staticCol.title });
            return { ...staticCol, ...(foundColumnFromParamHeaders || {}) };
        });
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
            <StackedBlock {...{ columnClass }} subtitleVisible={false} key={"empty-" + columnClass}
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
                <div className="accession-table w-100">
                    { bam_sample_id ?
                        <div className="row justify-content-between">
                            <div className="col accession-table-title">BAM Sample ID</div>
                            <div className="col-auto text-truncate">{ bam_sample_id }</div>
                        </div>: null }
                    { sequence_id ?
                        <div className="row justify-content-between">
                            <div className="col-auto accession-table-title">Sequence ID</div>
                            <div className="col-auto text-truncate">{ sequence_id }</div>
                        </div>: null }
                    { specimen_accession ?
                        <div className="row justify-content-between">
                            <div className="col-auto accession-table-title">Specimen ID</div>
                            <div className="col-auto text-truncate">{ specimen_accession }</div>
                        </div>: null
                    }
                    { other_specimen_ids ?
                        other_specimen_ids.map((obj) => {
                            const { id_type = null, id = null } = obj;
                            return (
                                <div className="row justify-content-between" key={id+id_type}>
                                    <div className="col-auto accession-table-title">{id_type}</div>
                                    <div className="col-auto text-truncate">{ id }</div>
                                </div>
                            );
                        }): null
                    }
                    <div className="row justify-content-between">
                        <div className="col accession-table-title">CGAP Sample ID</div>
                        <div className="col-auto text-truncate">{accession}</div>
                    </div>
                    { specimen_type ?
                        <div className="row justify-content-between">
                            <div className="col accession-table-title">Sample Type</div>
                            <div className="col-auto text-truncate">{specimen_type }</div>
                        </div>: null}
                    { specimen_collection_date ?
                        <div className="row justify-content-between">
                            <div className="col accession-table-title">Collected</div>
                            <div className="col-auto text-truncate">{specimen_collection_date }</div>
                        </div>: null }
                </div>
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
                    { reportBlocks ? reportBlocks : [FamilyAccessionStackedTable.renderEmptyBlock("report")] }
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
            let analysisTitle = null;

            // Search each analysis group for one with the current case
            analysisGroups.forEach((analysisGroup) => {
                const { cases: casesInAnalysisGroup = [], analysis_type = null, analysis_version = null } = analysisGroup || {};
                casesInAnalysisGroup.forEach((agCase) => {
                    const { '@id': agCaseAtId } = agCase || {};
                    if (agCaseAtId === caseAtId) {
                        analysisTitle = analysis_type + (analysis_version ? " (" + analysis_version + ")" : "");
                    }
                });
            });

            if (sampleAtId) {
                const thisReportBlock = (
                    <StackedBlock columnClass="report" hideNameOnHover={false} key={reportAtId} id={reportAtId}>
                        <StackedBlockName className="flex-row align-items-center justify-content-between">
                            {/* <div className="d-flex">
                                { reportAtId ?
                                    <a href={reportAtId} className={"name-title" + (isResultCase ? " current-case": "")}>
                                        { analysisTitle }
                                    </a> : <span className={"name-title" + (isResultCase ? " current-case": "")}>{ analysisTitle }</span>}
                            </div> */}
                            <div className="w-100">
                                <div className="accession-table w-100">
                                    { case_title ?
                                        <div className="row justify-content-between">
                                            <div className="col-auto accession-table-title">Case ID</div>
                                            <div className={"col-auto text-truncate" + (isResultCase ? " current-case": "")}>{case_title}</div>
                                        </div>
                                        : null}
                                    { caseAtId ?
                                        <div className="row justify-content-between">
                                            <div className="col accession-table-title">CGAP Case ID</div>
                                            <div className="col-auto text-truncate">{caseAccession}</div>
                                        </div>
                                        : null}
                                    { reportAtId ?
                                        <div className="row justify-content-between">
                                            <div className="col accession-table-title">Report ID</div>
                                            <div className="col-auto text-truncate">{reportAccession}</div>
                                        </div>
                                        : null}
                                </div>
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
                    <div className="d-flex flex-column individual-role pr-2">
                        { atId ?
                            <a href={atId} className={`name-title mx-0 text-truncate text-capitalize ${(result.individual['@id'] === individual['@id']) ? "current-case" : ""}`}>
                                { role || display_title }
                            </a>
                            :
                            <span className={`name-title text-truncate text-capitalize ${(result.individual['@id'] === individual['@id']) ? "current-case" : ""}`}>
                                { role || display_title }
                            </span>
                        }
                        <span className="d-block pt-04 text-small mw-100 text-truncate">
                            ({ individual_id ? individual_id : (display_title !== accession) ? display_title : "N/A" })
                        </span>
                    </div>
                    <div className="w-100" style={{ maxWidth: "70%" }}>
                        <div className="accession-table">
                            { individual_id ?
                                <div className="row justify-content-between">
                                    <div className="col-auto accession-table-title">Institutional ID</div>
                                    <div className="col-auto text-truncate">{ individual_id }</div>
                                </div> : null }
                            { accession ?
                                <div className="row justify-content-between">
                                    <div className="col accession-table-title">CGAP Individual ID</div>
                                    <div className="col-auto text-truncate">{ accession }</div>
                                </div> : null }
                            { familyId ?
                                <div className="row justify-content-between">
                                    <div className="col accession-table-title">Family ID</div>
                                    <div className="col-auto text-truncate">{ familyId }</div>
                                </div> : null }
                            { familyAccession ?
                                <div className="row justify-content-between">
                                    <div className="col accession-table-title">CGAP Family ID</div>
                                    <div className="col-auto text-truncate">{ familyAccession }</div>
                                </div> : null }
                        </div>
                    </div>
                </StackedBlockName>
                <StackedBlockList className="libraries" title="Sequencing Libraries">
                    { indvSamples.map((thisSample) => {
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
