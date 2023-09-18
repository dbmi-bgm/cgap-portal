'use strict';

import React, { useEffect, useState } from 'react';
import ReactDOMServer from 'react-dom/server';
import PropTypes from 'prop-types';
import _ from 'underscore';
import { console, layout, ajax } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';


let pagedjsDependencies = null;

/**
 * Loads in and caches PagedJS library.
 * Multiple instances of this component may be used with them all sharing one PagedJS library.
 */
export function PagedJSDependencyLoader({ children }){
    const [ isDependencyLoaded, setIsDependencyLoaded ] = useState(!!pagedjsDependencies);

    useEffect(function(){
        if (isDependencyLoaded) {
            // Skip.
            return;
        }
        // Code-split out and load in PagedJS as separate library
        import(
            /* webpackChunkName: "pagedjs-library" */
            'pagedjs'
        ).then((loadedDeps) =>{
            pagedjsDependencies = loadedDeps;
            setIsDependencyLoaded(true);
        });
    }, [ isDependencyLoaded ]);

    if (!isDependencyLoaded) {
        return children;
    }

    // Pass down pagedJS as dependency.
    return React.Children.map(children, function(child){
        if (!React.isValidElement(child)) return child;
        if (typeof child.type !== "function") return child;
        return React.cloneElement(child, { "pagedjs": pagedjsDependencies });
    });
}

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
        "loadingPlaceholder": PropTypes.element,
        "pagedjs": PropTypes.shape({
            "Previewer": PropTypes.func
        })
    };

    static defaultProps = {
        "loadingPlaceholder" : <PrintPreviewPaneLoadingIndicator footer="Creating pages..." />
    };

    constructor(props){
        super(props);
        this.renderReportIntoRef = this.renderReportIntoRef.bind(this);

        this.state = {
            "isRendered" : false
        };

        this.renderTargetRef = React.createRef();

        this.previewerInstance = null; // Initialized after mount
    }

    /**
     * Don't update/re-render if changed children or styleRulesText -- these shouldn't ever update.
     * Update: Maybe they will, if we allow people to adjust report settings and then preview in real-ish time.
     * So might remove this shouldComponentUpdate.
     *
     * @returns {boolean} True if should update.
     */
    shouldComponentUpdate(pastProps, pastState){
        const { onRenderComplete, pagedjs } = this.props;
        const { isRendered } = this.state;
        const shouldUpdate = (
            pastProps.pagedjs !== pagedjs ||
            pastState.isRendered !== isRendered ||
            pastProps.onRenderComplete !== onRenderComplete
        );
        return shouldUpdate;
    }

    componentDidMount(){
        const { pagedjs = null } = this.props;
        const { isRendered = false } = this.state;
        if (pagedjs !== null && !isRendered) {
            this.renderReportIntoRef();
        }
    }

    /**
     * Render if we didn't have pagedjs library available prior.
     * Does not currently re-render pages if children/content-in-report
     * changes but we can enable this in future once have a UX that
     * requires it. It might make more sense, if can edit report in real-ish
     * time at all, to require manual "press apply to rerender".
     */
    componentDidUpdate(pastProps){
        const { pagedjs = null } = this.props;
        if (!pastProps.pagedjs && pagedjs) {
            this.renderReportIntoRef();
        }
    }

    renderReportIntoRef(){
        const {
            children,
            styleRulesText,
            onRenderComplete = null,
            pagedjs: { Previewer } = {}
        } = this.props;

        this.previewerInstance = this.previewerInstance || new Previewer();

        const renderedMarkupText = ReactDOMServer.renderToStaticMarkup(children);

        this.previewerInstance.preview(
            renderedMarkupText,
            [{ "arbitrarily-named-key": styleRulesText }],
            this.renderTargetRef.current
        ).then((flow)=>{
            console.log(`PrintPreviewPane: Rendered ${flow.total} pages.`);
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
