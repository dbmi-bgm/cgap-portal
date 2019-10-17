'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';
import ReactTooltip from 'react-tooltip';
import _ from 'underscore';

import { console, ajax } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { LocalizedTime } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/LocalizedTime';


export const GuestHomeView = React.memo(function GuestHomeView(props){
    return (
        <div className="container home-content-area" id="content">
            <div className="row mt-5">
                <div className="col-xs-12 col-md-12">
                    <h2 className="homepage-section-title">Marketing Stuff Here (maybe)</h2>
                    <h4 className="text-500">(maybe) Publicly-viewable cases as entrance to crowdsourcing UI/UX</h4>
                    <p>

                    </p>
                </div>
            </div>
            <div className="row mt-3">
                <div className="col-xs-12 col-md-5 pull-right">
                    <LinksColumn {..._.pick(props, 'windowWidth')} />
                </div>
            </div>
        </div>
    );
});



const ExternalLinksColumn = React.memo(function ExternalLinksColumn(props){
    return (
        <div className="homepage-links-column external-links">
            {/* <h3 className="text-300 mb-2 mt-3">External Links</h3> */}
            <h4 className="text-400 mb-15 mt-25">External Links</h4>
            ( layout & location not final / TBD )
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
                    <a href="https://forome.org/" target="_blank" rel="noopener noreferrer" className="external-link">
                        <span>Forome</span>
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
