'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';
import ReactTooltip from 'react-tooltip';
import _ from 'underscore';

import { console, ajax } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { LocalizedTime } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/LocalizedTime';
import { Schemas } from './../../util';



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
                                {"We might create a set of mini-dashboards like \"Recent Cohorts\" below and then display & order them based on user role,\
                                permissions, & similar."}
                            </p>

                            <div className="row">
                                <div className="col-xs-12 col-md-6 col-lg-4">
                                    <a className="btn btn-primary btn-block btn-lg mb-2" href="/search/?type=Cohort&currentAction=add">New Cohort</a>
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

                    <RecentCohortsCard />

                </div>
            </div>
        </React.Fragment>
    );
});



class RecentCohortsCard extends React.PureComponent {

    static fieldsToRequest = [
        'display_title',
        'last_modified.date_modified',
        'last_modified.modified_by',
        '@id',
        'families.members.@id',
        'status'
    ];

    constructor(props){
        super(props);
        this.state = {
            loading: true,
            cohorts: null,
            cohortsCount: null,
            error: false
        };
    }

    componentDidMount(){

        const cb = (res) => {
            if (res && Array.isArray(res['@graph'])){
                this.setState({
                    loading: false,
                    cohorts: res['@graph'],
                    cohortsCount: res.total
                }, ReactTooltip.rebuild);
                return;
            } else {
                this.setState({ loading: false, error: true });
            }
        };

        const requestHref = (
            "/search/?type=Cohort&limit=50&sort=-last_modified.date_modified&" +
            RecentCohortsCard.fieldsToRequest.map(function(f){ return "field=" + encodeURIComponent(f); }).join('&')
        );

        this.setState({ loading: true }, ()=>{
            ajax.load(requestHref, cb, "GET", cb);
        });
    }

    render(){
        const { cohorts = [], loading, cohortsCount = null } = this.state;

        let innerBody;
        let viewAllCohortsBtn;
        let createCohortBtn;

        if (loading){
            innerBody = (
                <div className="text-center text-larger">
                    <i className="icon icon-fw icon-circle-notch icon-spin fas"/>
                </div>
            );
        } else if (!Array.isArray(cohorts) || cohorts.length === 0){
            innerBody = (
                <div className="text-center text-larger">
                    You currently have no cohorts.
                </div>
            );
        } else {
            const renderedCohorts = cohorts.map(function(item){
                return <CohortListItem item={item} key={item['@id']} />;
            });
            innerBody = <div className="cohort-items">{ renderedCohorts }</div>;
            viewAllCohortsBtn = (
                <a href="/search/?type=Cohort" className="btn btn-outline-dark btn-block">
                    View All { cohortsCount ? <span className="text-300">({ cohortsCount })</span> : null }
                </a>
            );
        }

        return (
            <div className="card mt-5">
                <h3 className="card-header text-400 my-0">
                    Recent Cohorts
                </h3>
                <div className="card-body">
                    <div className="row">
                        <div className="col-12 col-md-4 col-xl-3">
                            { viewAllCohortsBtn }
                            <a href="/search/?type=Cohort&currentAction=add" className="btn btn-primary btn-block btn-lg">New Cohort</a>
                        </div>
                        <div className="col-12 col-md-8 col-xl-9">
                            { innerBody }
                            {/*
                            <p>
                                <b>(TODO) Visible cohorts sorted by date-modified be here</b><br/>
                                Per-role content or something else could go here also, such as searchview of recent
                                cohorts or individuals if are clinician; new pipelines if are pipeline admin, etc.
                                <br/><br/>
                                (or per-role content can be above dashboard actions; final layout / location etc TBD)
                                <br/><br/>
                                <b>
                                This could also be visible for public visitors as an entrance to a crowdsourcing UI/UX
                                Or be daily cat facts here.
                                </b>
                            </p>
                            */}
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

const CohortListItem = React.memo(function CohortListItem({ item: cohortItem }){
    const {
        '@id' : cohortID,
        display_title: title,
        date_created: created,
        last_modified: { date_modified, modified_by } = {},
        families = [],
        status = null
    } = cohortItem;
    const { display_title: editorName } = modified_by || {};
    const familiesLen = families.length;
    // Todo memoize stuff if props are added.
    const allMembers = families.reduce(function(memo, f){
        (f.members || []).forEach(function(m){
            if (!m['@id']) return;
            memo.add(m['@id']);
        });
        return memo;
    }, new Set());
    //const membersCount = members.size;
    const momentTime = moment(date_modified || created);
    const timeFromNow = momentTime.fromNow();
    const timeNeat = momentTime.format("dddd, MMMM Do YYYY, h:mm:ss a");

    const outerCls = (
        "cohort-item-container" +
        (familiesLen === 0 ? " no-families" : "") +
        (allMembers.size === 0 ? " no-individuals" : "")
    );

    return (
        <div className={outerCls} key={cohortID}>
            <div className="row">
                <h5 className="col-12 col-md-5 col-lg-7 text-600 mt-0 mb-0">
                    <i className="item-status-indicator-dot mr-1" data-status={status} data-html
                        data-tip={"Status &mdash; " + Schemas.Term.toName("status", status)}/>
                    <a href={cohortID}>{ title }</a>
                </h5>
                <div className="col-3 col-md-2 col-lg-1 text-ellipsis-container families-icon-container">
                    <i className="icon icon-fw icon-users fas mr-1"
                        data-tip={familiesLen === 0 ? "No families present" : "" + familiesLen + (familiesLen > 1 ? " Families" : " Family")} />
                    <span>{ familiesLen }</span>
                </div>
                <div className="col-3 col-md-2 col-lg-1 text-ellipsis-container individuals-icon-container">
                    <i className="icon icon-fw icon-user fas mr-1"
                        data-tip={"" + allMembers.size + " Unique Individual" + (allMembers.size === 1 ? "" : "s")}/>
                    <span>{ allMembers.size }</span>
                </div>
                <div className="col-6 col-md-3 text-right time-from-now-container">
                    <i className="icon icon-fw icon-clock far mr-05 align-middle text-small" data-html
                        data-tip={"<div class='text-right'>Last Modified on " + timeNeat + "<br/>by <span class='text-600'>" + (editorName || "<em>Unknown</em>") + "</span></div>"}/>
                    <span className="align-middle">{ timeFromNow }</span>
                </div>
            </div>
        </div>
    );
});
