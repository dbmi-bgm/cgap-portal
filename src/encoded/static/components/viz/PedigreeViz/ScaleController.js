'use strict';

import React from 'react';
import { requestAnimationFrame as raf } from '@hms-dbmi-bgm/shared-portal-components/es/components/viz/utilities';


export class ScaleController extends React.PureComponent {

    static defaultProps = {
        minScale: 0.01,
        maxScale: 1,
        initialScale: 1,
        zoomToExtentsOnMount: true
    };

    constructor(props){
        super(props);
        this.setScale = this.setScale.bind(this);
        this.handleWheelMove = this.handleWheelMove.bind(this);
        this.handleDimensionsChanged = this.handleDimensionsChanged.bind(this);
        this.state = {
            scale: null,
            minScale: null,
            containerWidth: null,
            containerHeight: null
        };
    }

    setScale(scaleToSet, cb){
        this.setState(function(
            { minScale: stateMinScale },
            { minScale: propMinScale, maxScale }
        ){
            const scale = (Math.max(Math.min(maxScale, scaleToSet), stateMinScale || propMinScale));
            return { scale };
        }, cb);
    }

    /**
     * Not yet used/implemented --
     * don't want this active by default unless are full screen or something
     * due to window itself being vertically scrollable in many cases.
     *
     * To maximize re-usability,
     * We should have PedigreeViz accept a prop `mousewheelZoomEnabled` and pass
     * it down to here to see whether to enable this or not.
     * Parent component can decide if are full screen and/or whether or not to zoom on mousewheel.
     */
    handleWheelMove(evt){
        const { deltaY, deltaX } = evt;
        if (Math.abs(deltaX) > Math.abs(deltaY)){
            return;
        }
        evt.preventDefault();
        evt.stopPropagation();
        this.setState(function({ scale: prevScale = 1 }, { minScale, maxScale }){
            const scaleUnbounded = prevScale -= (deltaY * 0.001);
            const scale = (Math.min(maxScale, Math.max(minScale, scaleUnbounded)));
            console.log('E2', prevScale, scaleUnbounded, scale);
            return { scale };
        });
    }

    handleDimensionsChanged({ containerWidth, containerHeight, graphWidth, graphHeight }){
        const { onDimensionsChanged, minScale: propMinScale, maxScale } = this.props;
        if (typeof onDimensionsChanged === "function"){
            onDimensionsChanged(...arguments);
        }

        this.setState(function({
            containerWidth: pastWidth,
            containerHeight: pastHeight,
            scale: currScale,
            minScale: pastMinScale
        }, { zoomToExtentsOnMount }){
            if (!containerWidth || !containerHeight) {
                return null;
            }
            const scaleUnbounded = Math.min(
                (containerWidth / graphWidth),
                (containerHeight / graphHeight)
            );
            const minScale = (Math.min(maxScale, Math.max(propMinScale, scaleUnbounded)));
            const retObj = { containerWidth, containerHeight, minScale };

            // First time that we've gotten dimensions -- set scale to fit.
            // Also, if new minScale > currScale or we had scale === minScale before.
            if (minScale > currScale || pastMinScale === currScale || (zoomToExtentsOnMount && (!pastHeight || !pastWidth))) {
                retObj.scale = minScale;
            }

            return retObj;
        });
    }

    render(){
        const { children, initialScale = null, minScale: propMinScale, ...passProps } = this.props;
        const { scale, minScale } = this.state;
        const childProps = {
            ...passProps,
            scale: scale || initialScale || 1,
            minScale: minScale || propMinScale,
            setScale: this.setScale,
            onDimensionsChanged: this.handleDimensionsChanged
        };
        return React.Children.map(children, (child) => React.cloneElement(child, childProps) );
    }

}

export class ScaleControls extends React.PureComponent {

    static defaultProps = {
        /** Align with CSS transition length, if one is set */
        scaleChangeInterval: 20, // = a bit over 30fps
        scaleChangeUpFactor: 1.01,
        scaleChangeDownFactor: 0.99
    };

    constructor(props){
        super(props);
        this.onZoomOutDown = this.onZoomOutDown.bind(this);
        this.onZoomOutUp = this.onZoomOutUp.bind(this);
        this.onZoomInDown = this.onZoomInDown.bind(this);
        this.onZoomInUp = this.onZoomInUp.bind(this);
        this.cleanupAfterPress = this.cleanupAfterPress.bind(this);
        this.state = {
            zoomOutPressed: false,
            zoomInPressed: false
        };

        // Not the most reactful thing to store state data outside of state,
        // but worthwhile here for us for performance
        // (skip component lifecycle; requestAnimationFrame skipping repaint anyway so would only add lag)
        this.currentInterval = null;
        this.currentTempZoom = null;
    }

    cleanupAfterPress(){
        clearInterval(this.currentInterval);
        this.currentInterval = null;
        this.currentTempZoom = null;
    }

    /**
     * Transitions when using requestAnimationFrame come out smoother
     * than with `setInterval` alone.
     */
    onZoomOutDown(evt){
        evt.preventDefault();
        evt.stopPropagation();
        const { setScale, scaleChangeInterval, scaleChangeDownFactor, scale: initScale } = this.props;
        this.setState({ zoomOutPressed: true }, ()=>{

            this.currentTempZoom = initScale * scaleChangeDownFactor;
            this.currentInterval = setInterval(()=>{
                const { scale, minScale } = this.props;
                const { zoomOutPressed } = this.state;
                if (!zoomOutPressed){
                    this.cleanupAfterPress();
                    return;
                }
                if (scale <= minScale){
                    // Button becomes disabled so `onZoomOutUp` is not guaranteed to be called.
                    this.setState({ zoomOutPressed: false });
                    return;
                }
                this.currentTempZoom = this.currentTempZoom * scaleChangeDownFactor;
            }, scaleChangeInterval);

            const performZoom = () => {
                if (!this.currentTempZoom) return false; // End
                setScale(this.currentTempZoom);
                raf(performZoom);
            };

            raf(performZoom);
        });
    }

    onZoomOutUp(evt){
        evt.preventDefault();
        evt.stopPropagation();
        this.cleanupAfterPress();
        this.setState({ zoomOutPressed: false });
    }

    onZoomInDown(evt){
        evt.preventDefault();
        evt.stopPropagation();
        const { setScale, scaleChangeInterval, scaleChangeUpFactor, scale: initScale } = this.props;
        this.setState({ zoomInPressed: true }, ()=>{

            this.currentTempZoom = initScale * scaleChangeUpFactor;
            this.currentInterval = setInterval(()=>{
                const { scale, maxScale } = this.props;
                const { zoomInPressed } = this.state;
                if (!zoomInPressed){
                    this.cleanupAfterPress();
                    return;
                }
                if (scale >= maxScale){
                    // Button becomes disabled so `onZoomInUp` is not guaranteed to be called.
                    this.setState({ zoomInPressed: false });
                }
                this.currentTempZoom = this.currentTempZoom * scaleChangeUpFactor;
            }, scaleChangeInterval);

            const performZoom = () => {
                if (!this.currentTempZoom) return false; // End
                setScale(this.currentTempZoom);
                raf(performZoom);
            };

            raf(performZoom);
        });
    }

    onZoomInUp(evt){
        evt.preventDefault();
        evt.stopPropagation();
        this.cleanupAfterPress();
        this.setState({ zoomInPressed: false });
    }

    render(){
        const {
            scale = null,
            setScale = null,
            minScale = 0.1,
            maxScale = 1
        } = this.props;

        if (typeof setScale !== "function" || typeof scale !== "number" || isNaN(scale)) {
            return null;
        }

        return (
            <div className="zoom-controls-container">
                <div className="zoom-buttons-row">
                    <button type="button" className="zoom-btn zoom-out"
                        onMouseDown={this.onZoomOutDown} onMouseUp={this.onZoomOutUp}
                        disabled={minScale >= scale}>
                        <i className="icon icon-fw icon-search-minus fas"/>
                    </button>
                    <button type="button" className="zoom-btn zoom-in"
                        onMouseDown={this.onZoomInDown} onMouseUp={this.onZoomInUp}
                        disabled={maxScale <= scale}>
                        <i className="icon icon-fw icon-search-plus fas"/>
                    </button>
                </div>
                {/* @todo: slider */}
            </div>
        );
    }
}
