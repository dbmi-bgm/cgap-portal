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
            <div className="home-dashboard-area bg-light py-5" id="content">
                <div className="container">

                    <div className="card">
                        <h3 className="card-header text-400 my-0">
                            Actions
                        </h3>
                        <div className="card-body pb-0">
                            <p>
                                {"We might create a set of mini-dashboards like \"Recent Cases\" below and then display & order them based on user role,\
                                permissions, & similar."}
                            </p>

                            <div className="row">
                                <div className="col-xs-12 col-md-6 col-lg-4">
                                    <a className="btn btn-primary btn-block btn-lg mb-2" href="/search/?type=Case&currentAction=add">New Case</a>
                                </div>
                                <div className="col-xs-12 col-md-6 col-lg-4">
                                    <a className="btn btn-primary btn-block btn-lg mb-2 disabled" href="#" >Pipeline Admin</a>
                                </div>
                                <div className="col-xs-12 col-md-6 col-lg-4">
                                    <a className="btn btn-primary btn-block btn-lg mb-2 disabled" href="#">Quality Controls</a>
                                </div>
                                <div className="col-xs-12 col-md-6 col-lg-4">
                                    <a className="btn btn-primary btn-block btn-lg mb-2 disabled" href="#">Curation</a>
                                </div>
                                <div className="col-xs-12 col-md-6 col-lg-4">
                                    <a className="btn btn-primary btn-block btn-lg mb-2 disabled" href="#">Crowdsourcing</a>
                                </div>
                                <div className="col-xs-12 col-md-6 col-lg-4">
                                    <a className="btn btn-primary btn-block btn-lg mb-2" href="/search/?type=Item">Clinical Reports</a>
                                </div>
                            </div>

                        </div>

                    </div>

                    <RecentCasesSection userUUID={userUUID} key={userUUID} />

                </div>
            </div>
        </React.Fragment>
    );
});


class RecentCasesSection extends React.PureComponent {

    constructor(props){
        super(props);
        this.toggleCasesWithReports = this.toggleCasesWithReports.bind(this);
        this.state = {
            project_roles: null, // 'null' will indicate loading, also. While empty arr is lack/failed.
            projectsWithAllCases : {
                // Lack of presence here means only Cases with reports will be shown for this project.
                // Unless toggled later. Keyed by project name (uniqueKey).
            }
        };
    }

    componentDidMount(){
        const { userUUID } = this.props;
        const cb = (resp) => {
            const { project_roles = [] } = resp;
            this.setState({ project_roles });
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
        if (project_roles === null) {
            return (
                <div className="py-3 text-center">
                    <h3><i className="icon icon-spin fas icon-circle-notch"/></h3>
                </div>
            );
        }

        if (project_roles.length === 0) {
            return null;
        }

        const tableSections = project_roles.map(({ role, project })=>{
            const { name: projectName, '@id' : projectID, display_title: projectTitle } = project;
            const onCasesWithReportsToggle = (e) => this.toggleCasesWithReports(projectName);
            const casesWithReportsOnly = !projectsWithAllCases[projectName];
            const allCasesHref = "/search/?type=Case&project.name=" + encodeURIComponent(projectName);
            const searchHrefFull = allCasesHref + (casesWithReportsOnly ? "&report.uuid!=No+value" : "");
            return (
                <div className="recent-cases-table-section mt-36 mb-36" data-project={projectName} key={projectName}>
                    <div className="d-flex align-items-center mb-1">
                        <h4 className="text-400 flex-fill mb-0 mt-0">
                            <span className="text-300 mr-06">Recent Cases from</span>
                            <a href={allCasesHref} data-tip="View all Cases for this Project.">{ projectTitle }</a>
                        </h4>
                        <div className="toggle-reports">
                            <Checkbox onChange={onCasesWithReportsToggle} checked={casesWithReportsOnly} labelClassName="mb-0 text-400 text-small">
                                Show Cases with Reports Only
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
