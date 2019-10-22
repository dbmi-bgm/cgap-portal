'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import url from 'url';
import _ from 'underscore';
import { Navbar, Nav, NavItem } from 'react-bootstrap';
import { console } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';

import { SearchBar } from './SearchBar';
import { HelpNavItem } from './HelpNavItem';
import { UserActionDropdownMenu } from './UserActionDropdownMenu';


export const CollapsedNav = React.memo(function CollapsedNav(props){
    const { href, currentAction, session } = props;
    const leftNavProps = _.pick(props, 'mobileDropdownOpen', 'windowWidth', 'windowHeight', 'browseBaseState', 'href',
        'mounted', 'overlaysContainer', 'session', 'testWarning', 'isFullscreen');
    const userActionNavProps = _.pick(props, 'session', 'href', 'updateUserInfo', 'mounted', 'overlaysContainer', 'schemas', 'windowWidth');


    return (
        <Navbar.Collapse>
            { session ? <LeftNavAuthenticated {...leftNavProps} /> : <LeftNavGuest {...leftNavProps} /> }
            <SearchBar href={href} currentAction={currentAction} />
            <UserActionDropdownMenu {...userActionNavProps} />
        </Navbar.Collapse>
    );
});

/**
 * @todo Test user actions or role for things to have here?
 */
const LeftNavAuthenticated = React.memo(function LeftNavAuthenticated(props){
    const { href, ...passProps } = props;
    const { query = {} } = url.parse(href, true);
    const isCohortsLinkActive = query.type === 'Cohort';

    return (
        <Nav className="mr-auto">
            <Nav.Link key="browse-menu-item" href="/cohorts/" active={isCohortsLinkActive} className="browse-nav-btn">
                Cohorts
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
            <a href="/cohort-studies" className={"nav-link" + (pathname === "/cohort-studies" ? " active" : "")}>
                Cohort Studies
            </a>
            <HelpNavItem {...props} />
            <a href="/about" className={"nav-link" + (pathname === "/about" ? " active" : "")}>
                About
            </a>
        </Nav>
    );
});
