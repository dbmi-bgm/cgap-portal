'use strict';

import React, { useEffect, useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';
import { LoginController } from '@hms-dbmi-bgm/shared-portal-components/es/components/navigation/components/LoginController';
import { NotLoggedInAlert } from './../../navigation/components/LoginNavItem';
import { UserRegistrationModal } from './../../navigation/components/UserRegistrationModal';
import { auth0Options as navAuth0Options } from './../../navigation/components/AccountNav';
import { CGAPLogo } from './../../viz/CGAPLogo';


const auth0Options = {
    ...navAuth0Options,
    container: "homepage-login-container",
    // Reverts to using Auth0's logo:
    // theme: { ...navAuth0Options.theme, logo: null, icon: null }
};

export const GuestHomeView = React.memo(function GuestHomeView(props){
    const { updateAppSessionState } = props;

    // Upon mount, unset alerts from any other pages, to prevent vertical scroll.
    useEffect(function(){
        Alerts.deQueue(Alerts.LoggedOut);
        Alerts.deQueue(NotLoggedInAlert);
    }, []);

    return (
        <React.Fragment>

            <div className="homepage-contents d-flex flex-column align-items-center">
                <PolygonsBG1 />
                <div className="d-inline-block mb-1 mt-36">
                    <CGAPLogo title={null} id="clone_logo" maxHeight={100} />
                </div>
                <div className="cgap-welcome text-600 px-2">Welcome to CGAP</div>
                <div className="cgap-tagline text-center px-2 text-small pt-1">The <strong>Clinical Genome Analysis Platform (CGAP)</strong> is an intuitive, open-source analysis tool designed to support complex research &amp; clinical genomics workflows.</div>
                <LoginController {...{ updateAppSessionState, auth0Options }}>
                    <LoginBox className="mt-25" />
                </LoginController>
                <div className="text-small mt-2 mb-5">
                    <span className="text-600 mr-05"><a href="https://cgap.hms.harvard.edu">CGAP Homepage</a></span>| 
                    <span className="text-600 ml-05 mr-05"><a href="/help/logging-in">Account Setup Guide</a></span>|
                    <span className="text-600 ml-05"><a href="/help/tutorials">Video Tutorials</a></span>
                </div>
            </div>

        </React.Fragment>
    );
});

const LoginBox = React.memo(function LoginBox (props) {
    const { showLock, isAuth0LibraryLoaded, unverifiedUserEmail } = props;

    useEffect(function(){
        // Also show lock again when unverifiedUserEmail is unset, since when registration modal pops up, LoginController will hide lock.
        if (!isAuth0LibraryLoaded || unverifiedUserEmail) return;
        showLock();
    }, [ isAuth0LibraryLoaded, unverifiedUserEmail ]);

    return (
        <React.Fragment>
            <LoginBoxContainerElement />
            { unverifiedUserEmail ? <UserRegistrationModal {...props} /> : null }
        </React.Fragment>
    );
});

/** Memoized with no props, never to be re-rendered since is root of Auth0 widget's own ReactDOM.render. */
const LoginBoxContainerElement = React.memo(function(){
    return (
        <div className="login-container text-center" id="homepage-login-container">
            <i className="icon icon-circle-notch icon-spin fas text-secondary icon-2x"/>
        </div>
    );
});

function PolygonsBG1 () {
    const imgWrapperStyle = { position: "absolute", pointerEvents: "none", top: 0, bottom: 0, left: 0, right: 0 };
    return (
        <div style={{ width: "100%", height: "100%", position: "absolute" }}>
            <div style={{ position: "absolute", width: 357, height: 308, right: -87, top: 15 }}>
                <div className="user-select-none" style={imgWrapperStyle}>
                    <div style={{ display: "contents" }}>
                        <img src="https://framerusercontent.com/modules/assets/1pXoFnbTd2pyuWmvvDCu8xpQxE~36iLowNAlGP9erAmDQsiAWojpI531uvGNt6YlCe5X5E.png" className="w-100 h-100" />
                    </div>
                </div>
            </div>
            <div style={{ position: "absolute", width: 357, height: 308, left: 0, top: "calc(50% - 153.905px)" }}>
                <div style={imgWrapperStyle}>
                    <div style={{ display: "contents" }}>
                        <img src="https://framerusercontent.com/modules/assets/1pXoFnbTd2pyuWmvvDCu8xpQxE~36iLowNAlGP9erAmDQsiAWojpI531uvGNt6YlCe5X5E.png" className="w-100 h-100" />
                    </div>
                </div>
            </div>
            <div style={{ position: "absolute", width: 357, height: 308, right: -87, bottom: -7 }}>
                <div style={imgWrapperStyle}>
                    <div style={{ display: "contents" }}>
                        <img src="https://framerusercontent.com/modules/assets/1pXoFnbTd2pyuWmvvDCu8xpQxE~36iLowNAlGP9erAmDQsiAWojpI531uvGNt6YlCe5X5E.png" className="w-100 h-100" />
                    </div>
                </div>
            </div>
        </div>
    );
}

// const ExternalLinksColumn = React.memo(function ExternalLinksColumn(props){
//     return (
//         <div className="homepage-links-column external-links">
//             <h4 className="text-400 mb-15 mt-25">Our Partners</h4>
//             <div className="links-wrapper clearfix">
//                 <div className="link-block">
//                     <a href="https://www.brighamandwomens.org/medicine/genetics/genetics-genomic-medicine-service" target="_blank" rel="noopener noreferrer" className="external-link">
//                         <span>Brigham Genomic Medicine</span>
//                     </a>
//                 </div>
//                 <div className="link-block">
//                     <a href="https://undiagnosed.hms.harvard.edu/" target="_blank" rel="noopener noreferrer" className="external-link">
//                         <span>Undiagnosed Diseases Network (UDN)</span>
//                     </a>
//                 </div>
//                 <div className="link-block">
//                     <a href="http://dcic.4dnucleome.org/" target="_blank" rel="noopener noreferrer" className="external-link">
//                         <span>4DN DCIC</span>
//                     </a>
//                 </div>
//             </div>
//             <h4 className="text-400">Who We Are</h4>
//             <div className="links-wrapper clearfix">
//                 <div className="link-block">
//                     <a href="https://dbmi.hms.harvard.edu/" target="_blank" rel="noopener noreferrer" className="external-link">
//                         <span>HMS DBMI</span>
//                     </a>
//                 </div>
//             </div>
//         </div>
//     );
// });

