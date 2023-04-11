'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';

import {
    console,
    ajax,
} from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';
import { pageTitleViews } from './../../PageTitleSection';
import { GuestHomeView } from './GuestHomeView';
import { UserDashboard } from './UserDashboard';

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
        const {
            session,
            context,
            alerts,
            schemas,
            windowHeight,
            windowWidth,
            updateAppSessionState,
        } = this.props;
        const commonProps = { context };
        // Render alerts here instead of (unused-for-homepage) PageTitleSection
        return (
            <div className="homepage-wrapper">
                <div id="full-alerts-container" className="bg-primary-dark">
                    <Alerts alerts={alerts} className="alerts" />
                </div>
                {session ? (
                    <UserDashboard
                        {...commonProps}
                        {...{ schemas, windowHeight, windowWidth }}
                    />
                ) : (
                    <GuestHomeView
                        {...commonProps}
                        {...{ updateAppSessionState, session }}
                    />
                )}
            </div>
        );
    }
}

// TODO: Get rid of this entirely
const HomePageTitle = React.memo(function HomePageTitle(props) {
    return null;
});

pageTitleViews.register(HomePageTitle, 'HomePage');
