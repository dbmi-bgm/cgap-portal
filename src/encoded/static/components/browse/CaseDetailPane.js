'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';

// import { Collapse } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Collapse';
// import { FlexibleDescriptionBox } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/FlexibleDescriptionBox';
import { object, layout } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { StackedBlockTable, StackedBlock, StackedBlockList, StackedBlockName, StackedBlockNameLabel } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/StackedBlockTable';


export const CaseDetailPane = React.memo(function CaseDetailPane (props) {
    const { paddingWidthMap, paddingWidth, containerWidth, windowWidth, result, minimumWidth } = props;
    const { family = null, secondary_families = null } = result;

    let usePadWidth = paddingWidth || 0;
    if (paddingWidthMap){
        usePadWidth = paddingWidthMap[layout.responsiveGridState(windowWidth)] || paddingWidth;
    }
    const commonFamilySectionProps = {
        containerWidth, result, minimumWidth, paddingWidth: usePadWidth
    };

    const families = [];
    if (family !== null) {
        families.push(family);
        if (secondary_families !== null && secondary_families.length > 0) {
            familes = familes.concat(secondary_families);
        }
    }

    // Once primary/other family objects added to Case schema, update to use those instead
    const familySections = families.map(function(family){
        return <FamilySection {...commonFamilySectionProps} key={family['@id']} {...{ result, family }} />;
    });

    return (
        <div className="family-info-wrapper"> {/* Formerly experiment-set-info-wrapper*/}
            <div className="family-addinfo"> {/* Formerly expset-addinfo */}
                <div className="row">
                    {/* <div className="col-md-6 addinfo-description-section">
                        <FlexibleDescriptionBox
                            windowWidth={windowWidth}
                            description={ result.description }
                            fitTo="self"
                            textClassName="text-normal"
                            dimensions={null}
                            linesOfText={2}
                        />
                    </div> */}
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
            <div style={{ overflowX : 'auto', width: containerWidth ? (containerWidth - usePadWidth) : null }} className="family-tables-container"> {/*formerly files-tables-container */}
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


class FamilySection extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            open: false,
        };
        this.onToggle = _.throttle(this.onToggle.bind(this), 600, { 'trailing' : false });
    }

    onToggle() {
        const { open } = this.state;
        this.setState({ open: !open });
    }

    innerTabContents() {
        const { containerWidth, family, result, minimumWidth, paddingWidth } = this.props;
        return (
            <FamilyReportStackedTable
                result={result} family={family} preventExpand={false}
                width={containerWidth ? (Math.max(containerWidth - paddingWidth, minimumWidth) /* account for padding of pane */) : null}
                fadeIn={false} collapseLongLists
            />
        );
    }

    render() {
        const { open } = this.state;
        const { family } = this.props;
        return (
            <div className="family-table-section">
                <h4 className="pane-section-title" onClick={this.onToggle}>
                    <i className={"toggle-open-icon icon icon-fw fas icon-" + (open ? 'minus' : 'plus')} />
                    {family.display_title}: <span className="text-200 font-italic">Family &amp; Report History</span>
                </h4>
                {
                    open ? this.innerTabContents() : null
                }
            </div>
        );
    }
}

/**
 * To be used within Case Search
 *
 * Shows individuals within a passed-in family, as well as any sample analyses objects related to that Case.
 */
export class FamilyReportStackedTable extends React.PureComponent {

    static StackedBlock = StackedBlock

    static builtInHeaders(){
        // Keeping these builtInHeader methods separate in case we want to build in custom columns later
        return [
            { columnClass: 'individual',     className: 'text-left',     title: 'Individual',     initialWidth: 220   },
            { columnClass: 'libraries',    className: 'text-left',     title: 'Libraries',    initialWidth: 220   },
            { columnClass: 'analysis',    title: 'Analysis',    initialWidth: 200   },
            { columnClass: 'report',    title: 'Report',          initialWidth: 200  }
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

    renderSampleBlock(sample, reportBlockMapping = null, caseToReportMap = null){
        const { result = null, family = null } = this.props;
        const { analysis_groups: analysisGroups = [] } = family || {};
        const { sample_processing = null } = result || {};
        const { '@id': atId = null, workup_type = "-", display_title = null, accession = null } = sample || {};
        const { samples = [], completed_processes = [] } = sample_processing || {};

        let blockValue = '-';
        samples.forEach((thisSample) => {
            if (atId === thisSample['@id']) {
                blockValue = completed_processes;
            }
        });

        return (
            <StackedBlock columnClass="libraries" hideNameOnHover={false} key={atId} id={atId}
                label={<StackedBlockNameLabel title="Sample" subtitle="Library" accession={accession} subtitleVisible/>}>
                <StackedBlockName>
                    <span className="name-title">
                        { atId ? <a href={atId} className="name-title">{ workup_type }</a> : <span className="name-title">{ workup_type }</span>}
                    </span>
                </StackedBlockName>
                <StackedBlockList className="analysis" title="Analysis">
                    {analysisGroups.map((group) => {
                        const { analysis_type = null, samples = [], cases = [] } = group || {};
                        let reportBlock = null;

                        // Figure out which report is associated with the current analysis group & sample
                        cases.forEach((groupCase) => {
                            const { '@id': thisCaseAtId = null, sample: caseSample = null } = groupCase || {};
                            const { '@id': sampleAtId = null } = caseSample || {};
                            if (sampleAtId === atId) {
                                const reportBlockId = caseToReportMap[thisCaseAtId];
                                if (reportBlockId) {
                                    reportBlock = reportBlockMapping[reportBlockId];
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
        // Break out useful values from result; used in determining whether the passed in individual === the result case individual
        const { result = null, sample_processing = null, family = null } = this.props;
        const { analysis_groups: analysisGroups = null } = family || {};
        const { "@id": resultCaseAtId = null, individual: resultIndividual = null, report: resultReport = null, sample: resultSample = null } = result || {};
        const { "@id": resultIndvAtId = null } = resultIndividual || {};
        const { "@id": resultReportAtId = null } = resultReport || {};
        const { "@id": resultSampleId = null } = resultSample || {};
        const { procSamples = [], completed_processes = [] } = sample_processing || {};

        // Passed in Individual
        const { "@id": atId = null, individual_id = null, display_title = null, case: cases = [], accession = null, samples: indvSamples = [] } = individual || {};

        let cls;
        if (resultIndividual) {
            cls = resultIndvAtId === atId ? "current-case": null;
        }

        const reportToReportBlockMap = {};
        const caseToReportMap = {};

        cases.forEach((currCase) => {
            const { '@id': caseAtId = null, accession: caseAccession = null, case_title = null, sample = null, report = null } = currCase || {};
            const { '@id': sampleAtId = null, accession: sampleAccession = null, workup_type = null } = sample || {};
            const { '@id' : reportAtId = null, display_title : reportTitle = null, accession: reportAccession = null } = report || {};

            if (sampleAtId && reportAtId) {
                reportToReportBlockMap[reportAtId] = (
                    <StackedBlock columnClass="report" hideNameOnHover={false} key={reportAtId} id={reportAtId}
                        label={<StackedBlockNameLabel title={null} accession={null} subtitleVisible/>}
                    >
                        <StackedBlockName>
                            { reportAtId ? <a href={reportAtId} className="name-title text-capitalize">{ reportTitle }</a> : <span className="name-title text-capitalize">{ reportTitle }</span>}
                        </StackedBlockName>
                    </StackedBlock>);
                caseToReportMap[caseAtId] = reportAtId;
            }
        });

        return (
            <StackedBlock {...{ cls }} hideNameOnHover={false} columnClass="individual"
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

        const indvBlocks = sortedMembers.map((familyMember) => {
            const { accession: currId = null, display_title = null } = familyMember;
            const { relationship: currRelationship = null, sex: currSex = null } = relationshipMapping[currId] || {};
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
 * To be used within Case Search OR Accessioning tab on Case View
 *
 * Shows individuals within a passed-in family, as well as any sample analyses objects related to that Case.
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

    static renderEmptyBlock(columnClass, depth) {
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

    renderSampleBlock(sample, reportBlocks = null){
        const { result } = this.props;
        const { sample: resultSample = null, sample_processing = {} } = result;
        const { samples = [], completed_processes = [] } = sample_processing;
        const { '@id': resultSampleAtId = null } = resultSample;


        const { '@id': atId = null, specimen_collection_date = null, specimen_type = null, workup_type = null, display_title = null, accession = null } = sample;

        let blockValue = '-';
        samples.forEach((thisSample) => {
            if (atId === thisSample['@id']) {
                blockValue = completed_processes;
            }
        });

        const isSampleForResult = resultSampleAtId === atId;

        const fullTable = (
            <div className="w-100" style={{ maxWidth: "70%" }}>
                <table className="accession-table w-100">
                    <tbody>
                        <tr>
                            <td className="accession-table-title">Sample ID</td>
                            <td>{accession || "-"}</td>
                        </tr>
                        { display_title && (display_title !== accession) ?
                            <tr>
                                <td className="accession-table-title">CGAP ID</td>
                                <td>{ display_title }</td>
                            </tr> : null}
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
                            <a href={atId} data-tip="View Sample" className={`name-title p-1 ${isSampleForResult ? 'current-case' : ''}`}>
                                { workup_type || "-" }
                            </a>
                        </div>
                        { fullTable }
                    </StackedBlockName> :
                    <StackedBlockName>
                        { workup_type ? null : "No workup type found for sample"}
                        { atId ?
                            <a href={atId} data-tip={workup_type ? null: "View Sample"} className={`name-title p-1`}>
                                { workup_type || accession }
                            </a> : <span className="name-title p-1">{ workup_type || accession }</span>}
                    </StackedBlockName>
                }

                <StackedBlockList className="report" title="Report">
                    { reportBlocks ? reportBlocks : FamilyAccessionStackedTable.renderEmptyBlock("report") }
                </StackedBlockList>
            </StackedBlock>
        );
    }

    renderIndividualBlock(individual, role, familyId, sex) {
        // Break out useful values from result and family; used in determining whether the passed in individual === the result case individual
        const { result = null, family = null } = this.props;
        const { analysis_groups: analysisGroups = [] } = family || {};

        const { "@id": resultCaseAtId = null, individual: resultIndividual = null, report: resultReport = null, sample: resultSample = null } = result || {};
        const { "@id": resultIndvAtId = null } = resultIndividual || {};
        const { "@id": resultReportAtId = null } = resultReport || {};
        const { "@id": resultSampleId = null } = resultSample || {};

        // Passed in Individual
        const { "@id": atId = null, individual_id = null, display_title = null, case: cases = [], accession = null, samples: indvSamples = [] } = individual || {};

        let cls;
        if (result && result.individual && individual) {
            cls = result.individual['@id'] === atId ? "current-case": null;
        }

        const sampleToCaseReportBlockMap = {};

        cases.forEach((currCase) => {
            const { '@id': caseAtId = null, accession: caseAccession = null, case_title = null, sample = null, report = null } = currCase || {};
            const { '@id': sampleAtId = null, accession: sampleAccession = null } = sample || {};
            const { '@id' : reportAtId = null, display_title : reportTitle = null, accession: reportAccession = null } = report || {};

            const isResultCase = caseAtId === resultCaseAtId;

            let analysisType = 'N/A';

            // Search each analysis group for one with the current case to use as title
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
                                    <a href={reportAtId} className={"name-title p-1" + (isResultCase ? " current-case": "")}>
                                        { analysisType }
                                    </a> : <span className={"name-title p-1" + (isResultCase ? " current-case": "")}>{ analysisType }</span>}
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
                                                <td className="accession-table-title">CGAP ID</td>
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

        return (
            <StackedBlock {...{ cls }} hideNameOnHover={false} columnClass="individual"
                key={atId} id={atId}
            >
                <StackedBlockName className="flex-row align-items-center justify-content-between">
                    <div className="d-flex flex-column">
                        { atId ?
                            <a href={atId} className={`name-title p-1 text-capitalize ${(result.individual['@id'] === individual['@id']) ? "current-case" : ""}`}>
                                { role || display_title }
                            </a> : <span className="name-title p-1 text-capitalize">{ role || display_title }</span>}
                        <span className="d-block text-small">({ individual_id ? individual_id : (display_title !== accession) ? display_title : "N/A" })</span>
                    </div>
                    <div className="w-100" style={{ maxWidth: "70%" }}>
                        <table className="accession-table w-100">
                            <tbody>
                                <tr>
                                    <td className="accession-table-title">CGAP ID</td>
                                    <td>{ accession || "" }</td>
                                </tr>
                                <tr>
                                    <td className="accession-table-title">Family ID</td>
                                    <td>{ familyId || "N/A" }</td>
                                </tr>
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
        const { members = [], proband = null, relationships = [], accession: familyId = null } = family || {};

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
            return this.renderIndividualBlock(familyMember, currRelationship || currId , familyId, currSex || null );
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

