import React, { useState, useMemo, useCallback, useEffect, useContext } from 'react';
import PropTypes from 'prop-types';
import _, { sample } from 'underscore';

import {
    StackedBlock,
    StackedBlockList,
    StackedBlockName,
    StackedBlockNameLabel,
    StackedBlockTable
} from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/StackedBlockTable';
import { PartialList } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/PartialList';


export const SomaticAccessioningTab = React.memo(function AccessioningTab(props) {
    const { context = null, href } = props;
    const { samples = [], individual = {} } = context || {};

    return (
        <React.Fragment>
            <h1 className="row align-items-center">
                <div className="col">
                    <span className="text-300">Accessioning History</span>
                </div>
            </h1>
            <div className="tab-inner-container card">
                <div className="card-body">
                    <PartialList className="mb-0" open
                        persistent={[
                            <div key="somatic-accessioning" className="primary-family">
                                <SomaticAccessionStackedTable
                                    {...{ individual, samples }}
                                    fadeIn collapseLongLists collapseShow={1} />
                            </div>
                        ]} />
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
class SomaticAccessionStackedTable extends React.PureComponent {

    // Keeping these builtInHeaders separate in case we want to build in custom columns later
    static builtInHeaders = [
        { columnClass: 'individual',    title: 'Individual',            initialWidth: 220   },
        { columnClass: 'libraries',     title: 'Sequencing',            initialWidth: 220   },
    ];

    /* Built-in headers */
    static staticColumnHeaders(columnHeaders){
        return SomaticAccessionStackedTable.builtInHeaders.map(function(staticCol){
            const foundColumnFromParamHeaders = _.findWhere(columnHeaders, { 'title' : staticCol.title });
            return { ...staticCol, ...(foundColumnFromParamHeaders || {}) };
        });
    }

    static propTypes = {
        'columnHeaders'             : PropTypes.array,
        'individual'                : PropTypes.object.isRequired,
        'samples'                   : PropTypes.arrayOf(PropTypes.object).isRequired,
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
    }

    /**
     * Renders a sample block, and nested blocks for the reports/cases that use the current sample
     * @param {object} sample       A single sample item/object
     * @param {array} reportBlocks  An array of pre-defined JSX elements containing markup
     *                              for report/case blocks that use the current sample
     *                              (logic for determining what blocks to map to what samples
     *                              is located in this.renderIndividualBlock)
     */
    renderSampleBlock(sample, isLastSample){
        const { '@id': atId = null, workup_type = null, accession = null } = sample;

        const sampleAccessionTable = createSampleAccessioningTable(sample);

        return (
            <StackedBlock className={!isLastSample ? " border-bottom": ""} columnClass="libraries" hideNameOnHover={false} key={atId} id={atId}>
                { atId && workup_type ?
                    <StackedBlockName className="flex-row align-items-center justify-content-between">
                        <div className="d-flex">
                            <a href={atId} data-tip="View Sample" className="name-title">
                                { workup_type }
                            </a>
                        </div>
                        { sampleAccessionTable }
                    </StackedBlockName>:
                    <StackedBlockName>
                        { workup_type ? null : "No workup type found for sample"}
                        { atId ?
                            <a href={atId} data-tip={workup_type ? null: "View Sample"} className="name-title">
                                { workup_type || accession }
                            </a> : <span className="name-title">{ workup_type || accession }</span>}
                    </StackedBlockName>
                }
            </StackedBlock>
        );
    }

    /**
     * Renders a row for an individual, and then its nested sample and case/report blocks.
     * @param {object} individual       The current row's individual item object
     */
    renderIndividualBlock() {
        const { individual, samples = [] } = this.props;
        const {
            "@id": atId = null,
            individual_id = null,
            display_title = null,
            accession = null,
            families: {
                0: {
                    family_id: familyId = null,
                    accession: familyAccession = null
                } = {}
            } = [],
        } = individual || {};

        return ( // We can pass 'className={..}' to this if needed.
            <StackedBlock hideNameOnHover={false} columnClass="individual" key={atId} id={atId}>
                <StackedBlockName className="flex-row align-items-center justify-content-between">
                    <div className="d-flex flex-column individual-role pe-2">
                        { atId &&
                            <a href={atId} className="name-title mx-0 text-truncate text-capitalize current-case">
                                Individual
                            </a>
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
                    { samples.map((thisSample, i) => this.renderSampleBlock(thisSample, i === samples.length-1))}
                </StackedBlockList>
            </StackedBlock>
        );
    }


    /**
     * Here we render nested divs for a 'table' of experiments with shared elements spanning multiple rows,
     * e.g. Individual's height is the combined height of its containing sample rows.
     *  _______________________________________________________
     * |                                     |
     * |             Sequencing Libraries    |
     * |                                     |
     * | Individual  ________________________|
     * |                                     |
     * |             Sequencing Libraries    |
     * |                                     |
     * |_____________________________________|
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
            preventExpand,
        } = this.props;
        const columnHeaders = SomaticAccessionStackedTable.staticColumnHeaders(propColHeaders, showMetricsColumns);
        const cls = "stacked-block-table-outer-container overflow-auto" + (cls ? " " + cls : "");
        return (
            <div className={cls}>
                <StackedBlockTable {...{ columnHeaders, width, preventExpand, collapseShow }} stackDepth={0}
                    fadeIn allFiles={[]} collapseLongLists={true} defaultCollapsed={true}
                    handleFileCheckboxChange={this.handleFileCheckboxChange}>
                    { this.renderIndividualBlock() }
                </StackedBlockTable>
            </div>
        );
    }
}



function createSampleAccessioningTable(sample) {
    const {
        accession = null, // Should always be present
        specimen_collection_date = null,
        specimen_type = null,
        sequence_id = null,
        bam_sample_id = null,
        preservation_type = null, // TODO: Not currently present
        tissue_type = null // TODO: Need to figure out if this is right field?
    } = sample || {};

    return (
        <div className="w-100" style={{ maxWidth: "70%" }}>
            <div className="accession-table w-100">
                { bam_sample_id &&
                    <div className="row justify-content-between">
                        <div className="col accession-table-title">BAM Sample ID</div>
                        <div className="col-auto text-truncate">{ bam_sample_id }</div>
                    </div> }
                { sequence_id &&
                    <div className="row justify-content-between">
                        <div className="col-auto accession-table-title">Sequence ID</div>
                        <div className="col-auto text-truncate">{ sequence_id }</div>
                    </div> }
                <div className="row justify-content-between">
                    <div className="col accession-table-title">CGAP Sample ID</div>
                    <div className="col-auto text-truncate">{ accession }</div>
                </div>
            </div>
            <br/>
            <div className="accession-table w-100">
                { tissue_type &&
                    <div className="row justify-content-between">
                        <div className="col accession-table-title">Sample Type</div>
                        <div className="col-auto text-truncate">{ tissue_type }</div>
                    </div> }
                <div className="row justify-content-between">
                    <div className="col accession-table-title">Preservation Type</div>
                    <div className="col-auto text-truncate">{ preservation_type || "-" }</div>
                </div>
                { specimen_type &&
                    <div className="row justify-content-between">
                        <div className="col accession-table-title">Specimen Type</div>
                        <div className="col-auto text-truncate">{ specimen_type }</div>
                    </div> }
                { specimen_collection_date &&
                    <div className="row justify-content-between">
                        <div className="col accession-table-title">Collected</div>
                        <div className="col-auto text-truncate">{ specimen_collection_date }</div>
                    </div> }
            </div>
        </div>
    );
}