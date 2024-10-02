'use strict';

import React, { useState } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';

import { PartialList } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/PartialList';
import { StackedBlock, StackedBlockList, StackedBlockName, StackedBlockNameLabel, StackedBlockTable } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/StackedBlockTable';


export const AccessioningTab = React.memo(function AccessioningTab(props) {
    const { context, canonicalFamily, secondaryFamilies = [] } = props;
    const { display_title: primaryFamilyTitle, '@id': canonicalFamilyAtID } = canonicalFamily;
    const [isSecondaryFamiliesOpen, setSecondaryFamiliesOpen] = useState(false);
    const secondaryFamiliesLen = secondaryFamilies.length;

    const viewSecondaryFamiliesBtn = secondaryFamiliesLen === 0 ? null : (
        <div className="pt-2">
            <button
                type="button"
                className="btn btn-block btn-outline-dark"
                onClick={
                    function () {
                        setSecondaryFamiliesOpen(function (currentIsSecondaryFamiliesOpen) {
                            return !currentIsSecondaryFamiliesOpen;
                        });
                    }}>
                {!isSecondaryFamiliesOpen ? `Show ${secondaryFamiliesLen} more famil${secondaryFamiliesLen > 1 ? 'ies' : 'y'} that proband is member of` : 'Hide secondary families'}
            </button>
        </div>
    );

    // Using PartialList since we have it already, it hides DOM elements when collapsed.
    // In long run maybe a differing UI might be better, idk.
    return (
        <React.Fragment>
            <h1 className="row align-items-center">
                <div className="col">
                    <span className="text-300">Accessioning Report and History</span>
                </div>
                <div className="col-auto">
                    <span className="current-case text-small text-400 m-0">Current Selection</span>
                </div>
            </h1>
            <div className="tab-inner-container card">
                <div className="card-body">
                    <PartialList className="mb-0" open={isSecondaryFamiliesOpen}
                        persistent={[
                            <div key={canonicalFamilyAtID} className="primary-family">
                                <h4 className="mt-0 mb-16 text-400">
                                    <span className="text-300">Primary Cases from </span>
                                    {primaryFamilyTitle}
                                </h4>
                                <FamilyAccessionStackedTable family={canonicalFamily} result={context}
                                    fadeIn collapseLongLists collapseShow={1} />
                            </div>
                        ]}
                        collapsible={!isSecondaryFamiliesOpen ? null :
                            secondaryFamilies.map(function (family) {
                                const { display_title, '@id': familyID } = family;
                                return (
                                    <div className="py-4 secondary-family" key={familyID}>
                                        <h4 className="mt-0 mb-05 text-400">
                                            <span className="text-300">Related Cases from </span>
                                            {display_title}
                                        </h4>
                                        <FamilyAccessionStackedTable result={context} family={family} collapseLongLists />
                                    </div>
                                );
                            })
                        } />
                    {viewSecondaryFamiliesBtn}
                </div>
            </div>
        </React.Fragment>
    );
});



/**
 * Takes in the current case item ('result' prop) and a single family associated with said case
 * and renders a table containing all of the accessions/various IDs for each individual, sample,
 * and report/case in that family. Current case is highlighted throughout the table, and results
 * are sorted by individual (first proband, then individuals with samples, then the rest).
 */
class FamilyAccessionStackedTable extends React.PureComponent {

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
                    <div className="d-flex flex-column individual-role pe-2">
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
