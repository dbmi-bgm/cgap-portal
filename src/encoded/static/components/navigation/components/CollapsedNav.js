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
    BigDropdownGroupController
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
            <a href="/cohort-analysis" className={"nav-link browse-nav-btn" + (isCohortsLinkActive ? " active" : "")}>
                Cohorts
            </a>
            <a href="/search/?type=GeneList" className={"nav-link browse-nav-btn" + (isGeneListsLinkActive ? " active" : "")}>
                GeneLists
            </a>
            <HelpNavItem {...props} />
        </div>
    );
}

const LeftNavGuest = React.memo(function LeftNavGuest(props){
    const { href, ...passProps } = props;
    const { pathname = "/" } = url.parse(href, false);

    return (
        <div className="navbar-nav mr-auto">
            {/*
            <a href="/case-studies" className={"nav-link" + (pathname === "/case-studies" ? " active" : "")}>
                Case Studies
            </a>
            */}
            <HelpNavItem {...props} />
            {/*
            <a href="/about" className={"nav-link" + (pathname === "/about" ? " active" : "")}>
                About
            </a>
            */}
        </div>
    );
});
