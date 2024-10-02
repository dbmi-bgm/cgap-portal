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
                    <div className="col-auto pe-0">
                        <i className={"toggle-open-icon icon icon-fw fas icon-" + (open ? 'minus' : 'plus')} />
                    </div>
                    <div className="col">
                        { family.display_title }: <span className="text-200 fst-italic">Family &amp; Report History</span>
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
        { columnClass: 'individual',    className: 'text-start',         title: 'Individual',                initialWidth: 200   },
        { columnClass: 'libraries',     className: 'text-start',         title: 'Sequencing Libraries',      initialWidth: 80    },
        /* report + analysis columns have no labels, but have left alignment, so we add 12px padding left to visually align header to it better */
        { columnClass: 'analysis',      className: 'text-start ps-12',         title: 'Analysis',            initialWidth: 80    },
        { columnClass: 'report',        className: 'text-start ps-12',   title: 'Report',                    initialWidth: 260   }
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
                    <div className="name-title text-start pt-2 pb-2">
                        { atId ? <a href={atId} className="link-underline-hover">{ workup_type }</a> : <span>{ workup_type }</span> }
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
                                    <span className="name-title text-start d-block">{ analysis_title }</span>
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
                            <div className="d-flex text-start">
                                <span className="me-07 text-nowrap">Case ID:</span>
                                { caseAtId ? <a href={caseAtId} className="name-title text-capitalize link-underline-hover">{ case_title }</a> : <span className="name-title text-capitalize">{ case_title }</span>}
                            </div>
                            <div className="d-flex text-start">
                                <span className="me-07 text-nowrap">Report:</span>
                                { reportAtId ? <a href={reportAtId} className="name-title text-capitalize link-underline-hover">{ reportTitle }</a> : <span className="name-title text-capitalize">{ reportTitle }</span>}
                            </div>
                        </StackedBlockName>
                    </StackedBlock>);
                caseToReportMap[caseAtId] = reportAtId;
            } else { // render an appropriate block when there is a case but no report by mapping case+[caseAtID] : JSX block
                reportToReportBlockMap['case-' + caseAtId] = (
                    <StackedBlock columnClass="report" hideNameOnHover={false} key={reportAtId} id={reportAtId}
                        label={<StackedBlockNameLabel title={null} accession={null} subtitleVisible/>}>
                        <StackedBlockName>
                            <div className="d-flex text-start">
                                <span className="me-07 text-nowrap">Case ID:</span>
                                { caseAtId ?
                                    <a href={caseAtId} className="name-title text-capitalize link-underline-hover">{ case_title }</a>
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
                    <div className="name-title pt-2 pb-2 text-start">
                        { atId ?
                            <a href={atId} className="text-capitalize link-underline-hover">
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
                { preventExpand ? <a href={object.itemUtil.atId(family)} className="link-underline-hover">(view Family)</a> : null }
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

