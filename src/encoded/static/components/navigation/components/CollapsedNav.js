'use strict';

import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import url from 'url';
import _ from 'underscore';
import NavbarCollapse from 'react-bootstrap/esm/NavbarCollapse';
import { console, memoizedUrlParse } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { navigate } from './../../util'; // Extended w. browseBaseHref & related fxns.

import {
    BigDropdownNavItem,
    BigDropdownPageLoader,
    BigDropdownPageTreeMenu,
    BigDropdownPageTreeMenuIntroduction,
    BigDropdownGroupController,
    BigDropdownBigLink
} from './BigDropdown';
import { AccountNav } from './AccountNav';
import FeedbackButton from '../../item-pages/components/FeedbackButton';


export const CollapsedNav = React.memo(function CollapsedNav(props){
    const {
        context,
        href, currentAction, session, mounted,
        overlaysContainer, windowWidth, windowHeight,
        testWarningVisible,
        addToBodyClassList, removeFromBodyClassList,
        schemas, updateAppSessionState
    } = props;

    const leftNavProps = {
        context,
        windowWidth, windowHeight, href, mounted, overlaysContainer, session,
        testWarningVisible, //, addToBodyClassList, removeFromBodyClassList
    };

    const userActionNavProps = {
        windowWidth, windowHeight, href, mounted, overlaysContainer, session,
        schemas, updateAppSessionState, testWarningVisible
    };

    // We'll probably keep using NavbarCollapse for a bit since simpler than implementing own
    // (responsive openable mobile menus)
    return (
        <NavbarCollapse>
            <BigDropdownGroupController {...{ addToBodyClassList, removeFromBodyClassList }}>
                { session ?
                    <LeftNavAuthenticated {...leftNavProps} />
                    : <LeftNavGuest {...leftNavProps} /> }
                <FeedbackButton />
                <AccountNav {...userActionNavProps} />
            </BigDropdownGroupController>
        </NavbarCollapse>
    );
});


function HelpNavItem(props){
    const { session, ...navItemProps } = props;
    // `navItemProps` contains: href, windowHeight, windowWidth, isFullscreen, testWarning, mounted, overlaysContainer
    return (
        <BigDropdownPageLoader treeURL="/help" session={session}>
            <BigDropdownNavItem {...navItemProps} id="help-menu-item" navItemHref="/help" navItemContent="Help">
                <BigDropdownPageTreeMenuIntroduction titleIcon="info-circle fas" />
                <BigDropdownPageTreeMenu />
            </BigDropdownNavItem>
        </BigDropdownPageLoader>
    );
}

/**
 * @todo Test user actions or role for things to have here?
 */
function LeftNavAuthenticated(props){
    const { context, href } = props;
    const { isGeneListsLinkActive, isCohortsLinkActive } = useMemo(function(){
        const { "@id": contextID } = context;
        const { query = {}, pathname } = url.parse(href || contextID, true);
        // We assume href and context change together, so we memoize on context instead of href
        // since is a more performant comparison.
        return {
            "isGeneListsLinkActive": pathname.substring(0,7) === "/search" && query.type === "GeneList",
            "isCohortsLinkActive": pathname.substring(0,16) === "/cohort-analysis"
        };
    }, [ context ]);
    return (
        <div className="navbar-nav mr-auto">
            <BrowseNavItem {...{ href }} {...props} />
            <a href="/cohort-analysis" className={"nav-link browse-nav-btn" + (isCohortsLinkActive ? " active" : "")}>
                Cohort Browser
            </a>
            <HelpNavItem {...props} />
        </div>
    );
}

const LeftNavGuest = React.memo(function LeftNavGuest(props){
    const { href, ...passProps } = props;
    // const { pathname = "/" } = url.parse(href, false);

    return (
        <div className="navbar-nav mr-auto">
            <HelpNavItem {...props} />
        </div>
    );
});

function BrowseNavItem(props){
    const { href, browseBaseState, ...navItemProps } = props;
    const { active: propActive } = navItemProps || {};

    // /** @see https://reactjs.org/docs/hooks-reference.html#usememo */
    const bodyProps = useMemo(function(){
        // Figure out if any items are active
        const { query = {}, pathname = "/a/b/c/d/e" } = memoizedUrlParse(href);

        const browseHref = "/search/?type=Item";
        const browseByCaseHref = "/search/?proband_case=true&type=Case"; // Go to proband cases from nav bar by default
        const browseBySomaticAnalysisHref = "/search/?type=SomaticAnalysis";
        const browseByGeneListHref = "/search/?type=GeneList";
        const browseByCohortAnalysisHref = "/search/?type=CohortAnalysis";

        const isSearchActive = pathname === "/search/";
        const isBrowseByCaseActive = isSearchActive && query.type === "Case";
        const isBrowseByCohortAnalysisActive = isSearchActive && query.type === "CohortAnalysis";
        const isBrowseBySomaticAnalysisActive = isSearchActive && query.type === "SomaticAnalysis";
        const isBrowseByGeneListActive = isSearchActive && query.type === "GeneList";

        const isAnyActive = (isSearchActive || isBrowseByCaseActive || isBrowseByCohortAnalysisActive || isBrowseByGeneListActive || isBrowseBySomaticAnalysisActive);
        return {
            browseHref, browseBySomaticAnalysisHref, browseByCaseHref, browseByCohortAnalysisHref, browseByGeneListHref,
            isAnyActive, isSearchActive, isBrowseByCaseActive, isBrowseByCohortAnalysisActive, isBrowseByGeneListActive,
            isBrowseBySomaticAnalysisActive
        };
    }, [ href, browseBaseState ]);

    const navLink = (
        <React.Fragment>
            <span className="text-black">Browse</span>
        </React.Fragment>
    );
    const active = propActive !== false && bodyProps.isAnyActive;
    return ( // `navItemProps` contains: href, windowHeight, windowWidth, isFullscreen, testWarning, mounted, overlaysContainer
        <BigDropdownNavItem {...navItemProps} id="data-menu-item"
            navItemHref={bodyProps.browseHref}
            navItemContent={navLink}
            active={active}>
            <BrowseNavItemBody {...bodyProps} />
        </BigDropdownNavItem>
    );
}

const BrowseNavItemBody = React.memo(function BrowseNavItemBody(props) {
    const {
        browseByCaseHref,
        browseBySomaticAnalysisHref,
        browseByCohortAnalysisHref,
        browseByGeneListHref,
        isBrowseByCaseActive = false,
        isBrowseByCohortAnalysisActive = false,
        isBrowseBySomaticAnalysisActive = false,
        isBrowseByGeneListActive = false
    } = props;
    return (
        <React.Fragment>

            <BigDropdownBigLink href={browseByCaseHref} isActive={isBrowseByCaseActive} titleIcon="archive fas" className="primary-big-link">
                <h4>Browse By Germline Case</h4>
                <div className="description">
                    Search All Cases on the Computational Genome Analysis Platform
                </div>
            </BigDropdownBigLink>

            <BigDropdownBigLink href={browseBySomaticAnalysisHref} isActive={isBrowseBySomaticAnalysisActive} titleIcon="spinner fas" className="primary-big-link">
                <h4>Browse By Somatic Analysis</h4>
                <div className="description">
                    Search All Somatic Analyses on the Computational Genome Analysis Platform
                </div>
            </BigDropdownBigLink>

            <BigDropdownBigLink href={browseByCohortAnalysisHref} isActive={isBrowseByCohortAnalysisActive} titleIcon="project-diagram fas" className="primary-big-link">
                <h4>Browse By Cohort Analysis</h4>
                <div className="description">
                    Search All Cohort Analyses on the Computational Genome Analysis Platform
                </div>
            </BigDropdownBigLink>

            <BigDropdownBigLink href={browseByGeneListHref} isActive={isBrowseByGeneListActive} titleIcon="dna fas" className="primary-big-link">
                <h4>Browse By Gene List</h4>
                <div className="description">
                    Search All Gene Lists on the Computational Genome Analysis Platform
                </div>
            </BigDropdownBigLink>

        </React.Fragment>
    );
});
