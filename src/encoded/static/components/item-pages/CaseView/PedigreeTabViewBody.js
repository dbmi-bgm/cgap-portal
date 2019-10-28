import React from 'react';
import PropTypes from 'prop-types';
import memoize from 'memoize-one';
import _ from 'underscore';
import { console, layout, ajax, object } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { PedigreeDetailPane } from './../components/PedigreeDetailPane';
import PedigreeViz, { PedigreeVizView } from './../../viz/PedigreeViz';
import { FullHeightCalculator } from './../components/FullHeightCalculator';


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
        return <PedigreeDetailPane {...pedigreeVizProps} {...{ session, href, context }} />;
    }

    render(){
        const {
            dataset = null,
            graphData = null,
            windowWidth,
            windowHeight,
            visibleDiseases = null,
            scale = 1,
            showOrderBasedName = true
        } = this.props;
        const { isBrowserFullscreen, isPedigreeFullscreen } = this.state;
        const propName = "height"; //(isBrowserFullscreen ? "height" : "minimumHeight");
        const cls = (
            (isBrowserFullscreen ? "browser-is-full-screen" : "") +
            (isPedigreeFullscreen ? " view-is-full-screen" : "")
        );
        let heightDiff = undefined;
        if (isPedigreeFullscreen){
            heightDiff = 0;
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
            scale, enableMouseWheelZoom,
            filterUnrelatedIndividuals: false,
            renderDetailPane: this.renderDetailPane,
            height: 600,
            width: windowWidth,
            minimumHeight: 400,
            windowWidth // <- Todo - maybe remove dependence on this, supply prop instead if needed..
        };

        if (!dataset && !graphData) {
            throw new Error("Expected `dataset` or `graphData` to be present");
        }

        return (
            <div id="pedigree-viz-container-cgap" className={cls}>
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
