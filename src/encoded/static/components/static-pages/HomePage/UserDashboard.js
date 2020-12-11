'use strict';

import React from 'react';
import _ from 'underscore';

import DropdownButton from 'react-bootstrap/esm/DropdownButton';
import DropdownItem from 'react-bootstrap/esm/DropdownItem';

import { console, ajax, JWT, searchFilters } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Checkbox } from '@hms-dbmi-bgm/shared-portal-components/es/components/forms/components/Checkbox';
import { Schemas } from './../../util';

import { EmbeddedCaseSearchTable } from './../../item-pages/components/EmbeddedItemSearchTable';


export const UserDashboard = React.memo(function UserDashboard(props){
    const { schemas } = props;
    // We can turn container into container-wide to expand width
    // We can convert dashboard-header into tabs, similar to Item pages.
    // We can do novel stuff like sidebar menu or something.
    // Various options.

    // Since UserDashboard visible, we assume user is logged in.
    // We use email as unique component key for components
    // which need to make AJAX requests. This way we can just
    // re-initialize component upon 'Impersonate User' action
    // insteat of handling w. componentDidUpdate or similar.
    const { uuid: userUUID = null } = JWT.getUserDetails() || {};

    return (
        <React.Fragment>

            <div className="dashboard-header">
                <div className="container-wide d-flex align-items-center">
                    <i className="icon icon-fw icon-home fas mr-1" />
                    <h5 className="mt-0 mb-0 text-400">Home Dashboard</h5>
                </div>
            </div>

            {/* We apply .bg-light class here instead of .container-wide child divs because home-dashboard-area height is calculated off of window height in stylesheet */}
            <div className="home-dashboard-area bg-light" id="content">

                <RecentCasesTable />

            </div>
        </React.Fragment>
    );
});


/** Used a 'classical' component here since harder to throttle state-changing funcs in functional components */
class RecentCasesTable extends React.PureComponent {

    constructor(props){
        super(props);
        this.onToggleOnlyShowCasesWithReports = _.throttle(this.onToggleOnlyShowCasesWithReports.bind(this), 500, { trailing: false });
        this.onToggleOnlyShowProbandCases = _.throttle(this.onToggleOnlyShowProbandCases.bind(this), 500, { trailing: false });
        this.state = {
            "onlyShowCasesWithReports": true,
            "onlyShowProbandCases": true
        };
    }

    onToggleOnlyShowCasesWithReports(e){
        e.stopPropagation();
        this.setState(function({ onlyShowCasesWithReports: pastShow }){
            return { onlyShowCasesWithReports: !pastShow };
        });
    }

    onToggleOnlyShowProbandCases(e){
        e.stopPropagation();
        this.setState(function({ onlyShowProbandCases: pastShow }){
            return { onlyShowProbandCases: !pastShow };
        });
    }

    render(){
        const { onlyShowCasesWithReports, onlyShowProbandCases } = this.state;
        const allCasesHref = "/search/?type=Case";
        const searchHref = (
            allCasesHref
            + (onlyShowCasesWithReports ? "&report.uuid!=No+value" : "")
            + (onlyShowProbandCases ? "&proband_case=true" : "")
            + "&sort=-last_modified.date_modified"
        );
        return (
            <div className="recent-cases-table-section mb-36">
                <EmbeddedCaseSearchTable {...{ searchHref }} facets={null}
                    aboveTableComponent={
                        <AboveCasesTableOptions
                            onToggleOnlyShowCasesWithReports={this.onToggleOnlyShowCasesWithReports}
                            onlyShowCasesWithReports={onlyShowCasesWithReports}
                            onToggleOnlyShowProbandCases={this.onToggleOnlyShowProbandCases}
                            onlyShowProbandCases={onlyShowProbandCases}
                        />
                    }
                />
            </div>
        );
    }

}

function AboveCasesTableOptions(props){
    const {
        onToggleOnlyShowCasesWithReports, onlyShowCasesWithReports,
        onToggleOnlyShowProbandCases, onlyShowProbandCases,
        context, onFilter, isContextLoading, navigate
    } = props;

    return (
        <React.Fragment>
            <div className="container-wide py-0 bg-white">
                <div className="tab-section-title">
                    <h3 className="text-400 my-0 d-flex align-items-center">
                        Recent Cases&nbsp;
                        <span className="text-300">from&nbsp;</span>
                        <div className="px-1">
                            <ProjectSelectDropdown {...{ context, onFilter, isContextLoading, navigate }} />
                        </div>
                    </h3>
                    <div className="btn-container">
                        <a className="btn btn-primary btn-block" href="/search/?type=Case&currentAction=add">
                            <i className="icon icon-plus fas mr-07" />
                            New Case
                        </a>
                    </div>
                </div>
            </div>

            <hr className="tab-section-title-horiz-divider"/>
            <div className="container-wide toggle-reports mb-1 mt-12 d-flex align-items-center">
                <Checkbox onChange={onToggleOnlyShowCasesWithReports} checked={onlyShowCasesWithReports} labelClassName="mb-0 text-400 text-small px-2">
                    Show Only Cases with Reports
                </Checkbox>
                <Checkbox onChange={onToggleOnlyShowProbandCases} checked={onlyShowProbandCases} labelClassName="mb-0 text-400 text-small px-2">
                    Show Only Proband Cases
                </Checkbox>
            </div>
        </React.Fragment>
    );
}

function ProjectSelectDropdown(props){
    const {
        context: searchContext,
        navigate: virtualNavigate,
        onFilter,
        isContextLoading = false
    } = props;
    const {
        facets: ctxFacets = [],
        filters: ctxFilters,
        "@id": ctxHref
    } = searchContext || {};
    const projectFacet = _.findWhere(ctxFacets, { "field" : "project.display_title" });
    const projectFilter = _.findWhere(ctxFilters, { "field" : "project.display_title" }) || null;
    const { term: projectFilterTerm = null } = projectFilter || {};
    const { terms: facetTerms = [] } = projectFacet || {};

    function onTermSelect(evtKey, e){
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
    }

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
                    { Schemas.Term.toName("project.display_title", projectTerm) }
                    <small className="ml-07">({ doc_count })</small>
                </DropdownItem>
            );
        });
    }

    return (
        <DropdownButton disabled={isContextLoading || facetTerms.length === 0}
            title={ projectFilterTerm || "All Projects" } onSelect={onTermSelect} variant="outline-dark">
            <DropdownItem eventKey={0} active={!projectFilterTerm}>
                <span className="text-600">All Projects</span>
            </DropdownItem>
            { options }
        </DropdownButton>
    );

}
