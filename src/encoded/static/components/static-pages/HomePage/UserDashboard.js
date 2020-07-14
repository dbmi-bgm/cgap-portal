'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';
import ReactTooltip from 'react-tooltip';
import _ from 'underscore';

import { console, ajax, JWT } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { LocalizedTime } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/LocalizedTime';
import { Schemas } from './../../util';

import { EmbeddedCaseSearchTable } from './../../item-pages/components/EmbeddedItemSearchTable';


export const UserDashboard = React.memo(function UserDashboard(props){
    // We can turn container into container-wide to expand width
    // We can convert dashboard-header into tabs, similar to Item pages.
    // We can do novel stuff like sidebar menu or something.
    // Various options.
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

                    <RecentCasesSection />

                </div>
            </div>
        </React.Fragment>
    );
});


function RecentCasesSection (props) {
    // We don't memoize this, can change on each run if User is being
    // impersonated. We memoize stuff downstream from here, though.
    const userDetails = JWT.getUserDetails();
    const { project_roles = [] } = userDetails || {};

    if (project_roles.length === 0) {
        // Show single table of all cases available.
        return (
            <div className="recent-cases-table-section mt-36">
                <h3 className="text-400">Recent Cases</h3>
                <EmbeddedCaseSearchTable facets={null} searchHref="/search/?type=Case" />
            </div>
        );
    }

    const tableSections = project_roles.map(function({ role, project }){
        const { name: projectName, '@id' : projectID, display_title: projectTitle } = project;

        return (
            <div className="recent-cases-table-section mt-36" data-project={projectName} key={projectName}>
                <h3 className="text-400">
                    <span className="text-300 mr-06">Recent Cases from</span>
                    <a href={projectID}>{ projectTitle }</a>
                </h3>
                <EmbeddedCaseSearchTable facets={null} searchHref="/search/?type=Case" />
            </div>
        );

    });

    return tableSections;
}
