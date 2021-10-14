'use strict';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReactDOMServer from 'react-dom/server';
import PropTypes from 'prop-types';
import _ from 'underscore';
import { Previewer } from 'pagedjs';
import { console, layout, ajax } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';



export function PrintPreviewPaneLoadingIndicator(props){
    const { footer } = props;
    const useFooter = footer ? (
        typeof footer === "string" ?
            <React.Fragment>
                <br/>
                <span className="d-inline-block pt-12 pb-16 text-small">
                    { footer }
                </span>
            </React.Fragment>
            : footer
    ) : null;
    return (
        <div className="text-center py-3">
            <i className="icon icon-circle-notch fas icon-spin icon-3x text-muted"/>
            { useFooter }
        </div>
    );
}


/**
 * @implements shouldComponentUpdate
 * @todo Code-split-out JS for this (pagedjs's `Previewer`)
 * @todo Move into own reusable file, maybe into SPC.
 */
export class PrintPreviewPane extends React.Component {

    static propTypes = {
        "children": PropTypes.oneOfType([PropTypes.array, PropTypes.element]),
        "styleRulesText": PropTypes.string,
        "onRenderComplete": PropTypes.func,
        "loadingPlaceholder": PropTypes.element
    };

    static defaultProps = {
        "loadingPlaceholder" : <PrintPreviewPaneLoadingIndicator footer="Creating pages..." />
    };

    constructor(props){
        super(props);

        this.state = {
            "isRendered" : false
        };

        this.renderTargetRef = React.createRef();
        this.styleElementRef = React.createRef();

        this.previewerInstance = null;
    }

    shouldComponentUpdate(pastProps, pastState){
        const { onRenderComplete } = this.props;
        const { isRendered } = this.state;
        const shouldUpdate = (
            pastState.isRendered !== isRendered ||
            pastProps.onRenderComplete !== onRenderComplete
        );

        // Don't update/re-render if changed children or styleRulesText -- these shouldn't ever update.
        return shouldUpdate;
    }

    componentDidMount(){
        const { children, styleRulesText, onRenderComplete = null } = this.props;
        this.previewerInstance = new Previewer();

        // TODO: Create JSX, render it to string, pass as first param to previewInstance.

        const renderedMarkupText = ReactDOMServer.renderToStaticMarkup(children);

        this.previewerInstance.preview(
            renderedMarkupText,
            [{ "arbitrarily-named-key": styleRulesText }],
            this.renderTargetRef.current
        ).then((flow)=>{
            console.log("Rendered", flow.total);
            this.setState({ "isRendered": true }, onRenderComplete);
        });
    }

    render(){
        const { loadingPlaceholder } = this.props;
        const { isRendered = false } = this.state;
        return (
            <React.Fragment>
                { !isRendered ? loadingPlaceholder : null }
                <div className="print-preview-pane" ref={this.renderTargetRef} style={{ "opacity": isRendered ? 1 : 0 }}>
                    {/* <i className="icon icon-circle-notch fas icon-spin mx-auto icon-2x text-secondary"/> (doesnt get auto-removed) */}
                </div>
            </React.Fragment>
        );
    }
}
