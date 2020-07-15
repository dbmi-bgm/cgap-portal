'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';
import ReactTooltip from 'react-tooltip';
import _ from 'underscore';

import { console, ajax, JWT } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { LocalizedTime } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/LocalizedTime';
import { Checkbox } from '@hms-dbmi-bgm/shared-portal-components/es/components/forms/components/Checkbox';
import { Schemas } from './../../util';

import { EmbeddedCaseSearchTable } from './../../item-pages/components/EmbeddedItemSearchTable';


export const UserDashboard = React.memo(function UserDashboard(props){
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
                    <RecentCasesTables userUUID={userUUID} key={userUUID} />
                </div>

            </div>
        </React.Fragment>
    );
});


class RecentCasesTables extends React.PureComponent {

    constructor(props){
        super(props);
        this.toggleCasesWithReportsByProject = {}; // Dictionary of methods bound to this + [projectName], filled on User load.
        this.state = {
            project_roles: null, // 'null' will indicate loading, also. While empty arr is lack/failed.
            projectsWithAllCases : {
                // Lack of presence here means only Cases with reports will be shown for this project.
                // Unless toggled later. Keyed by project `name` (uniqueKey) - if "name" field changed or removed, should change to `@id`.
            }
        };
    }

    componentDidMount(){
        const { userUUID } = this.props;
        const cb = (resp) => {
            const { project_roles = [] } = resp;
            const projectsWithAllCases = {};
            project_roles.forEach(({ project : { name: projectName } }) => {
                projectsWithAllCases[projectName] = false;
                this.toggleCasesWithReportsByProject[projectName] = this.toggleCasesWithReports.bind(this, projectName);
            });
            this.setState({ project_roles, projectsWithAllCases });
        };
        ajax.load("/users/" + userUUID, cb, 'GET', cb);
    }

    toggleCasesWithReports(projectName){
        this.setState(function({ projectsWithAllCases: existingStateMap }){
            const projectsWithAllCases = {
                ...existingStateMap,
                [projectName]: !existingStateMap[projectName]
            };
            return { projectsWithAllCases };
        });
    }

    render(){
        const { project_roles, projectsWithAllCases } = this.state;
        if (project_roles === null) { // == Still loading
            // Eventually we could make cool graphic/CSS-animation of DNA strand pulsing or something... hmmm
            return (
                <div className="py-3 text-center">
                    <h3 className="bg-transparent spinner-grow" role="status">
                        <i className="icon fas icon-dna"/>
                        <span className="sr-only">Loading...</span>
                    </h3>
                </div>
            );
        }

        if (project_roles.length === 0) {
            return null;
        }

        const tableSections = project_roles.map(({ role, project })=>{
            const { name: projectName, '@id' : projectID, display_title: projectTitle } = project;
            const casesWithReportsOnly = !projectsWithAllCases[projectName];
            const allCasesHref = "/search/?type=Case&project.name=" + encodeURIComponent(projectName);
            const searchHrefFull = allCasesHref + (casesWithReportsOnly ? "&report.uuid!=No+value" : "");
            const titleTipName = projectName === projectTitle ? projectTitle : `${projectTitle} (${projectName})`;
            const titleTip = "View all Cases from " + titleTipName + "<br/><label class='mb-0'>Role:</label> " + role;
            return (
                <div className="recent-cases-table-section mt-12 mb-36" data-project={projectName} key={projectName}>
                    <div className="d-flex align-items-center mb-1">
                        <h4 className="text-400 flex-fill mb-0 mt-0">
                            <a href={allCasesHref} data-tip={titleTip} data-html data-place="right">{ projectTitle }</a>
                        </h4>
                        <div className="toggle-reports">
                            <Checkbox onChange={this.toggleCasesWithReportsByProject[projectName]} checked={casesWithReportsOnly} labelClassName="mb-0 text-400 text-small">
                                Show Only Cases with Reports
                            </Checkbox>
                        </div>
                    </div>
                    <EmbeddedCaseSearchTable facets={null} searchHref={searchHrefFull} />
                </div>
            );

        });

        return tableSections;
    }

}
