import React from 'react';
import PropTypes from 'prop-types';
import memoize from 'memoize-one';
import _ from 'underscore';
import { console, layout, ajax, object } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Schemas } from './../../util';
import { PedigreeDetailPane } from './../components/PedigreeDetailPane';
import PedigreeViz, { PedigreeVizView, isRelationshipNode } from './../../viz/PedigreeViz';
import { FullHeightCalculator } from './../components/FullHeightCalculator';


/**
 * Creates Object mapping Individual `@id` to
 * the generational identifier (or `orderBasedName`)
 * that is present for that Individual node in graph
 * data.
 *
 * @param {{ id: string, orderBasedName: string }[]} objectGraph
 * @returns {Object.<string, string>}
 */
export function idToGraphIdentifier(objectGraph){
    const mapping = {};
    objectGraph.forEach(function(node){
        if (isRelationshipNode(node)) return;
        // We use Individual's `@id` as their dataset entry `id`.
        // If this changes, can change to get from `node.data.individualItem['@id']` instead.
        mapping[node.id] = node.orderBasedName;
    });
    return mapping;
}


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
        const { session, href, context } = this.props;

        // Pass schemas down for use in File Upload Drag and Drop
        const schemas = Schemas.get();
        let indvSchema;
        if (schemas) {
            indvSchema = schemas.Individual;
        }

        // console.log("schemas[individual]", schemas["Individual"]);
        return <PedigreeDetailPane {...pedigreeVizProps} {...{ session, href, context }} schemas={indvSchema} />;
    }

    render(){
        const {
            dataset,
            graphData,
            windowWidth,
            windowHeight,
            containerId = "pedigree-viz-container-cgap",
            visibleDiseases = null,
            scale = 1,
            showOrderBasedName = true
        } = this.props;
        const { isBrowserFullscreen, isPedigreeFullscreen } = this.state;
        const propName = "height"; //(isBrowserFullscreen ? "height" : "minimumHeight");
        const cls = (
            "pedigree-tab-view-body-container" +
            (isBrowserFullscreen ? "browser-is-full-screen" : "") +
            (isPedigreeFullscreen ? " view-is-full-screen" : "")
        );
        // `FullHeightCalculator` will use defaultProps.heightDiff if this is
        // undefined, where default is aligned with fixed page header & footer.
        let heightDiff = undefined;
        if (isPedigreeFullscreen){
            heightDiff = 0;
        }

        const rgs = layout.responsiveGridState(windowWidth);
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
        const rgs = layout.responsiveGridState(windowWidth);
        const enableMouseWheelZoom = (
            rgs !== "xs" && rgs !== "sm" &&
            // 400px minimumHeight (below) + UI height makes window scrollable at under ~ 620px height.
            // Which is bad for mousewheel scrolling.
            windowHeight > 620
        );
        */

        // Will lose ability to move top/bottom with touchpad if this is enabled.
        // Need to consider further.
        const enableMouseWheelZoom = false;

        /**
         * `height` prop gets overriden by FullHeightCalculator @ responsive
         * grid states larger than 'sm' (@see FullHeightCalculator `defaultProps.skipGridStates`).
         */
        const pedigreeVizProps = {
            visibleDiseases, showOrderBasedName,
            scale, enableMouseWheelZoom, detailPaneOpenOffsetWidth,
            filterUnrelatedIndividuals: false,
            renderDetailPane: this.renderDetailPane,
            height: 600,
            width: windowWidth,
            minimumHeight: 400,
            windowWidth // <- Todo - maybe remove dependence on this, supply prop instead if needed..
        };

        if (!dataset && !graphData) {
            console.error("Expected `dataset` or `graphData` to be present");
        }

        return (
            <div id={containerId} className={cls}>
                <FullHeightCalculator {...{ windowWidth, windowHeight, propName, heightDiff }}>
                    { graphData ? // If already have parsed graph data
                        <PedigreeVizView {...pedigreeVizProps} {...graphData} />
                        :
                        <PedigreeViz {...pedigreeVizProps} dataset={dataset} />
                    }
                </FullHeightCalculator>
            </div>
        );
    }

}
