'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';
import ReactTooltip from 'react-tooltip';
import _ from 'underscore';


export const GuestHomeView = React.memo(function GuestHomeView(props){
    return (
        <React.Fragment>
            <div className="jumbotron mb-0 rounded-0">
                <div className="container">
                    <h2 className="homepage-section-title text-white">Streamline Your Bioinformatics Pipeline</h2>
                    <hr className="border-white" />
                    <h4 className="text-500 text-white">Get Actionable Data, Fast.</h4>
                    <p className="text-white col-12 col-lg-9 px-0">
                        CGAP (the Clinical Genome Analysis Project) is a web-based clinical and research application
                        for analysis, annotation, visualization and reporting of genomic data. An ongoing effort of
                        Harvard Medical School's Department of Biomedical Informatics and developed in close connection
                        with clinicians at BGM and UDN, CGAP
                        merges powerful variant discovery workflows with clinical accuracy and reporting capabilities.
                    </p>
                </div>
            </div>
            <div className="container home-content-area" id="content">
                <div className="row mb-2">
                    <div className="col-xs-12 col-md-4">
                        <h4 className="text-400 mb-15 mt-25">Discover <br/>Novel Pathogenic Variants</h4>
                        <div style={{
                            width: "100%",
                            height: "100px",
                            backgroundImage: "url('/static/img/Testtubes.jpeg')",
                            backgroundPositionY: "center",
                            backgroundSize: "cover"
                        }} />
                        <p style={{ marginTop: "1rem" }}>
                            Effortlessly filter SNV/Indels and SVs, browse our annotation database, and work with intuitive, cutting-edge visualization tools.
                        </p>
                    </div>
                    <div className="col-xs-12 col-md-4">
                        <h4 className="text-400 mb-15 mt-25">Collaborate <br/>in the Clinic or the Lab</h4>
                        <div style={{
                            width: "100%",
                            height: "100px",
                            backgroundImage: "url('/static/img/Research.jpeg')",
                            backgroundPositionY: "center",
                            backgroundSize: "cover"
                        }} />
                        <p style={{ marginTop: "1rem" }}>
                            Keep track of interpretation notes, publish customizable reports, and export findings in a flexible, but <strong>CLIA-compatible</strong> workflow.
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
                        <span>Undiagnosed Diseases Network (UDN)</span>
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
