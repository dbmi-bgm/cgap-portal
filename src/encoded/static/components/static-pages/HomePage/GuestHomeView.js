'use strict';

import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';
import { NotLoggedInAlert, onAlertLoginClick } from './../../navigation/components/LoginNavItem';


export const GuestHomeView = React.memo(function GuestHomeView(props){
    const [ mounted, setMounted ] = useState(false);

    // Upon mount, unset alerts from any other pages, to prevent vertical scroll.
    useEffect(function(){
        Alerts.deQueue(Alerts.LoggedOut);
        Alerts.deQueue(NotLoggedInAlert);
        // JS might not yet be loaded/active until mounted.
        setMounted(true);
    }, []);

    return (
        <React.Fragment>

            <div className="px-4 homepage-contents d-flex flex-column flex-lg-row align-items-lg-stretch">

                <div className="py-5 col col-lg-8 d-flex flex-column justify-content-around">
                    <div className="mx-3">
                        <h2 className="homepage-section-title text-white mt-0">
                            <span className="text-400">Clinical Genome Analysis Platform </span>
                        </h2>
                        <hr className="border-white" />
                        <p className="text-white">The <a className="text-white" href="https://cgap.hms.harvard.edu">Clinical Genome Analysis Platform <b>(CGAP)</b></a> is an intuitive, open-source analysis tool designed to support complex research & clinical genomics workflows.</p>
                        <button type="button" className="btn btn-outline-light btn-lg mt-24 px-5" onClick={onAlertLoginClick} disabled={!mounted}>
                            <i className="icon icon-user fas mr-12"/>
                            <span>Sign In</span>
                            <span className="d-none d-xl-inline"> or Register</span>
                        </button>
                    </div>
                </div>

                <div className="py-4 col-auto col-lg-4 d-flex flex-column justify-content-end">
                    <div className="mx-3">
                        <h4 className="homepage-section-title text-white mt-0">
                            Useful Links
                        </h4>
                        <hr className="border-white my-2" />
                        <ul className="text-white">
                            <li>
                                <a href="https://cgap.hms.harvard.edu" className="text-white">CGAP Homepage</a>
                            </li>
                            <li>
                                <a href="/help/logging-in" className="text-white">Account Setup Guide</a>
                            </li>
                            <li>
                                <a href="/help/tutorials" className="text-white">Video Tutorials</a>
                            </li>
                        </ul>
                    </div>
                </div>

            </div>

        </React.Fragment>
    );
});



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

