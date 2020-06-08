'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';
import ReactTooltip from 'react-tooltip';
import _ from 'underscore';


export const GuestHomeView = React.memo(function GuestHomeView(props){
    return (<React.Fragment>
        <div className="jumbotron mb-0" style={{ borderRadius: 0, backgroundImage: "url('/static/img/homepage-banner3.jpeg')", backgroundSize: "cover" }}>
            <div className="container">
            <h2 style={{ color: "#ffffff" }} className="homepage-section-title">Streamline Your Bioinformatics Pipeline</h2>
                <hr style={{ borderColor: "#ffffff"}} />
                <h4 style={{ color: "#ffffff" }} className="text-500">Get Actionable Data, Fast.</h4>
                <p style={{ color: "#ffffff", maxWidth: "70%" }}>
                    CGAP (the Clinical Genome Analysis Project) lorem ipsum dolor sit amet, consectetur adipiscing elit, 
                    sed do eiusmod tempor Harvard Medical School incididunt ut labore et dolore magna aliqua. 
                    Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris 
                    nisi ut aliquip ex ea commodo consequat.
                </p>
                {/* <button className="btn btn-outline-light btn-large">Request More Info</button> */}
            </div> 
        </div>
        <div className="container home-content-area" id="content">
            <div className="row">
                <div className="col-xs-12 col-md-4">
                    <h4 className="text-400 mb-15 mt-25">Discover Novel Pathogenic Variants</h4>
                    <div style={{ 
                        width: "100%",
                        height: "100px",
                        backgroundImage:"url('/static/img/Testtubes.jpeg')",
                        backgroundPositionY: "center",
                        backgroundSize: "cover"
                    }}></div>
                    <p style={{ marginTop: "1rem"}}>
                    Excepteur sint occaecat cupidatat non in reprehenderit in
                    proident, sunt in culpa qui officia deserunt mollit anim id est laborum. 
                    </p>
                </div>
                <div className="col-xs-12 col-md-4">
                    <h4 className="text-400 mb-15 mt-25">Collaborate in the Clinic or the Lab</h4>
                    <div style={{ 
                        width: "100%",
                        height: "100px",
                        backgroundImage:"url('/static/img/Research.jpeg')",
                        backgroundPositionY: "center",
                        backgroundSize: "cover"
                    }}></div>
                    <p style={{ marginTop: "1rem"}}>
                    Duis aute irure dolor in reprehenderit in voluptate velit esse cillum 
                    dolore <strong>CLIA-compatible workflow</strong> eu fugiat nulla pariatur. 
                    </p>
                </div>
                <div className="col-xs-12 col-md-4 pull-right">
                    <LinksColumn {..._.pick(props, 'windowWidth')} />
                </div>
            </div>
        </div>
    </React.Fragment>
    );
});



const ExternalLinksColumn = React.memo(function ExternalLinksColumn(props){
    return (
        <div className="homepage-links-column external-links">
            {/* <h3 className="text-300 mb-2 mt-3">External Links</h3> */}
            <h4 className="text-400 mb-15 mt-25">Our Partners</h4>
            <div className="links-wrapper clearfix">
                <div className="link-block">
                    <a href="https://dbmi.hms.harvard.edu/" target="_blank" rel="noopener noreferrer" className="external-link">
                        <span>HMS DBMI</span>
                    </a>
                </div>
                <div className="link-block">
                    <a href="https://www.brighamandwomens.org/medicine/genetics/genetics-genomic-medicine-service" target="_blank" rel="noopener noreferrer" className="external-link">
                        <span>Brigham Genomic Medicine</span>
                    </a>
                </div>
                <div className="link-block">
                    <a href="https://undiagnosed.hms.harvard.edu/" target="_blank" rel="noopener noreferrer" className="external-link">
                        <span>Undiagnosed Diseased Network (UDN)</span>
                    </a>
                </div>
                <div className="link-block">
                    <a href="http://dcic.4dnucleome.org/" target="_blank" rel="noopener noreferrer" className="external-link">
                        <span>4DN DCIC</span>
                    </a>
                </div>
            </div>
            <br/>
        </div>
    );
});


const LinksColumn = React.memo(function LinksColumn(props){
    return (
        <div className="homepage-links">
            <ExternalLinksColumn />
        </div>
    );
});
