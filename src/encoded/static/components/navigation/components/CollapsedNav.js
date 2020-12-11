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
// import { SearchBar } from './SearchBar';


export const CollapsedNav = React.memo(function CollapsedNav(props){
    const {
        context,
        href, currentAction, session, mounted,
        overlaysContainer, windowWidth, windowHeight,
        browseBaseState, testWarningVisible,
        addToBodyClassList, removeFromBodyClassList,
        schemas, updateUserInfo
    } = props;

    const leftNavProps = {
        context,
        windowWidth, windowHeight, href, mounted, overlaysContainer, session,
        testWarningVisible, browseBaseState//, addToBodyClassList, removeFromBodyClassList
    };

    const userActionNavProps = {
        windowWidth, windowHeight, href, mounted, overlaysContainer, session,
        schemas, updateUserInfo, testWarningVisible
    };

    // We'll probably keep using NavbarCollapse for a bit since simpler than implementing own
    // (responsive openable mobile menus)
    return (
        <NavbarCollapse>
            <BigDropdownGroupController {...{ addToBodyClassList, removeFromBodyClassList }}>
                { session ?
                    <LeftNavAuthenticated {...leftNavProps} />
                    : <LeftNavGuest {...leftNavProps} /> }
                {/* <SearchBar {...{ href, currentAction, context }} /> */}
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
    const { context } = props;
    const isCasesLinkActive = useMemo(function(){
        const { "@id": searchHref } = context;
        const { query = {} } = url.parse(searchHref, true);
        return query.type === 'Case';
    }, [ context ]);
    return (
        <div className="navbar-nav mr-auto">
            <a href="/search/?type=Case&proband_case=true" className={"nav-link browse-nav-btn" + (isCasesLinkActive ? " active" : "")}>
                Cases
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
            <a href="/case-studies" className={"nav-link" + (pathname === "/case-studies" ? " active" : "")}>
                Case Studies
            </a>
            <HelpNavItem {...props} />
            <a href="/about" className={"nav-link" + (pathname === "/about" ? " active" : "")}>
                About
            </a>
        </div>
    );
});
