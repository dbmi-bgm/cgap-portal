'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';
import ReactTooltip from 'react-tooltip';
import _ from 'underscore';

import { console, ajax } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { LocalizedTime } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/LocalizedTime';
import { pageTitleViews, PageTitleContainer, TitleAndSubtitleUnder, OnlyTitle } from './../PageTitleSection';


/**
 * Homepage View component. Gets rendered at '/' and '/home' paths.
 *
 * @module {Component} static-pages/home
 * @prop {Object} context - Should have properties typically needed for any static page.
 */
export default class HomePage extends React.PureComponent {

    /**
     * The render function. Renders homepage contents.
     * @returns {Element} A React <div> element.
     */
    render() {
        const { session, context } = this.props;
        return (
            <div className="homepage-wrapper">

                <div className="container home-content-area" id="content">

                    { session ? <MyDashboard /> : <GuestHomeView /> }

                </div>

            </div>
        );
    }

}



const MyDashboard = React.memo(function MyDashboard(props){
    return (
        <React.Fragment>
            <div className="mt-4 homepage-dashboard">
                <h2 className="homepage-section-title">Actions</h2>
                <p>
                    We might create a set of mini-dashboards like "Recent Cases" below and then display & order them based on user role,
                    permissions, & similar.
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

        </React.Fragment>
    );
});



const GuestHomeView = React.memo(function GuestHomeView(props){
    return (
        <React.Fragment>
            <div className="row mt-5">
                <div className="col-xs-12 col-md-12">
                    <h2 className="homepage-section-title">Marketing Stuff Here (maybe)</h2>
                    <h4 className="text-500">(maybe) Publicly-viewable cases as entrance to crowdsourcing UI/UX</h4>
                    <p>

                    </p>
                </div>
            </div>
            <div className="row mt-3">
                <div className="col-xs-12 col-md-5 pull-right">
                    <LinksColumn {..._.pick(props, 'windowWidth')} />
                </div>
            </div>
        </React.Fragment>
    );
});



class RecentCasesSection extends React.PureComponent {

    static fieldsToRequest = [
        'display_title',
        'last_modified.date_modified',
        'last_modified.modified_by',
        '@id',
        'families.members.@id'
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
            "/search/?type=Case&limit=20&sort=-last_modified.date_modified&" +
            RecentCasesSection.fieldsToRequest.map(function(f){ return "field=" + encodeURIComponent(f); }).join('&')
        );

        this.setState({ loading: true }, ()=>{
            ajax.load(requestHref, cb, "GET", cb);
        });
    }

    render(){
        const { cases = [], loading, casesCount = null } = this.state;

        let innerBody;

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
                    families = []
                } = caseItem;

                const { display_title: editorName } = modified_by;
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

                return (
                    <div className="case-item-container" key={caseID}>
                        <div className="row">
                            <h5 className="col text-600 mt-0 mb-0">
                                <a href={caseID}>{ title }</a>
                            </h5>
                            <div className="col-2 col-xl-1">
                                <i className={"icon icon-fw icon-users fas mr-1" + (familiesLen === 0 ? " error" : "")}
                                    data-tip={familiesLen === 0 ? "No families present" : "Number of Families"} />
                                <span>{ familiesLen }</span>
                            </div>
                            <div className="col-2 col-xl-1">
                                <i className={"icon icon-fw icon-user fas mr-1" + (allMembers.size === 0 ? " error" : "")}
                                    data-tip="Number of Unique Individuals"/>
                                <span>{ allMembers.size }</span>
                            </div>
                            <div className="col-3 text-right">
                                <i className="icon icon-fw icon-clock far mr-05 align-middle text-small" data-html
                                    data-tip={"<div class='text-right'>Last Modified on " + timeNeat + "<br/>by <span class='text-600'>" + editorName + "</span></div>"}/>
                                <span className="align-middle">{ timeFromNow }</span>
                            </div>
                        </div>
                    </div>
                );
            });
            innerBody = <div className="case-items">{ renderedCases }</div>;
        }

        return (
            <React.Fragment>
                <h2 className="homepage-section-title mt-5">Recent Cases</h2>
                <div className="row">
                    <div className="col-12 col-md-4 col-xl-3 hidden-xs">
                        <a href="/search/?type=Case" className="btn btn-outline-dark btn-block">
                            View All { casesCount ? <span className="text-300">({ casesCount })</span> : null }
                        </a>
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



const ExternalLinksColumn = React.memo(function ExternalLinksColumn(props){
    return (
        <div className="homepage-links-column external-links">
            {/* <h3 className="text-300 mb-2 mt-3">External Links</h3> */}
            <h4 className="text-400 mb-15 mt-25">External Links</h4>
            ( layout & location not final / TBD )
            <div className="links-wrapper clearfix">
                <div className="link-block">
                    <a href="https://dbmi.hms.harvard.edu/" target="_blank" rel="noopener noreferrer" className="external-link">
                        <span>HMS DBMI</span>
                    </a>
                </div>
                <div className="link-block">
                    <a href="https://www.brighamandwomens.org/medicine/genetics/genetics-genomic-medicine-service" target="_blank" rel="noopener noreferrer" className="external-link">
                        <span>Brigham Genomic Medicine</span>
                    </a>
                </div>
                <div className="link-block">
                    <a href="https://undiagnosed.hms.harvard.edu/" target="_blank" rel="noopener noreferrer" className="external-link">
                        <span>Undiagnosed Diseased Network (UDN)</span>
                    </a>
                </div>
                <div className="link-block">
                    <a href="https://forome.org/" target="_blank" rel="noopener noreferrer" className="external-link">
                        <span>Forome</span>
                    </a>
                </div>
                <div className="link-block">
                    <a href="http://dcic.4dnucleome.org/" target="_blank" rel="noopener noreferrer" className="external-link">
                        <span>4DN DCIC</span>
                    </a>
                </div>
            </div>
            <br/>
        </div>
    );
});


const LinksColumn = React.memo(function LinksColumn(props){
    return (
        <div className="homepage-links">
            <ExternalLinksColumn />
        </div>
    );
});


const HomePageTitle = React.memo(function HomePageTitle(props){
    const { session, alerts } = props;

    if (session){
        return (
            <PageTitleContainer alerts={alerts}>
                <OnlyTitle>My Dashboard</OnlyTitle>
            </PageTitleContainer>
        );
    }

    return (
        <PageTitleContainer alerts={alerts}>
            <TitleAndSubtitleUnder subtitle="Clinical Genomics Analysis Platform" className="home-page-title">
                <strong>TODO:</strong> Portal Title Here
            </TitleAndSubtitleUnder>
        </PageTitleContainer>
    );
});


pageTitleViews.register(HomePageTitle, "HomePage");
