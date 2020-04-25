'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';
import ReactTooltip from 'react-tooltip';
import _ from 'underscore';

import { console, ajax } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { LocalizedTime } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/LocalizedTime';
import { pageTitleViews, PageTitleContainer, TitleAndSubtitleUnder, OnlyTitle } from './../../PageTitleSection';
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
        const { session, context } = this.props;
        const commonProps = { context };
        return (
            <div className="homepage-wrapper">
                { session ? <UserDashboard {...commonProps} /> : <GuestHomeView {...commonProps} /> }
            </div>
        );
    }

}


const HomePageTitle = React.memo(function HomePageTitle(props){
    const { session, alerts } = props;

    if (session){
        return (
            <PageTitleContainer alerts={alerts} className="container-wide">
                <OnlyTitle>My Dashboard</OnlyTitle>
            </PageTitleContainer>
        );
    }

    return (
        <PageTitleContainer alerts={alerts}>
            <TitleAndSubtitleUnder subtitle="Clinical Genomics Analysis Platform" className="home-page-title">
                [Name TBD]
            </TitleAndSubtitleUnder>
        </PageTitleContainer>
    );
});


pageTitleViews.register(HomePageTitle, "HomePage");
