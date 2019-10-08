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
    return (
        <div className="container-wide home-content-area" id="content">
            <div className="mt-4 homepage-dashboard">
                <h2 className="homepage-section-title">Actions</h2>
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

            <RecentCasesSection />

        </div>
    );
});



class RecentCasesSection extends React.PureComponent {

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
            cases: null,
            casesCount: null,
            error: false
        };
    }

    componentDidMount(){

        const cb = (res) => {
            if (res && Array.isArray(res['@graph'])){
                this.setState({
                    loading: false,
                    cases: res['@graph'],
                    casesCount: res.total
                }, ReactTooltip.rebuild);
                return;
            } else {
                this.setState({ loading: false, error: true });
            }
        };

        const requestHref = (
            "/search/?type=Case&limit=50&sort=-last_modified.date_modified&" +
            RecentCasesSection.fieldsToRequest.map(function(f){ return "field=" + encodeURIComponent(f); }).join('&')
        );

        this.setState({ loading: true }, ()=>{
            ajax.load(requestHref, cb, "GET", cb);
        });
    }

    render(){
        const { cases = [], loading, casesCount = null } = this.state;

        let innerBody;
        let viewAllCasesBtn;
        let createCaseBtn;

        if (loading){
            innerBody = (
                <div className="text-center text-larger">
                    <i className="icon icon-fw icon-circle-notch icon-spin fas"/>
                </div>
            );
        } else if (!Array.isArray(cases) || cases.length === 0){
            innerBody = (
                <div className="text-center text-larger">
                    You currently have no cases.
                </div>
            );
        } else {
            const renderedCases = cases.map(function(caseItem){
                const {
                    '@id' : caseID,
                    display_title: title,
                    date_created: created,
                    last_modified: { date_modified, modified_by } = {},
                    families = [],
                    status = null
                } = caseItem;

                const { display_title: editorName } = modified_by || {};
                const familiesLen = families.length;
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
                    "case-item-container" +
                    (familiesLen === 0 ? " no-families" : "") +
                    (allMembers.size === 0 ? " no-individuals" : "")
                );

                return (
                    <div className={outerCls} key={caseID}>
                        <div className="row">
                            <h5 className="col-12 col-md-5 col-lg-7 text-600 mt-0 mb-0">
                                <i className="item-status-indicator-dot mr-1" data-status={status} data-html
                                    data-tip={"Status &mdash; " + Schemas.Term.toName("status", status)}/>
                                <a href={caseID}>{ title }</a>
                            </h5>
                            <div className="col-3 col-md-2 col-lg-1 px-0 text-ellipsis-container families-icon-container">
                                <i className="icon icon-fw icon-users fas mr-1"
                                    data-tip={familiesLen === 0 ? "No families present" : "" + familiesLen + (familiesLen > 1 ? " Families" : " Family")} />
                                <span>{ familiesLen }</span>
                            </div>
                            <div className="col-3 col-md-2 col-lg-1 px-0 text-ellipsis-container individuals-icon-container">
                                <i className="icon icon-fw icon-user fas mr-1"
                                    data-tip={"" + allMembers.size + " Unique Individual" + (allMembers.size === 1 ? "" : "s")}/>
                                <span>{ allMembers.size }</span>
                            </div>
                            <div className="col-6 col-md-3 text-right">
                                <i className="icon icon-fw icon-clock far mr-05 align-middle text-small" data-html
                                    data-tip={"<div class='text-right'>Last Modified on " + timeNeat + "<br/>by <span class='text-600'>" + (editorName || "<em>Unknown</em>") + "</span></div>"}/>
                                <span className="align-middle">{ timeFromNow }</span>
                            </div>
                        </div>
                    </div>
                );
            });
            innerBody = <div className="case-items">{ renderedCases }</div>;
            viewAllCasesBtn = (
                <a href="/search/?type=Case" className="btn btn-outline-dark btn-block">
                    View All { casesCount ? <span className="text-300">({ casesCount })</span> : null }
                </a>
            );
        }

        return (
            <React.Fragment>
                <h2 className="homepage-section-title mt-5">Recent Cases</h2>
                <div className="row">
                    <div className="col-12 col-md-4 col-xl-3 mb-1">
                        { viewAllCasesBtn }
                        <a href="/search/?type=Case&currentAction=add" className="btn btn-primary btn-block btn-lg">New Case</a>
                    </div>
                    <div className="col-12 col-md-8 col-xl-9">
                        { innerBody }
                        {/*
                        <p>
                            <b>(TODO) Visible cases sorted by date-modified be here</b><br/>
                            Per-role content or something else could go here also, such as searchview of recent
                            cases or individuals if are clinician; new pipelines if are pipeline admin, etc.
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
            </React.Fragment>
        );
    }
}
