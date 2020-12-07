'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';
import ReactTooltip from 'react-tooltip';
import memoize from 'memoize-one';
import _ from 'underscore';

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
                    <RecentCasesTable {...{ schemas }} />
                </div>

            </div>
        </React.Fragment>
    );
});


/** Used a 'classical' component here since harder to throttle state-changing funcs in functional components */
class RecentCasesTable extends React.PureComponent {

    static getHideFacets(schemas){
        if (!schemas) return null;
        const { Case : { facets: schemaFacets } } = schemas;
        const hideFacets = Object.keys(schemaFacets || {}).filter(function(facetKey){
            if (facetKey === "project.display_title") {
                return false; // Filter out of hideFacets
            }
            const { default_hidden = false } = schemaFacets[facetKey];
            if (default_hidden) {
                return false; // Filter out of hideFacets since hidden anyways
            }
            return true;
        });
        hideFacets.push("report.uuid");
        hideFacets.push("validation_errors.name");
        return hideFacets;
    }

    constructor(props){
        super(props);
        this.onToggleOnlyShowCasesWithReports = _.throttle(this.onToggleOnlyShowCasesWithReports.bind(this), 500, { trailing: false });
        this.state = {
            "onlyShowCasesWithReports": true
        };
        this.memoized = {
            getHideFacets: memoize(RecentCasesTable.getHideFacets)
        };
    }

    onToggleOnlyShowCasesWithReports(e){
        this.setState(function({ onlyShowCasesWithReports: pastShow }){
            return { onlyShowCasesWithReports: !pastShow };
        });
    }

    render(){
        const { schemas } = this.props;
        const { onlyShowCasesWithReports } = this.state;
        const allCasesHref = "/search/?type=Case";
        const searchHref = (
            allCasesHref
            + (onlyShowCasesWithReports ? "&report.uuid!=No+value" : "")
            + "&sort=-last_modified.date_modified"
        );
        const hideFacets = this.memoized.getHideFacets(schemas);
        return (
            <div className="recent-cases-table-section mt-12 mb-36">
                <div className="toggle-reports mb-1">
                    <Checkbox onChange={this.onToggleOnlyShowCasesWithReports} checked={onlyShowCasesWithReports} labelClassName="mb-0 text-400 text-small">
                        Show Only Cases with Reports
                    </Checkbox>
                </div>
                <EmbeddedCaseSearchTable {...{ searchHref, hideFacets }} />
            </div>
        );
    }

}
