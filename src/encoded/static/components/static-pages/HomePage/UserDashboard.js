'use strict';

import React from 'react';
import _ from 'underscore';


export const UserDashboard = React.memo(function UserDashboard({ windowHeight, windowWidth }){
    // We can turn container into container-wide to expand width
    // We can convert dashboard-header into tabs, similar to Item pages.
    // We can do novel stuff like sidebar menu or something.
    // Various options.

    // Since UserDashboard visible, we assume user is logged in.
    // We use email as unique component key for components
    // which need to make AJAX requests. This way we can just
    // re-initialize component upon 'Impersonate User' action
    // insteat of handling w. componentDidUpdate or similar.
    // const { uuid: userUUID = null } = JWT.getUserDetails() || {};

    return (
        <React.Fragment>

            <div className="dashboard-header">
                <div className="container-wide d-flex align-items-center justify-content-between">
                    <div className="align-items-center d-flex">
                        <i className="icon icon-fw icon-home fas mr-1" />
                        <h5 className="mt-0 mb-0 text-400">Home Dashboard</h5>
                    </div>
                </div>
            </div>

            {/* We apply .bg-light class here instead of .container-wide child divs because home-dashboard-area height is calculated off of window height in stylesheet */}
            <div className="home-dashboard-area bg-light d-flex justify-content-center align-items-center align-center justify-content-center align-items-center items-center" id="content">
                <div className="d-flex flex-column mx-4 justify-content-center align-items-center">
                    <div className="">
                        What type of analysis would you like to do?
                    </div>
                    <div className="mt-2 w-100 d-flex">
                        <a href="/search/?type=Case" className="btn btn-primary p-10">
                            <i className="fas icon icon-archive mr-05"></i>Germline Cases
                        </a>
                        <a href="/search/?type=SomaticAnalysis" className="btn btn-primary ml-05 p-10">
                            <i className="fas icon icon-spinner mr-05"></i>Somatic Analyses
                        </a>
                    </div>
                </div>
            </div>
        </React.Fragment>
    );
});
