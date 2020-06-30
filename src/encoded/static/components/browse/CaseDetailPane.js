'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';

// import { Collapse } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Collapse';
// import { FlexibleDescriptionBox } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/FlexibleDescriptionBox';
import { object, layout } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { StackedBlockTable, StackedBlock, StackedBlockList, StackedBlockName, StackedBlockNameLabel } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/StackedBlockTable';


export class CaseDetailPane extends React.PureComponent {

    static propTypes = {
        'result' : PropTypes.object.isRequired,
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

    render(){
        const { paddingWidthMap, paddingWidth, containerWidth, windowWidth, result, minimumWidth, href } = this.props;

        let usePadWidth = paddingWidth || 0;
        if (paddingWidthMap){
            usePadWidth = paddingWidthMap[layout.responsiveGridState(windowWidth)] || paddingWidth;
        }
        const commonFamilySectionProps = {
            containerWidth, result, href, minimumWidth, paddingWidth: usePadWidth
        };

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
                    {/* Once primary/other family objects added to Case schema, update to use those instead */}
                    { result.sample_processing.families.map((family) => <FamilySection key={family['@id']} {...{ result, family, commonFamilySectionProps }} />)}
                </div>
            </div>
        );
    }

}



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
        const { containerWidth, family, result, href, minimumWidth, paddingWidth } = this.props;
        return (
            <FamilyReportStackedTable
                result={result}
                family={family} href={href} preventExpand
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
        // 'collapseLongLists'         : PropTypes.bool,
        // 'preventExpand'             : PropTypes.bool,
    };

    static defaultProps = {
        // 'fadeIn'        : true,
        'width'         : "100%"
        // 'collapseLongLists' : true,
        // 'showMetricColumns' : null,
        // 'preventExpand'     : false
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

    renderSampleBlock(sample){
        const { result } = this.props;
        const { sample_processing = {} } = result;
        const { '@id': atId = null, workup_type = "-", display_title = null, accession = null } = sample;
        const { samples = [], completed_processes = [] } = sample_processing;

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
                    <StackedBlock columnClass="analysis" hideNameOnHover={false}
                        label={<StackedBlockNameLabel title={null} subtitle={null} accession={null} subtitleVisible/>}>
                        <StackedBlockName>
                            <span className="name-title">{ blockValue }</span>
                        </StackedBlockName>
                        {/* Temporary empty report block - need to update with link to report later */}
                        <StackedBlockList className="report" title="Report">
                            { FamilyReportStackedTable.renderEmptyBlock("report") }
                        </StackedBlockList>
                    </StackedBlock>
                </StackedBlockList>
            </StackedBlock>
        );
    }

    renderIndividualBlock(individual, i, role) {
        const { result } = this.props;
        console.log('this.props.result', result);

        const { "@id": atId = null, display_title = null, accession = null } = individual;

        let cls;
        if (result && result.individual) {
            cls = result.individual['@id'] === individual['@id'] ? "current-case": null;
        }

        return (
            <StackedBlock {...{ cls }} hideNameOnHover={false} columnClass="individual"
                key={atId} id={atId}
                label={
                    <StackedBlockNameLabel title="Accession" accession={accession || display_title} subtitleVisible/>}
            >
                <StackedBlockName>
                    { atId ? <a href={atId} className="name-title">{ role || display_title }</a> : <span className="name-title">{ role || display_title }</span>}
                </StackedBlockName>
                <StackedBlockList className="libraries" title="Libraries">
                    { _.map(individual.samples || [], this.renderSampleBlock) }
                </StackedBlockList>
            </StackedBlock>
        );
    }

    renderIndividualBlockList() {
        const { family = null, collapseLimit = 1, collapseShow = 2, preventExpand = false } = this.props;
        const { members = [], mother = null, father = null, proband = null } = family || {};

        const appendCountStr = members.length <= collapseLimit ? null : ( 'with ' + "#;lp[67gty6" + ' More Individuals ');
        const showMoreExtTitle = (
            <React.Fragment>
                { appendCountStr }
                { preventExpand ? <a href={object.itemUtil.atId(family)}>(view Family)</a> : null }
            </React.Fragment>
        );

        return (
            <StackedBlockList className="individuals" showMoreExtTitle={showMoreExtTitle} title="Individuals">
                { members.map((familyMember, i) => {
                    const currId = familyMember['@id'];
                    switch(currId) {
                        case mother['@id']:
                            return this.renderIndividualBlock(familyMember, i, "Mother");
                        case father['@id']:
                            return this.renderIndividualBlock(familyMember, i, "Father");
                        case proband['@id']:
                            return this.renderIndividualBlock(familyMember, i, "Proband");
                        default:
                            return this.renderIndividualBlock(familyMember, i, null);
                    }
                })}
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
        const { columnHeaders: propColHeaders,
            showMetricsColumns, width, preventExpand = false } = this.props;        
        const columnHeaders = FamilyReportStackedTable.staticColumnHeaders(propColHeaders, showMetricsColumns);
        return (
            <div className="stacked-block-table-outer-container overflow-auto">
                <StackedBlockTable {...{ preventExpand, columnHeaders, width }}
                    fadeIn allFiles={[]} collapseLongLists={true}
                    handleFileCheckboxChange={this.handleFileCheckboxChange}>
                    { this.renderIndividualBlockList()}
                </StackedBlockTable>
            </div>
        );
    }
}
