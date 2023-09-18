'use strict';

import React, { useMemo, useCallback } from 'react';
import _ from 'underscore';

import Dropdown from 'react-bootstrap/esm/Dropdown';
import DropdownButton from 'react-bootstrap/esm/DropdownButton';
import DropdownItem from 'react-bootstrap/esm/DropdownItem';

import { console, ajax, JWT, searchFilters } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Checkbox } from '@hms-dbmi-bgm/shared-portal-components/es/components/forms/components/Checkbox';

import { Term } from './../../util/Schemas';
import { responsiveGridState } from './../../util/layout';
import { SearchBar } from './../../browse/SearchBar';
import { AboveTableControlsBaseCGAP } from './../../browse/AboveTableControlsBaseCGAP';

import { EmbeddedCaseSearchTable } from './../../item-pages/components/EmbeddedItemSearchTable';
import FeedbackButton from '../../item-pages/components/FeedbackButton';


export const UserDashboard = React.memo(function UserDashboard({ windowHeight, windowWidth }){
    // const { schemas } = props;
    // We can turn container into container-wide to expand width
    // We can convert dashboard-header into tabs, similar to Item pages.
    // We can do novel stuff like sidebar menu or something.
    // Various options.

    // Since UserDashboard visible, we assume user is logged in.
    // We use email as unique component key for components
    // which need to make AJAX requests. This way we can just
    // re-initialize component upon 'Impersonate User' action
    // insteat of handling w. componentDidUpdate or similar.
    // const { uuid: userUUID = null } = JWT.getUserDetails() || {};

    return (
        <React.Fragment>

            <div className="dashboard-header">
                <div className="container-wide d-flex align-items-center justify-content-between">
                    <div className="align-items-center d-flex">
                        <i className="icon icon-fw icon-home fas mr-1" />
                        <h5 className="mt-0 mb-0 text-400">Home Dashboard</h5>
                    </div>
                </div>
            </div>

            {/* We apply .bg-light class here instead of .container-wide child divs because home-dashboard-area height is calculated off of window height in stylesheet */}
            <div className="home-dashboard-area bg-light" id="content">
                <RecentCasesTable {...{ windowHeight, windowWidth }} />
            </div>
        </React.Fragment>
    );
});


const RecentCasesTable = React.memo(function RecentCasesTable({ windowHeight, windowWidth }){
    const searchHref = (
        "/search/?type=Case"
        + "&proband_case=true"
        + "&status!=inactive"
        + "&sort=-last_modified.date_modified"
    );

    const maxHeight = typeof windowHeight === "number" ?
        (
            windowHeight
            - (80 + 46 + 78 + 52 + 20 + 50) // Sum of all footer/header elem heights & margins (excl. checkboxes)
            - (responsiveGridState(windowWidth) !== "xs" ? 53 : 106) // Height of checkboxes
        )
        : 400;

    // const aboveTableComponent = (
    //     <AboveTableControlsBase
    //         panelMap={AboveTableControlsBase.getCustomColumnSelectorPanelMapDefinition(this.props)}>
    //             test
    //     </AboveTableControlsBase>
    // );

    return (
        <div className="recent-cases-table-section mb-36">
            <EmbeddedCaseSearchTable {...{ searchHref, maxHeight }} embeddedTableHeader={<AboveCasesTableOptions />}
                hideFacets={["project.display_title", "report.uuid", "proband_case"]} stickyFirstColumn />
        </div>
    );
});

const AboveCasesTableOptions = React.memo(function AboveCasesTableOptions(props){
    const {
        context,
        onFilter, isContextLoading, navigate,
        sortBy, sortColumns,
        hiddenColumns, addHiddenColumn, removeHiddenColumn, columnDefinitions
    } = props;
    const { filters: ctxFilters = null } = context || {};

    const { onlyShowCasesWithReports, onlyShowProbandCases } = useMemo(function(){
        return {
            onlyShowCasesWithReports: ctxFilters === null ? true : !!(_.findWhere(ctxFilters, { "field" : "report.uuid!", "term" : "No value" })),
            onlyShowProbandCases: ctxFilters === null ? true : !!(_.findWhere(ctxFilters, { "field" : "proband_case", "term" : "true" }))
        };
    }, [ ctxFilters ]);

    const { onToggleOnlyShowCasesWithReports, onToggleOnlyShowProbandCases } = useMemo(function(){
        return {
            onToggleOnlyShowCasesWithReports: function(){ onFilter({ "field" : "report.uuid!" }, { "key": "No value" }); },
            onToggleOnlyShowProbandCases: function(){ onFilter({ "field" : "proband_case" }, { "key": "true" }); }
        };
    }, []);

    return (
        <React.Fragment>

            <div className="container-wide py-0 bg-white">
                <div className="tab-section-title flex-wrap">

                    <div className="d-flex align-items-center">
                        <h3 className="text-400 my-0 d-none d-sm-block">
                            Recent Cases&nbsp;
                            <span className="text-300">from&nbsp;</span>
                        </h3>
                        <div className="px-1">
                            <ProjectSelectDropdown {...{ context, onFilter, isContextLoading, navigate }} />
                        </div>
                    </div>

                    <DropdownButton variant="primary d-flex align-items-center" id="submit-new" className="px-1"
                        title={<React.Fragment><i className="icon fas icon-plus mr-1"/>Submit New...</React.Fragment>}>
                        <Dropdown.Item href="/search/?type=IngestionSubmission&currentAction=add">
                            Case
                        </Dropdown.Item>
                        <Dropdown.Item href="/search/?type=IngestionSubmission&currentAction=add&submissionType=Family History">
                            Family History
                        </Dropdown.Item>
                        <Dropdown.Item href="/search/?type=IngestionSubmission&currentAction=add&submissionType=Gene List">
                            Gene List
                        </Dropdown.Item>
                    </DropdownButton>

                </div>
            </div>

            <hr className="tab-section-title-horiz-divider"/>

            <div className="container-wide toggle-reports">

                <AboveTableControlsBaseCGAP {...{ hiddenColumns, addHiddenColumn, removeHiddenColumn, columnDefinitions, sortBy, sortColumns }}>
                    <div className="col-12 col-lg-4 py-2">
                        <SearchBar {...{ isContextLoading, context, navigate }} />
                    </div>
                    <div className="d-none d-md-block col">
                        &nbsp;
                    </div>
                    <div className="col-12 col-md-auto">
                        <ProjectFilterCheckbox isContextLoading={isContextLoading || !context} onChange={onToggleOnlyShowCasesWithReports} checked={onlyShowCasesWithReports}>
                            Show Only Cases with Reports
                        </ProjectFilterCheckbox>
                    </div>
                    <div className="col-12 col-md-auto pb-08 pb-md-0">
                        <ProjectFilterCheckbox isContextLoading={isContextLoading || !context} onChange={onToggleOnlyShowProbandCases} checked={onlyShowProbandCases}>
                            Show Only Proband Cases
                        </ProjectFilterCheckbox>
                    </div>
                </AboveTableControlsBaseCGAP>

            </div>
        </React.Fragment>
    );
});


class ProjectFilterCheckbox extends React.PureComponent {

    constructor(props){
        super(props);
        this.onChange = _.throttle(this.onChange.bind(this), 500, { trailing: false });
        this.state = { "isChanging": false };
    }

    componentDidUpdate({ isContextLoading: pastLoading }){
        const { isContextLoading } = this.props;
        if (!isContextLoading && pastLoading) {
            this.setState({ "isChanging" : false });
        }
    }

    onChange(e){
        e.stopPropagation();
        const { onChange } = this.props;
        this.setState({ "isChanging": true }, () => {
            onChange();
        });
    }

    render(){
        const { isContextLoading, checked, children } = this.props;
        const { isChanging } = this.state;
        const labelCls = "mb-0 px-2 py-1" + (isChanging ? " is-changing" : "");
        return (
            <Checkbox disabled={isContextLoading} onChange={this.onChange} checked={checked} labelClassName={labelCls}>
                <span className="text-small">
                    { isChanging ? <i className="icon icon-circle-notch icon-spin fas mr-07 text-small" /> : null }
                    { children }
                </span>
            </Checkbox>
        );
    }
}


function ProjectSelectDropdown(props){
    const {
        context: searchContext,
        navigate: virtualNavigate,
        onFilter,
        isContextLoading = false,
        className
    } = props;
    const {
        facets: ctxFacets = [],
        filters: ctxFilters,
        "@id": ctxHref
    } = searchContext || {};

    const { projectFacet, projectFilter } = useMemo(function(){
        return {
            projectFacet: _.findWhere(ctxFacets, { "field" : "project.display_title" }) || null,
            projectFilter: _.findWhere(ctxFilters, { "field" : "project.display_title" }) || null
        };
    }, [ searchContext ]);

    const { term: projectFilterTerm = null } = projectFilter || {};
    const { terms: facetTerms = [] } = projectFacet || {};

    const onTermSelect = useCallback(function(evtKey, e){
        e.preventDefault();
        if (!evtKey) {
            if (projectFilter) {
                // Un-toggle
                onFilter(projectFacet, { key: projectFilter.term });
            }
        } else {
            if (!projectFilter || evtKey === projectFilterTerm) {
                // Single toggle request
                onFilter(projectFacet, { key: evtKey });
                return;
            }

            let updatedFilters = searchFilters.contextFiltersToExpSetFilters(ctxFilters, { "type" : true });
            // Unset existing first, then set new project filter, then perform virtual nav request.
            updatedFilters = searchFilters.changeFilter("project.display_title", projectFilterTerm, updatedFilters, null, true);
            updatedFilters = searchFilters.changeFilter("project.display_title", evtKey, updatedFilters, null, true);
            const updatedSearchHref = searchFilters.filtersToHref(updatedFilters, ctxHref, null, false, null);
            virtualNavigate(updatedSearchHref);
        }
    }, [ onFilter, projectFilter, projectFacet ]);

    const renderedOptions = useMemo(function(){
        let options = null;
        if (!isContextLoading) {
            options = facetTerms.sort(function({ key: a, doc_count: aDC }, { key: b, doc_count: bDC }){
                if (a === "CGAP Core") return -1;
                if (b === "CGAP Core") return 1;
                return bDC - aDC;
            }).map(function(projectTermObj){
                const { key: projectTerm, doc_count } = projectTermObj;
                const active = projectTerm === projectFilterTerm;
                return (
                    <DropdownItem key={projectTerm} eventKey={projectTerm} active={active}>
                        { Term.toName("project.display_title", projectTerm) }
                        <small className="ml-07">({ doc_count })</small>
                    </DropdownItem>
                );
            });
        }
        return options;
    }, [ isContextLoading, facetTerms ]);

    return (
        <DropdownButton disabled={isContextLoading || facetTerms.length === 0}
            title={projectFilterTerm || "All Projects"} onSelect={onTermSelect}
            variant="outline-dark" className={className}>
            <DropdownItem eventKey={null} active={!projectFilterTerm}>
                <span className="text-600">All Projects</span>
            </DropdownItem>
            { renderedOptions }
        </DropdownButton>
    );

}
