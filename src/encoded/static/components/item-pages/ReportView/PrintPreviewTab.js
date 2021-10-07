'use strict';

import React from 'react';
import ReactDOMServer from 'react-dom/server';
import PropTypes from 'prop-types';
import _ from 'underscore';
import { Previewer } from 'pagedjs';
import { console, layout, ajax } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { DeferMount } from './../../util/layout';



export class PrintPreviewTab extends React.Component {

    render(){
        return (
            <React.Fragment>
                <h3 className="tab-section-title container-wide">
                    Print Preview
                </h3>
                <hr className="tab-section-title-horiz-divider"/>
                <div className="container-wide print-preview-tab-container bg-light py-3 mh-inner-tab-height-full">
                    <DeferMount delay={400}>
                        <PrintPreviewPane/>
                    </DeferMount>
                </div>
            </React.Fragment>
        );
    }

}
PrintPreviewTab.getTabObject = function(props) {
    return {
        'tab' : (
            <React.Fragment>
                <i className="icon icon-file-alt far icon-fw"/>
                <span>Preview</span>
            </React.Fragment>
        ),
        'key' : 'preview',
        'content' : <PrintPreviewTab {...props} />
    };
};


/**
 * @todo Code-split-out JS for this (`Previewer`)
 */
export class PrintPreviewPane extends React.Component {

    constructor(props){
        super(props);

        this.state = {
            "isRendered" : false
        };

        this.renderTargetRef = React.createRef();
        this.styleElementRef = React.createRef();

        this.previewerInstance = null;
    }

    componentDidMount(){
        this.previewerInstance = new Previewer();

        // TODO: Create JSX, render it to string, pass as first param to previewInstance.

        const renderedMarkupText = ReactDOMServer.renderToStaticMarkup(
            <div className="render-source">
                <h3>Hello World</h3>
            </div>
        );

        const styleRulesText = `
            :root {
                --report-attribution-footer-content: "Testing one two three";
            }

            @page {
                size: $print-page-size;
                margin: 0.75in;
                background: #fff;
                font-size: 12pt;
                color: #000;

                @bottom-right-corner {
                    content: "Page " counter(page) " of " counter(pages);
                    padding-right: 1.5ch;
                }

                @bottom-left {
                    content: '${"Hello World One Two Three"}';
                    padding-right: 1.5ch;
                }
            }
        `;

        this.previewerInstance.preview(
            renderedMarkupText,
            [{ "arbitrarily-named-key": styleRulesText }],
            this.renderTargetRef.current
        ).then((flow)=>{
            console.log("Rendered", flow.total);
            this.setState({ "isRendered": true });
        });
    }

    render(){
        const { isRendered = false } = this.state;
        return (
            <React.Fragment>
                <div className="print-preview-pane" ref={this.renderTargetRef} style={{ "opacity": isRendered ? 1 : 0 }}>
                    {/* <i className="icon icon-circle-notch fas icon-spin mx-auto icon-2x text-secondary"/> (doesnt get auto-removed) */}
                </div>
            </React.Fragment>
        );
    }
}
