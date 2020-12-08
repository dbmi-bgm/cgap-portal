'use strict';

import React, { useMemo } from 'react';
import memoize from 'memoize-one';
import _ from 'underscore';

import DropdownButton from 'react-bootstrap/esm/DropdownButton';
import DropdownItem from 'react-bootstrap/esm/DropdownItem';

import { console, ajax, JWT } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { LocalizedTime } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/LocalizedTime';
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

                <div className="container-wide py-0 bg-white">
                    <div className="tab-section-title">
                        <h3 className="text-400 my-0">
                            Recent Cases <span className="text-300">by Project</span>
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

                <div className="container-wide py-2">
                    <RecentCasesTable />
                </div>

            </div>
        </React.Fragment>
    );
});


/** Used a 'classical' component here since harder to throttle state-changing funcs in functional components */
class RecentCasesTable extends React.PureComponent {

    constructor(props){
        super(props);
        this.onToggleOnlyShowCasesWithReports = _.throttle(this.onToggleOnlyShowCasesWithReports.bind(this), 500, { trailing: false });
        this.state = {
            "onlyShowCasesWithReports": true
        };
    }

    onToggleOnlyShowCasesWithReports(e){
        this.setState(function({ onlyShowCasesWithReports: pastShow }){
            return { onlyShowCasesWithReports: !pastShow };
        });
    }

    render(){
        const { onlyShowCasesWithReports } = this.state;
        const allCasesHref = "/search/?type=Case";
        const searchHref = (
            allCasesHref
            + (onlyShowCasesWithReports ? "&report.uuid!=No+value" : "")
            + "&sort=-last_modified.date_modified"
        );
        return (
            <div className="recent-cases-table-section mt-12 mb-36">
                <EmbeddedCaseSearchTable {...{ searchHref }} facets={null}
                    aboveTableComponent={
                        <AboveCasesTableOptions onToggleOnlyShowCasesWithReports={this.onToggleOnlyShowCasesWithReports}
                            onlyShowCasesWithReports={onlyShowCasesWithReports} />
                    }
                />
            </div>
        );
    }

}

function AboveCasesTableOptions(props){
    const {
        onToggleOnlyShowCasesWithReports, onlyShowCasesWithReports,
        context, onFilter, isContextLoading
    } = props;

    return (
        <div className="toggle-reports mb-1 d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-center">
                <div className="pr-1">View cases from</div>
                <ProjectSelectDropdown {...{ context, onFilter, isContextLoading }} />
            </div>
            <Checkbox onChange={onToggleOnlyShowCasesWithReports} checked={onlyShowCasesWithReports} labelClassName="mb-0 text-400 text-small">
                Show Only Cases with Reports
            </Checkbox>
        </div>
    );
}

function ProjectSelectDropdown({ context: searchContext, onFilter, isContextLoading = false }){
    const {
        facets: ctxFacets = [],
        filters: ctxFilters
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
            if (!projectFilter || projectFilter.term !== evtKey) {
                onFilter(projectFacet, { key: evtKey });
            }
        }
    }

    let options = null;
    if (!isContextLoading) {
        options = facetTerms.map(function(projectTermObj){
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
        <DropdownButton disabled={isContextLoading || facetTerms.length === 0} size="sm"
            title={ projectFilterTerm || "All Projects" } onSelect={onTermSelect}>
            <DropdownItem eventKey={0} active={!projectFilterTerm} className="border-bottom">
                <span>All Projects</span>
            </DropdownItem>
            { options }
        </DropdownButton>
    );

}
