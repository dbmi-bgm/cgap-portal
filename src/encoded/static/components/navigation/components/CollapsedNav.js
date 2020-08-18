'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import url from 'url';
import _ from 'underscore';
import Navbar from 'react-bootstrap/esm/Navbar';
import Nav from 'react-bootstrap/esm/Nav';
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
import { SearchBar } from './SearchBar';


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
        windowWidth, windowHeight, href, mounted, overlaysContainer, session,
        testWarningVisible, browseBaseState//, addToBodyClassList, removeFromBodyClassList
    };

    const userActionNavProps = {
        windowWidth, windowHeight, href, mounted, overlaysContainer, session,
        schemas, updateUserInfo, testWarningVisible
    };


    return (
        <Navbar.Collapse>
            <BigDropdownGroupController {...{ addToBodyClassList, removeFromBodyClassList }}>
                { session ?
                    <LeftNavAuthenticated {...leftNavProps} />
                    : <LeftNavGuest {...leftNavProps} /> }
                {/* <SearchBar {...{ href, currentAction, context }} /> */}
                <AccountNav {...userActionNavProps} />
            </BigDropdownGroupController>
        </Navbar.Collapse>
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
 * @todo Migrate to regular DOM elements from Nav.Link etc. See LeftNavGuest-ish.
 */
const LeftNavAuthenticated = React.memo(function LeftNavAuthenticated(props){
    const { href, ...passProps } = props;
    const { query = {} } = url.parse(href, true);
    const isCasesLinkActive = query.type === 'Case';
    // TODO: query seems to be coming in empty, need to fix to get highlighting working again

    return (
        <Nav className="mr-auto">
            <Nav.Link key="browse-menu-item" href="/cases/" active={isCasesLinkActive} className="browse-nav-btn">
                Cases
            </Nav.Link>
            <HelpNavItem {...props} />
        </Nav>
    );
});

const LeftNavGuest = React.memo(function LeftNavGuest(props){
    const { href, ...passProps } = props;
    const { pathname = "/" } = url.parse(href, false);

    return (
        <Nav className="mr-auto">
            <a href="/case-studies" className={"nav-link" + (pathname === "/case-studies" ? " active" : "")}>
                Case Studies
            </a>
            <HelpNavItem {...props} />
            <a href="/about" className={"nav-link" + (pathname === "/about" ? " active" : "")}>
                About
            </a>
        </Nav>
    );
});
