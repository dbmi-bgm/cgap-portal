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
            <div className="homepage-contents">
                <div className="d-flex flex-column align-items-center justify-content-center">
                    <div className="d-inline-block mb-1 mt-36">
                        <CGAPLogo showTitle={false} id="clone_logo" maxHeight={100} />
                    </div>
                    <div className="cgap-welcome px-2 py-2">
                        <svg id="cgap-welcome-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 395.48 35.77" width="250">
                            <title>Welcome to CGAP</title>
                            <polygon points="40.03 .98 32.3 25.07 24.75 .98 20.83 .98 13.27 25.07 5.54 .98 0 .98 11.27 35.28 15.19 35.28 22.79 11.24 30.38 35.28 34.3 35.28 45.57 .98 40.03 .98"/>
                            <path d="M62.84,12.79c-1.68-1.01-3.62-1.52-5.81-1.52s-4.3,.54-6.15,1.62c-1.85,1.08-3.31,2.54-4.39,4.39-1.08,1.85-1.62,3.93-1.62,6.25s.55,4.41,1.64,6.27c1.09,1.86,2.58,3.32,4.46,4.39,1.88,1.06,3.99,1.59,6.35,1.59,1.83,0,3.56-.34,5.19-1.03,1.63-.69,3.02-1.7,4.17-3.04l-3.43-3.48c-.72,.82-1.59,1.44-2.62,1.86-1.03,.42-2.15,.64-3.36,.64-1.41,0-2.65-.3-3.72-.91-1.08-.6-1.91-1.46-2.5-2.57-.28-.53-.49-1.1-.64-1.71h17.54c.1-.49,.17-.94,.22-1.35,.05-.41,.07-.81,.07-1.2,0-2.25-.48-4.26-1.45-6.03-.96-1.76-2.29-3.15-3.97-4.17Zm-11.83,6.79c.55-1.06,1.34-1.89,2.35-2.47,1.01-.59,2.21-.88,3.58-.88s2.41,.26,3.31,.78c.9,.52,1.59,1.27,2.08,2.25,.27,.55,.47,1.17,.61,1.86h-12.5c.14-.55,.32-1.07,.57-1.54Z"/>
                            <rect x="72.57" width="5.39" height="35.28"/>
                            <path d="M91.21,17.37c1.03-.6,2.21-.91,3.55-.91,1.14,0,2.2,.2,3.16,.61,.96,.41,1.79,1.02,2.47,1.84l3.53-3.58c-1.11-1.31-2.46-2.31-4.04-3.01-1.58-.7-3.29-1.05-5.12-1.05-2.32,0-4.42,.54-6.3,1.62-1.88,1.08-3.36,2.54-4.43,4.39-1.08,1.85-1.62,3.93-1.62,6.25s.54,4.36,1.62,6.22c1.08,1.86,2.56,3.33,4.43,4.41,1.88,1.08,3.98,1.62,6.3,1.62,1.83,0,3.54-.35,5.12-1.05,1.58-.7,2.93-1.71,4.04-3.01l-3.53-3.58c-.69,.82-1.51,1.43-2.47,1.84-.96,.41-2.02,.61-3.16,.61-1.34,0-2.52-.3-3.55-.91-1.03-.6-1.83-1.44-2.4-2.5-.57-1.06-.86-2.28-.86-3.65s.29-2.63,.86-3.68c.57-1.04,1.37-1.87,2.4-2.47Z"/>
                            <path d="M124.36,12.89c-1.86-1.08-3.95-1.62-6.27-1.62s-4.36,.55-6.22,1.64c-1.86,1.1-3.34,2.56-4.43,4.39-1.09,1.83-1.64,3.89-1.64,6.17s.55,4.36,1.64,6.22c1.09,1.86,2.57,3.34,4.43,4.43,1.86,1.09,3.94,1.64,6.22,1.64s4.41-.55,6.27-1.64c1.86-1.09,3.34-2.57,4.43-4.43,1.09-1.86,1.64-3.94,1.64-6.22s-.55-4.35-1.64-6.2c-1.09-1.85-2.57-3.31-4.43-4.39Zm-.32,14.26c-.57,1.08-1.37,1.92-2.4,2.52-1.03,.6-2.21,.91-3.55,.91s-2.47-.3-3.5-.91c-1.03-.6-1.83-1.45-2.4-2.52-.57-1.08-.86-2.3-.86-3.68s.29-2.58,.86-3.63c.57-1.04,1.37-1.87,2.4-2.47,1.03-.6,2.2-.91,3.5-.91s2.52,.3,3.53,.91c1.01,.6,1.81,1.43,2.4,2.47,.59,1.05,.88,2.25,.88,3.63s-.29,2.6-.86,3.68Z"/>
                            <path d="M167.04,12.35c-1.37-.72-2.91-1.08-4.61-1.08s-3.19,.37-4.58,1.1c-1.3,.69-2.38,1.64-3.23,2.84-.77-1.22-1.79-2.18-3.06-2.86-1.34-.72-2.84-1.08-4.51-1.08s-3.17,.37-4.51,1.1c-.87,.48-1.62,1.09-2.25,1.82v-2.43h-5.39v23.52h5.39v-14.01c0-1.04,.23-1.94,.69-2.67,.46-.73,1.07-1.3,1.84-1.69,.77-.39,1.64-.59,2.62-.59,1.44,0,2.65,.43,3.63,1.3,.98,.87,1.47,2.08,1.47,3.65v14.01h5.39v-14.01c0-1.04,.23-1.94,.69-2.67s1.08-1.3,1.86-1.69c.78-.39,1.65-.59,2.6-.59,1.44,0,2.65,.43,3.63,1.3,.98,.87,1.47,2.08,1.47,3.65v14.01h5.39v-15.19c0-1.83-.41-3.4-1.23-4.7-.82-1.31-1.91-2.32-3.28-3.04Z"/>
                            <path d="M193.52,12.79c-1.68-1.01-3.62-1.52-5.81-1.52s-4.3,.54-6.15,1.62c-1.85,1.08-3.31,2.54-4.39,4.39-1.08,1.85-1.62,3.93-1.62,6.25s.55,4.41,1.64,6.27c1.09,1.86,2.58,3.32,4.46,4.39,1.88,1.06,3.99,1.59,6.35,1.59,1.83,0,3.56-.34,5.19-1.03,1.63-.69,3.02-1.7,4.17-3.04l-3.43-3.48c-.72,.82-1.59,1.44-2.62,1.86-1.03,.42-2.15,.64-3.36,.64-1.41,0-2.65-.3-3.72-.91-1.08-.6-1.91-1.46-2.5-2.57-.28-.53-.49-1.1-.64-1.71h17.54c.1-.49,.17-.94,.22-1.35,.05-.41,.07-.81,.07-1.2,0-2.25-.48-4.26-1.45-6.03-.96-1.76-2.29-3.15-3.97-4.17Zm-11.83,6.79c.55-1.06,1.34-1.89,2.35-2.47,1.01-.59,2.21-.88,3.58-.88s2.41,.26,3.31,.78c.9,.52,1.59,1.27,2.08,2.25,.27,.55,.47,1.17,.61,1.86h-12.5c.14-.55,.32-1.07,.57-1.54Z"/>
                            <polygon points="222.02 1.96 216.63 1.96 216.63 11.76 210.99 11.76 210.99 16.66 216.63 16.66 216.63 35.28 222.02 35.28 222.02 16.66 227.65 16.66 227.65 11.76 222.02 11.76 222.02 1.96"/>
                            <path d="M247.94,12.89c-1.86-1.08-3.95-1.62-6.27-1.62s-4.36,.55-6.22,1.64c-1.86,1.1-3.34,2.56-4.43,4.39-1.09,1.83-1.64,3.89-1.64,6.17s.55,4.36,1.64,6.22c1.09,1.86,2.57,3.34,4.43,4.43,1.86,1.09,3.94,1.64,6.22,1.64s4.41-.55,6.27-1.64c1.86-1.09,3.34-2.57,4.43-4.43,1.09-1.86,1.64-3.94,1.64-6.22s-.55-4.35-1.64-6.2c-1.09-1.85-2.57-3.31-4.43-4.39Zm-.32,14.26c-.57,1.08-1.37,1.92-2.4,2.52-1.03,.6-2.21,.91-3.55,.91s-2.47-.3-3.5-.91c-1.03-.6-1.83-1.45-2.4-2.52-.57-1.08-.86-2.3-.86-3.68s.29-2.58,.86-3.63c.57-1.04,1.37-1.87,2.4-2.47,1.03-.6,2.2-.91,3.5-.91s2.52,.3,3.53,.91c1.01,.6,1.81,1.43,2.4,2.47,.59,1.05,.88,2.25,.88,3.63s-.29,2.6-.86,3.68Z"/>
                            <path d="M289.91,29.42c-1.45,.64-3.23,.96-5.32,.96-1.7,0-3.25-.29-4.65-.88-1.41-.59-2.62-1.43-3.65-2.52-1.03-1.09-1.82-2.39-2.38-3.9-.56-1.5-.83-3.15-.83-4.95s.28-3.45,.83-4.95c.55-1.5,1.35-2.8,2.38-3.9,1.03-1.09,2.25-1.94,3.65-2.52,1.4-.59,2.96-.88,4.65-.88,1.93,0,3.62,.31,5.07,.93,1.45,.62,2.69,1.49,3.7,2.6l3.82-3.82c-1.57-1.57-3.37-2.81-5.39-3.72-2.03-.91-4.43-1.37-7.2-1.37-2.48,0-4.78,.46-6.88,1.37-2.11,.92-3.95,2.17-5.51,3.77-1.57,1.6-2.78,3.47-3.63,5.61-.85,2.14-1.27,4.43-1.27,6.88s.42,4.75,1.27,6.88c.85,2.14,2.06,4.02,3.63,5.64,1.57,1.62,3.41,2.88,5.51,3.77,2.11,.9,4.4,1.35,6.88,1.35,2.74,0,5.18-.46,7.3-1.37,2.12-.91,3.97-2.17,5.54-3.77l-3.82-3.82c-1.01,1.11-2.25,1.98-3.7,2.62Z"/>
                            <path d="M316.39,21.85h10.92c-.21,1.33-.56,2.52-1.12,3.55-.88,1.65-2.15,2.89-3.8,3.72-1.65,.83-3.62,1.25-5.9,1.25-2.16,0-4.08-.52-5.78-1.57-1.7-1.05-3.05-2.49-4.04-4.34-1-1.84-1.49-3.98-1.49-6.39s.49-4.54,1.47-6.37c.98-1.83,2.36-3.26,4.14-4.29,1.78-1.03,3.85-1.54,6.2-1.54,1.96,0,3.79,.38,5.49,1.15,1.7,.77,3.05,1.87,4.07,3.31l3.82-3.82c-1.57-1.93-3.51-3.41-5.83-4.46-2.32-1.04-4.83-1.57-7.55-1.57-2.48,0-4.79,.45-6.93,1.35-2.14,.9-4,2.16-5.59,3.77-1.58,1.62-2.83,3.49-3.72,5.61-.9,2.12-1.35,4.41-1.35,6.86s.45,4.75,1.35,6.88c.9,2.14,2.13,4.02,3.7,5.63,1.57,1.62,3.4,2.88,5.49,3.8,2.09,.91,4.31,1.37,6.66,1.37,3.23,0,6.11-.67,8.62-2.01,2.51-1.34,4.5-3.36,5.95-6.08,1.45-2.71,2.18-6.11,2.18-10.19v-.78h-16.95v5.15Z"/>
                            <path d="M348.93,.98l-14.11,34.3h5.98l2.64-6.62h14.74l2.61,6.62h6.08L352.85,.98h-3.92Zm-3.54,22.78l5.45-13.68,5.4,13.68h-10.85Z"/>
                            <path d="M393.98,6.03c-1-1.6-2.35-2.84-4.07-3.72s-3.65-1.32-5.81-1.32h-12.74V35.28h5.64v-12.94h7.1c2.16,0,4.09-.44,5.81-1.32,1.71-.88,3.07-2.12,4.07-3.72,1-1.6,1.49-3.48,1.49-5.64s-.5-4.03-1.49-5.63Zm-4.92,8.7c-.52,.87-1.23,1.54-2.13,2.01-.9,.47-1.94,.71-3.11,.71h-6.81V5.88h6.81c1.18,0,2.21,.24,3.11,.71,.9,.47,1.61,1.14,2.13,2.01,.52,.87,.78,1.89,.78,3.06s-.26,2.2-.78,3.06Z"/>
                        </svg>
                    </div>
                    <div className="cgap-tagline text-center px-2 text-small pt-1">The <strong>Computational Genome Analysis Platform (CGAP)</strong> is an intuitive, open-source analysis tool designed to support complex research &amp; clinical genomics workflows.</div>
                    <LoginController {...{ updateAppSessionState, auth0Options }}>
                        <LoginBox className="mt-25" />
                    </LoginController>
                    <div className="cgap-links text-primary text-small mt-2 mb-5 row">
                        <div className="text-600 pr-sm-1 col-12 col-sm-auto text-center"><a href="https://cgap.hms.harvard.edu">CGAP Homepage</a></div>
                        <div className="text-600 pl-sm-1 pr-sm-1 border-primary col-12 col-sm-auto text-center"><a href="https://cgap-training.hms.harvard.edu/help/logging-in#section1">Account Setup Guide</a></div>
                        <div className="text-600 pl-sm-1 col-12 col-sm-auto text-center"><a href="https://www.youtube.com/@cgaptraining">Video Tutorials</a></div>
                    </div>
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

// function PolygonsBG1 () {
//     const imgWrapperStyle = { position: "absolute", pointerEvents: "none", top: 0, bottom: 0, left: 0, right: 0 };
//     return (
//         <div style={{ width: "100%", height: "100%", position: "absolute" }}>
//             <div style={{ position: "absolute", width: 357, height: 308, right: -87, top: 15 }}>
//                 <div className="user-select-none" style={imgWrapperStyle}>
//                     <div style={{ display: "contents" }}>
//                         <img src="https://framerusercontent.com/modules/assets/1pXoFnbTd2pyuWmvvDCu8xpQxE~36iLowNAlGP9erAmDQsiAWojpI531uvGNt6YlCe5X5E.png" className="w-100 h-100" />
//                     </div>
//                 </div>
//             </div>
//             <div style={{ position: "absolute", width: 357, height: 308, left: 0, top: "calc(50% - 153.905px)" }}>
//                 <div style={imgWrapperStyle}>
//                     <div style={{ display: "contents" }}>
//                         <img src="https://framerusercontent.com/modules/assets/1pXoFnbTd2pyuWmvvDCu8xpQxE~36iLowNAlGP9erAmDQsiAWojpI531uvGNt6YlCe5X5E.png" className="w-100 h-100" />
//                     </div>
//                 </div>
//             </div>
//             <div style={{ position: "absolute", width: 357, height: 308, right: -87, bottom: -7 }}>
//                 <div style={imgWrapperStyle}>
//                     <div style={{ display: "contents" }}>
//                         <img src="https://framerusercontent.com/modules/assets/1pXoFnbTd2pyuWmvvDCu8xpQxE~36iLowNAlGP9erAmDQsiAWojpI531uvGNt6YlCe5X5E.png" className="w-100 h-100" />
//                     </div>
//                 </div>
//             </div>
//         </div>
//     );
// }

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

