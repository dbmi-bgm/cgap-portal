'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import { console, layout, ajax, object } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';
import { isServerSide } from '@hms-dbmi-bgm/shared-portal-components/es/components/util/misc';
import { responsiveGridState } from '../../util/layout';
import { PedigreeDetailPane } from './PedigreeDetailPane';
import { FullHeightCalculator } from './FullHeightCalculator';






/**
 * Given dataset and options, renders out a pedigree from dataset.
 * Reusable for any PedigreeTabView of any ItemView.
 */
export class PedigreeTabViewBody extends React.PureComponent {

    // Maybe todo: make into class, on windowHeight/Width updates, check if full screen (=== screen.height, ...)
    // And if so, set propName="height" instead.

    /** @todo move to shared-portal-components/util/layout */
    static isBrowserFullscreen(windowHeight){

        if (!windowHeight){
            console.error("No windowHeight available.");
            return false;
        }

        if (document) {
            const isFullscreenState = (
                document.fullscreen ||
                document.fullscreenElement ||
                document.mozIsFullscreen ||
                document.mozFullscreenElement ||
                document.webkitIsFullScreen ||
                document.webkitFullscreenElement
            );
            if (isFullscreenState) return true;
        }
        /*
        let screenH = null;
        if (window && window.screen){
            screenH = window.screen.height;
        }
        if (!screenH){
            console.error("Can't detect screen dimensions, ok if serverside, else unsupported browser.");
            return false;
        }

        if (windowHeight === screenH){
            return true;
        }
        */

        return false;
    }

    static isViewFullscreen(windowHeight){
        if (!document) throw new Error("No document element available");
        const fullscreenElem = (
            document.fullscreenElement ||
            document.mozFullscreenElement ||
            document.webkitFullscreenElement
        );
        const pedigreeContainerElem = document.getElementById("pedigree-viz-container-cgap");
        if (fullscreenElem && pedigreeContainerElem && pedigreeContainerElem === fullscreenElem){
            return true;
        }
        /*
        if (pedigreeContainerElem && pedigreeContainerElem.offsetHeight === windowHeight){
            return true;
        }
        */
        return false;
    }

    constructor(props){
        super(props);
        this.onBrowserSizeChange = _.throttle(this.onBrowserSizeChange.bind(this), 500);
        this.renderDetailPane = this.renderDetailPane.bind(this);
        this.state = {
            isBrowserFullscreen : false,
            isPedigreeFullscreen : false
        };
    }

    componentDidMount(){
        // iOS Safari -specific
        document.addEventListener("webkitfullscreenchange", this.onBrowserSizeChange);
        // Chrome, etc
        document.addEventListener("fullscreenchange", this.onBrowserSizeChange);
    }

    componentWillUnmount(){
        document.removeEventListener("webkitfullscreenchange", this.onBrowserSizeChange);
        document.removeEventListener("fullscreenchange", this.onBrowserSizeChange);
    }

    componentDidUpdate(pastProps){
        const { windowHeight } = this.props;
        if (windowHeight !== pastProps.windowHeight){
            this.onBrowserSizeChange();
        }
    }

    onBrowserSizeChange(){
        console.log("Browser size changed, checking for full screen-ness");
        // Settimeouts might not be needed at all -- could use some testing w. dif browsers.
        setTimeout(()=>{
            const { windowHeight : wh1 } = this.props;
            const isBrowserFullscreen = PedigreeTabViewBody.isBrowserFullscreen(wh1);
            console.info("Went full screen (browser)?", isBrowserFullscreen);

            if (!isBrowserFullscreen) {
                this.setState({
                    isBrowserFullscreen,
                    isPedigreeFullscreen: false
                });
                return;
            }

            setTimeout(()=>{
                const { windowHeight : wh2 } = this.props;
                const isPedigreeFullscreen = PedigreeTabViewBody.isViewFullscreen(wh2);
                this.setState({
                    isBrowserFullscreen,
                    isPedigreeFullscreen
                });

                console.info("Went full screen (pedigree)?", isPedigreeFullscreen);
            }, 100);

        }, 100);
    }

    renderDetailPane(pedigreeVizProps){
        const {
            session, href, context, schemas,
            PedigreeVizLibrary, showAsDiseases,
            availableDiseases, selectedDiseaseIdxMap, onToggleSelectedDisease
        } = this.props;
        const passedDownProps = { PedigreeVizLibrary, session, href, context, schemas, availableDiseases, selectedDiseaseIdxMap, onToggleSelectedDisease, showAsDiseases };
        return <PedigreeDetailPane {...pedigreeVizProps} {...passedDownProps} />;
    }

    render(){
        const {
            dataset,
            graphData,
            windowWidth,
            windowHeight,
            containerId = "pedigree-viz-container-cgap",
            selectedDiseaseIdxMap = null,
            scale = 1,
            showOrderBasedName = true,
            PedigreeVizLibrary = null
        } = this.props;
        const { default: PedigreeViz, PedigreeVizView } = PedigreeVizLibrary || {};
        const { isBrowserFullscreen, isPedigreeFullscreen } = this.state;
        const propName = "height"; //(isBrowserFullscreen ? "height" : "minimumHeight");
        const cls = (
            "pedigree-tab-view-body-container bg-light" +
            // Maybe should have this as data attributes.. eh prly doesn't matter
            (isBrowserFullscreen ? " browser-is-full-screen" : "") +
            (isPedigreeFullscreen ? " view-is-full-screen" : "")
        );
        // `FullHeightCalculator` will use defaultProps.heightDiff if this is
        // undefined, where default is aligned with fixed page header & footer.
        let heightDiff = undefined;
        if (isPedigreeFullscreen){
            heightDiff = 0;
        }

        const rgs = responsiveGridState(windowWidth);
        let detailPaneOpenOffsetWidth = 0;

        if (rgs !== "xs" && rgs !== "sm") {
            // Should be aligned with CSS stylesheet.
            // Tablet or higher size; detail pane opens to side
            if (rgs === "xl") {
                detailPaneOpenOffsetWidth += 400;
            } else {
                detailPaneOpenOffsetWidth += 320;
            }
        }

        /*
        const rgs = responsiveGridState(windowWidth);
        const enableMouseWheelZoom = (
            rgs !== "xs" && rgs !== "sm" &&
            // 400px minimumHeight (below) + UI height makes window scrollable at under ~ 620px height.
            // Which is bad for mousewheel scrolling.
            windowHeight > 620
        );
        */

        // Will lose ability to move top/bottom with touchpad if this is enabled.
        // Need to consider further. Currently is enabled w. ctrl+wheel which might
        // be fine as long as inform of this ability in UX (todo later).
        const enableMouseWheelZoom = false;

        /**
         * `height` prop gets overriden by FullHeightCalculator @ responsive
         * grid states larger than 'sm' (@see FullHeightCalculator `defaultProps.skipGridStates`).
         */
        const pedigreeVizProps = {
            showOrderBasedName,
            scale, enableMouseWheelZoom, detailPaneOpenOffsetWidth,
            "visibleDiseaseIdxMap": selectedDiseaseIdxMap,
            "filterUnrelatedIndividuals": false,
            "renderDetailPane": this.renderDetailPane,
            "height": 600,
            "width": windowWidth,
            "minimumHeight": 400,
            windowWidth // <- Todo - maybe remove dependence on this, supply prop instead if needed..
        };

        if (!dataset && !graphData) {
            console.error("Expected `dataset` or `graphData` to be present");
        }

        console.log("pedigreeviz", PedigreeVizLibrary);

        let body = null;

        if (!PedigreeVizLibrary) {
            body = (
                <div className="py-3 text-center">
                    Loading...
                </div>
            );
        } else if (graphData) {
            // If already have parsed graph data
            body = <PedigreeVizView {...pedigreeVizProps} {...graphData} />;
        } else /* if (dataset) */ {
            // TO TEST USING PedigreeViz.defaultProps.dataset, REMOVE THE IF CHECK HERE
            // If letting PedigreeViz parse on the fly (this mostly for local demo/test data)
            body = <PedigreeViz {...pedigreeVizProps} dataset={dataset} />;
        }

        return (
            <div id={containerId} className={cls}>
                <FullHeightCalculator {...{ windowWidth, windowHeight, propName, heightDiff }}>
                    { body }
                </FullHeightCalculator>
            </div>
        );
    }
}



export class PedigreeFullScreenBtn extends React.PureComponent {

    static getReqFullscreenFxn(){
        if (isServerSide()) { return null; }
        const pedigreeContainerElem = document.getElementById("pedigree-viz-container-cgap");
        if (!pedigreeContainerElem){
            throw new Error("Container element not found");
        }
        return (
            pedigreeContainerElem.requestFullscreen ||
            pedigreeContainerElem.msRequestFullscreen ||
            pedigreeContainerElem.mozRequestFullScreen ||
            pedigreeContainerElem.webkitRequestFullscreen ||
            null
        );
    }

    constructor(props){
        super(props);
        this.onClick = this.onClick.bind(this);
        this.state = {
            visible: false
        };
    }

    componentDidMount(){
        const fxn = PedigreeFullScreenBtn.getReqFullscreenFxn();
        if (typeof fxn === 'function') {
            this.setState({ visible: true });
        }
    }

    onClick(evt){
        if (isServerSide()) { return false; }
        const pedigreeContainerElem = document.getElementById("pedigree-viz-container-cgap");
        if (pedigreeContainerElem.requestFullscreen){
            pedigreeContainerElem.requestFullscreen();
        } else if (pedigreeContainerElem.msRequestFullscreen){
            pedigreeContainerElem.msRequestFullscreen();
        } else if (pedigreeContainerElem.mozRequestFullScreen){
            pedigreeContainerElem.mozRequestFullScreen();
        } else if (pedigreeContainerElem.webkitRequestFullscreen){
            pedigreeContainerElem.webkitRequestFullscreen();
        } else {
            console.error("Couldn't go full screen");
            Alerts.queue({
                'title' : "Couldn't go full screen",
                'style' : "danger"
            });
            this.setState({ visible: false });
        }
    }

    render(){
        const { visible } = this.state;
        if (!visible) return null;
        return (
            <button type="button" className="btn btn-outline-dark ml-05 d-none d-md-inline-block"
                onClick={this.onClick} data-tip="Maximize pedigree to take up full screen">
                <i className="icon icon-expand fas fw"/>
                <span className="d-md-inline d-lg-none ml-08">Full Screen</span>
            </button>
        );
    }
}
