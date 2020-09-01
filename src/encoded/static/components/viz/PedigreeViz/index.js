'use strict';

import React from 'react';
import memoize from 'memoize-one';
import { path as d3Path } from 'd3-path';
/** @todo Pull this out into here if making a lib */
import { requestAnimationFrame as raf, cancelAnimationFrame } from '@hms-dbmi-bgm/shared-portal-components/es/components/viz/utilities';
import { isRelationship } from './data-utilities';
import { graphToDiseaseIndices, orderNodesBottomRightToTopLeft } from './layout-utilities-drawing';
import { GraphTransformer, buildGraphData } from './GraphTransformer';
import { ScaleController, ScaleControls, scaledStyle } from './ScaleController';
import { SelectedNodeController } from './SelectedNodeController';
import { IndividualsLayer } from './IndividualsLayer';
import { IndividualNodeShapeLayer } from './IndividualNodeShapeLayer';
import { RelationshipNodeShapeLayer } from './RelationshipNodeShapeLayer';
import { EdgesLayer } from './EdgesLayer';
import { pedigreeVizPropTypes, pedigreeVizViewPropTypes } from './prop-types';
import { pedigreeVizDefaultProps, pedigreeVizViewDefaultProps } from './default-props';


/**
 * Primary component to feed data into.
 * May opt to pull out and separately use `GraphTransformer` or `buildGraphData` and then render out
 * `PedigreeVizView` with its resulting data. This might be useful when want to use data from resulting
 * `objectGraph`, such as generation identifiers.
 *
 * @export
 * @see https://s3-us-west-2.amazonaws.com/utsw-patientcare-web-production/documents/pedigree.pdf
 * @todo Many things, including
 *  - Texts (and containing rect) for markers such as stillBirth, age, ECT, age deceased, pregnancy info, etc.
 *    - Will keep in SVG instead of HTML for simpler exports/printing.
 *  - Texts (center of shape) for "P" (pregnancy), # of grouped individuals.
 *    - Handle grouped individuals (todo: requirements need to be defined)
 *    - Figure out placement if circle of dots or rect of partitions are present (also centered within shape)
 *       - Maybe add to side if something already in center (?)
 *  - Twins of different specificites (requires additions to bounding box calculations, edge segments, etc.)
 */
function PedigreeViz(props){
    const { dataset, dimensionOpts, filterUnrelatedIndividuals, ...viewProps } = props;
    return (
        <GraphTransformer {...{ dataset, dimensionOpts, filterUnrelatedIndividuals }}>
            <PedigreeVizView {...viewProps} />
        </GraphTransformer>
    );
}
PedigreeViz.propTypes = pedigreeVizPropTypes;
PedigreeViz.defaultProps = pedigreeVizDefaultProps;


/**
 * @export
 * @todo
 * - Possibly move selected node state up into here.
 * - Eventually create new "EditingController" component
 *   and wrap 1 of these components.
 * - Define propTypes.
 */
const PedigreeVizView = React.memo(function PedigreeVizView(props){
    const {
        objectGraph, onNodeSelected, onDataChanged,
        zoomToExtentsOnMount, initialScale,
        enableMouseWheelZoom, enablePinchZoom,
        graphWidth, graphHeight,
        height, width, minimumHeight,
        detailPaneOpenOffsetWidth,
        detailPaneOpenOffsetHeight,
        disableSelect,
        ...passProps
    } = props;

    // May be overriden in `DetailPaneOffsetContainerSize`
    const containerHeight = height || Math.max(minimumHeight, graphHeight);
    const containerWidth = width || undefined;

    const scaleProps = {
        zoomToExtentsOnMount, initialScale, enableMouseWheelZoom, enablePinchZoom,
        graphWidth, graphHeight
    };

    const pedigreeViewProps = {
        ...passProps, objectGraph,
        graphWidth, graphHeight,
        disableSelect,
        innerHeight: height
    };

    /**
     * `SelectedNodeController` provides & passes down:
     *   `selectedNode`, `hoveredNode`, `onNodeSelect`, `onNodeUnselect`, `onNodeMouseIn`, ...
     *
     * `DetailPaneOffsetContainerSize` provides & passes down:
     *   `containerWidth` & `containerHeight` (adjusted)
     *
     * `ScaleController` provides & passes down:
     *   `scale`, `minScale`, `maxScale`, `setScale`, `onMount`, `onUnmount`
     */
    return (
        <SelectedNodeController {...{ onNodeSelected, onDataChanged, objectGraph, disableSelect }}>
            <DetailPaneOffsetContainerSize {...{ containerWidth, containerHeight, detailPaneOpenOffsetWidth, detailPaneOpenOffsetHeight }}>
                <ScaleController {...scaleProps}>
                    <PedigreeVizViewUserInterface {...pedigreeViewProps} />
                </ScaleController>
            </DetailPaneOffsetContainerSize>
        </SelectedNodeController>
    );
});
PedigreeVizView.propTypes = pedigreeVizViewPropTypes;
PedigreeVizView.defaultProps = pedigreeVizViewDefaultProps;

const DetailPaneOffsetContainerSize = React.memo(function DetailPaneOffsetContainerSize(props){
    const {
        children,
        selectedNode,
        containerWidth: propContainerWidth,
        containerHeight: propContainerHeight,
        detailPaneOpenOffsetWidth,
        detailPaneOpenOffsetHeight,
        ...passProps
    } = props;
    let containerHeight = propContainerHeight;
    let containerWidth = propContainerWidth;
    if (selectedNode){
        if (typeof detailPaneOpenOffsetHeight === "number" && typeof containerHeight === "number"){
            containerHeight -= detailPaneOpenOffsetHeight;
        }
        if (typeof detailPaneOpenOffsetWidth === "number" && typeof containerWidth === "number"){
            containerWidth -= detailPaneOpenOffsetWidth;
        }
    }

    const childProps = { ...passProps, selectedNode, containerWidth, containerHeight };

    return React.Children.map(children, function(child){
        return React.cloneElement(child, childProps);
    });

});


/**
 * We increment/decrement this in `PedigreeVizViewUserInterface`
 * constructor so that all have a unique identifier for svg
 * clipDef ids & similar cases.
 */
let createdInstanceCount = 0;


class PedigreeVizViewUserInterface extends React.PureComponent {

    static diseaseToIndex(visibleDiseases, objectGraph){
        let diseaseToIndex;
        if (Array.isArray(visibleDiseases)){
            diseaseToIndex = {};
            visibleDiseases.forEach(function(disease, index){
                diseaseToIndex[disease] = index + 1;
            });
            return diseaseToIndex;
        } else {
            return graphToDiseaseIndices(objectGraph);
        }
    }

    static visAreaTransform(scaledVizStyle, containerHeight, containerWidth){
        const hasExtraHeight = containerHeight >= scaledVizStyle.height;
        const hasExtraWidth = (typeof containerWidth === "number" && containerWidth >= scaledVizStyle.width);
        const x = hasExtraWidth ? (containerWidth - scaledVizStyle.width) / 2 : 0;
        const y = hasExtraHeight ? (containerHeight - scaledVizStyle.height) / 2 : 0;
        return `translate3d(${x}px, ${y}px, 0) ` + scaledVizStyle.transform;
    }

    static maxHeightIndex(objectGraph){
        return objectGraph.reduce(function(m, node){
            const { _drawing: { heightIndex = 0 } } = node;
            return Math.max(m, heightIndex);
        }, 0);
    }

    static defaultProps = {
        'width': 600,
        "scale" : 1,
        "visibleDiseases": null,
        "onDimensionsChanged" : function(width, height){
            console.log("DIMENSIONS CHANGED (default handler)", "WIDTH", width, "HEIGHT", height);
        },
        "onMount": function(innerContainerDOMElement){
            console.log("MOUNTED", innerContainerDOMElement);
        },
        "onWillUnmount": function(innerContainerDOMElement){
            console.log("WILL UNMOUNT", innerContainerDOMElement);
        }
    };

    static initialMouseMoveState = {
        initMouseX: null,
        initMouseY: null,
        initScrollLeft: null,
        initScrollTop: null,
        vectorX: null,
        vectorY: null,
        nextAnimationFrame: null
    };

    constructor(props){
        super(props);
        this.handleDimensionOrScaleChanged = this.handleDimensionOrScaleChanged.bind(this);
        this.handleContainerMouseDown = this.handleContainerMouseDown.bind(this);
        this.handleContainerMouseMove = this.handleContainerMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.handleMouseLeave = this.handleMouseLeave.bind(this);
        this.state = {
            'isMouseDownOnContainer' : true,
            'mounted' : false
        };

        this.id = createdInstanceCount++;

        this.memoized = {
            maxHeightIndex: memoize(PedigreeVizViewUserInterface.maxHeightIndex),
            diseaseToIndex: memoize(PedigreeVizViewUserInterface.diseaseToIndex),
            orderNodesBottomRightToTopLeft : memoize(orderNodesBottomRightToTopLeft),
            scaledStyle: memoize(scaledStyle),
            visAreaTransform: memoize(PedigreeVizViewUserInterface.visAreaTransform)
        };

        this.innerRef = React.createRef();

        // We should move at least ~ initMouseX (or 'isDragging')
        // to state to allow to have "grab" vs "grabbing"
        // mouse cursor (via className / CSS)
        this.mouseMove = { ...PedigreeVizViewUserInterface.initialMouseMoveState };

        if (typeof props.onDataChanged === "function" && props.objectGraph){
            props.onDataChanged(props.objectGraph);
        }
        if (typeof props.onDimensionsChanged === "function"){
            props.onDimensionsChanged({
                containerWidth: props.containerWidth,
                containerHeight: props.containerHeight,
                graphHeight: props.graphHeight,
                graphWidth: props.graphWidth
            });
        }
    }

    componentDidMount(){
        const { onMount } = this.props;
        const innerElem = this.innerRef.current;
        if (typeof onMount === "function"){
            onMount(innerElem);
        }
        window.addEventListener("mouseup", this.handleMouseUp);
        document.body.addEventListener("mouseleave", this.handleMouseLeave);
        setTimeout(()=>{
            // Delayed so that browser has chance to render non-mounted state
            // first. Needed for transition in on mount via CSS.
            this.setState({ mounted: true });
        }, 100);
    }

    componentWillUnmount(){
        const { onWillUnmount } = this.props;
        const innerElem = this.innerRef.current;
        if (typeof onMount === "function"){
            onWillUnmount(innerElem);
        }
        window.removeEventListener("mouseup", this.handleMouseUp);
        document.body.removeEventListener("mouseleave", this.handleMouseLeave);
    }

    /**
     * Grab scrollLeft snapshot if scale is changing.
     * @todo
     * Try to use in componentDidUpdate to update
     * `innerElem.scrollLeft` / `scrollTop` if scale
     * is changing in order to "center" contents
     */
    ///*
    getSnapshotBeforeUpdate(prevProps, prevState){
        const { scale: currScale } = this.props;
        const { scale: prevScale } = prevProps;

        if (currScale === prevScale) return null;

        const innerElem = this.innerRef.current;
        if (!innerElem) return null;

        return {
            scrollLeft: innerElem.scrollLeft,
            scrollTop: innerElem.scrollTop
        };
    }
    //*/

    componentDidUpdate(pastProps, pastState, snapshot){
        this.handleDimensionOrScaleChanged(pastProps, pastState, snapshot);
    }

    /**
     * Called from `componentDidUpdate`.
     * Pulled into own func in case we want to
     * try to throttle or debounce it later.
     */
    handleDimensionOrScaleChanged(pastProps, pastState, snapshot){
        const {
            onDimensionsChanged,
            containerWidth,
            containerHeight,
            graphHeight,
            graphWidth,
            scale
        } = this.props;
        const {
            containerHeight: pastContainerHeight,
            containerWidth: pastContainerWidth,
            graphHeight: pastGraphHeight,
            graphWidth: pastGraphWidth,
            scale: pastScale
        } = pastProps;

        if (typeof onDimensionsChanged === "function"){
            const didDimensionsChange = (
                containerWidth !== pastContainerWidth || containerHeight !== pastContainerHeight ||
                graphHeight !== pastGraphHeight || graphWidth !== pastGraphWidth
            );
            if (didDimensionsChange){
                onDimensionsChanged({ containerWidth, containerHeight, graphWidth, graphHeight });
            }
        }

        // Figure out center point of previous 'view' and reposition
        // so as to scroll into/out-of center of viewport
        const innerElem = this.innerRef.current;
        if (snapshot && scale !== pastScale && innerElem){
            const pastCenterV = (pastContainerHeight / 2) + snapshot.scrollTop;
            const pastCenterVRatio = pastCenterV / (pastGraphHeight * pastScale);
            const pastCenterH = (pastContainerWidth / 2) + snapshot.scrollLeft;
            const pastCenterHRatio = pastCenterH / (pastGraphWidth * pastScale);
            const nextCenterV = (graphHeight * scale) * pastCenterVRatio;
            const nextCenterH = (graphWidth * scale) * pastCenterHRatio;
            innerElem.scrollTo(
                nextCenterH - (containerWidth / 2),
                nextCenterV - (containerHeight / 2),
            );
        }
    }

    handleContainerMouseDown(evt){
        evt.stopPropagation();
        evt.preventDefault();

        // We manage rest of vars outside of React state for performance &
        // container's `scrollLeft` & `scrollTop` are not DOM attributes &
        // doesn't benefit much from React's diffing.
        this.mouseMove.initMouseX = evt.pageX;
        this.mouseMove.initMouseY = evt.pageY;
        this.mouseMove.vectorX = 0;
        this.mouseMove.vectorY = 0;

        const innerElem = this.innerRef.current;
        if (!innerElem) return;

        this.mouseMove.initScrollLeft = innerElem.scrollLeft;
        this.mouseMove.initScrollTop = innerElem.scrollTop;

        this.setState({ isMouseDownOnContainer: true });
    }

    /**
     * @todo
     * Maybe add as listener on window instead so viz area remains
     * moving when mouse goes outside boundary.
     */
    handleContainerMouseMove(evt){
        if (this.mouseMove.initMouseX === null) {
            return false;
        }
        const {
            initMouseX, initMouseY,
            initScrollLeft, initScrollTop,
            nextAnimationFrame
        } = this.mouseMove;

        if (nextAnimationFrame){ // Throttle
            return;
        }

        const vectorX = evt.pageX - initMouseX;
        const vectorY = evt.pageY - initMouseY;

        this.mouseMove.vectorX = vectorX;
        this.mouseMove.vectorY = vectorY;

        const innerElem = this.innerRef.current;

        this.mouseMove.nextAnimationFrame = raf(() => {
            innerElem.scrollTo(
                Math.max(0, initScrollLeft - vectorX),
                Math.max(0, initScrollTop - vectorY)
            );
            this.mouseMove.nextAnimationFrame = null;
        });
    }

    handleMouseLeave(evt){
        this.handleMouseUp();
    }

    handleMouseUp(evt = null){
        if (this.mouseMove.initMouseX === null) {
            // Mouseup didn't originate from our `.inner-container` element
            return false;
        }

        this.setState({ isMouseDownOnContainer: false });

        // Stop transitioning/panning viewport
        const { vectorX = 0, vectorY = 0, nextAnimationFrame = null } = this.mouseMove;
        this.mouseMove = { ...PedigreeVizViewUserInterface.initialMouseMoveState };
        const { onSelectNode, onUnselectNode, selectedNode = null } = this.props;
        if (nextAnimationFrame){
            cancelAnimationFrame(nextAnimationFrame);
        }

        // Act as click off of or onto node; we will have vectorX if 'click'ed within container.
        if (Math.abs(vectorX) <= 5 && Math.abs(vectorY) <= 5){
            const nodeID = (evt && evt.target && evt.target.id) || null;
            const nodeType = (evt && evt.target && evt.target.getAttribute("data-node-type")) || null;
            if (selectedNode !== null) {
                if (nodeID === selectedNode.id) {
                    // Keep same node selected if (re)click on it
                    return;
                }
                if (nodeID && (nodeType === "individual" || nodeType === "relationship")){
                    // Change to new node
                    onSelectNode(nodeID);
                    return;
                } // Else
                onUnselectNode();
                return;
            }
            if (selectedNode === null && nodeID && (nodeType === "individual" || nodeType === "relationship")){
                onSelectNode(nodeID);
            }
        }
    }

    render(){
        const {
            innerHeight = "auto",
            containerWidth = undefined,
            containerHeight,
            objectGraph,
            dims, order,
            renderDetailPane, containerStyle,
            visibleDiseases = null,
            scale = 1,
            minScale, maxScale,
            graphHeight, graphWidth,
            setScale,
            selectedNode,
            hoveredNode,
            onSelectNode,
            onUnselectNode,
            showZoomControls = true,
            disableSelect = false,
            ...passProps
        } = this.props;
        const { isMouseDownOnContainer, mounted } = this.state;
        const diseaseToIndex = this.memoized.diseaseToIndex(visibleDiseases, objectGraph);
        const orderedNodes = this.memoized.orderNodesBottomRightToTopLeft(objectGraph);
        const scaledVizStyle = this.memoized.scaledStyle(graphHeight, graphWidth, scale);
        const maxHeightIndex = this.memoized.maxHeightIndex(objectGraph);


        const outerContainerStyle = { minHeight : containerHeight, ...containerStyle };
        const innerContainerStyle = { height: innerHeight || "auto", minHeight : containerHeight };

        //const innerElemStyle = {
        //    paddingTop: Math.max(0, (containerHeight - scaledVizStyle.height) / 2)
        //};

        let selectedNodePane = null;
        if (typeof renderDetailPane === 'function'){
            selectedNodePane = renderDetailPane({
                objectGraph,
                selectedNode,
                hoveredNode,
                diseaseToIndex,
                'onNodeClick': onSelectNode,
                'unselectNode' : onUnselectNode
            });
        }
        const detailPaneHasNode = !!(selectedNodePane && selectedNode);

        const commonChildProps = {
            ...passProps,
            "objectGraph": orderedNodes,
            "vizViewID" : this.id,
            containerWidth, containerHeight,
            graphHeight, graphWidth, dims, scale,
            diseaseToIndex,
            selectedNode,
            hoveredNode,
            maxHeightIndex,
            // In passProps:
            // onNodeMouseIn,
            // onNodeMouseLeave,
            // Handled here for now:
            // onNodeClick
        };

        const hasExtraHeight = containerHeight >= scaledVizStyle.height;
        const hasExtraWidth = (typeof containerWidth === "number" && containerWidth >= scaledVizStyle.width);
        const isScrollable = !hasExtraHeight || !hasExtraWidth;

        const visAreaStyle = {
            transform: this.memoized.visAreaTransform(scaledVizStyle, containerHeight, containerWidth),
            width: graphWidth,
            height: graphHeight
        };

        return (
            // IndividualsLayer may become deprecated, and move to all-SVG for easier exportability... unsure.
            <div className="pedigree-viz-container" style={outerContainerStyle} data-selection-disabled={disableSelect}
                data-selected-node={selectedNode && selectedNode.id} data-instance-index={this.id}>
                <div className="inner-container" ref={this.innerRef} style={innerContainerStyle}
                    onMouseDown={this.handleContainerMouseDown}
                    onMouseMove={this.handleContainerMouseMove}
                    data-has-extra-height={hasExtraHeight}
                    data-scrollable={isScrollable}
                    data-mouse-down={isMouseDownOnContainer}
                    data-is-mounted={mounted}
                    data-is-min-scale={scale === minScale}
                    data-is-max-scale={scale === maxScale}>
                    <div className="viz-area" style={visAreaStyle}>
                        <ShapesLayer {...commonChildProps} />
                        <IndividualsLayer {...commonChildProps} />
                    </div>
                </div>
                { showZoomControls && typeof setScale === "function" ?
                    <ScaleControls {...{ scale, minScale, maxScale, setScale }} />
                    : null }
                { selectedNodePane ?
                    <div className={"detail-pane-container" + (detailPaneHasNode ? " has-selected-node" : "")}>
                        { selectedNodePane }
                    </div>
                    : null }
            </div>
        );
    }
}

const ShapesLayer = React.memo(function ShapesLayer(props){
    const {
        graphHeight, graphWidth,
        edges, relationships,
        selectedNode, hoveredNode,
        onNodeMouseIn, onNodeMouseLeave,
        dims, scale,
        showOrderBasedName, showNotes
    } = props;
    const svgStyle = { width: graphWidth, height: graphHeight };

    // Update less frequently by rounding for better performance (less changes, caught by Memo/PureComponent)
    const textScale = Math.floor(((0.5 / scale) + 0.5) * 5) / 5;
    const textScaleTransformStr = "scale3d(" + textScale +"," + textScale +",1)";

    return (
        <svg className="pedigree-viz-shapes-layer shapes-layer" viewBox={"0 0 " + graphWidth + " " + graphHeight} style={svgStyle}>
            <EdgesLayer {...{ edges, dims }} />
            <SelectedNodeIdentifier {...{ selectedNode, dims, textScale }} />
            <RelationshipNodeShapeLayer {...{ relationships, hoveredNode, onNodeMouseIn, onNodeMouseLeave, dims, textScale, textScaleTransformStr }} />
            <IndividualNodeShapeLayer {...props} {...{ textScale, textScaleTransformStr, showOrderBasedName, showNotes }} />
        </svg>
    );
});


/**
 * @todo _Maybe_
 * Make into instantiable component and if currSelectedNodeId change then use d3 transition
 * to adjust transform attribute as some browsers won't transition attribute using CSS3.
 * **BUT** Using CSS transition for SVG transform is part of newer spec so browsers should ideally
 * support it, can likely just wait for (more) browsers to implement?
 */
const SelectedNodeIdentifier = React.memo(function SelectedNodeIdentifier({ selectedNode, dims, textScale }){
    if (!selectedNode){
        return null;
    }
    const { _drawing: { xCoord, yCoord } } = selectedNode;

    let useHeight = dims.individualHeight;
    let useWidth = dims.individualWidth;

    if (isRelationship(selectedNode)){
        useHeight = dims.relationshipSize;
        useWidth = dims.relationshipSize;
    }

    const ourScale = ((textScale + 2) / 3);
    const centerH = useWidth / 2;
    const centerV = useHeight / 2;
    const topLeftX = dims.graphPadding + xCoord - centerH;
    const topLeftY = dims.graphPadding + yCoord - centerV;
    const transform = "translate(" + topLeftX + ", " + topLeftY + ") scale(" + ourScale + ")";
    const segmentLength = Math.round(ourScale * 7);
    return (
        <g className="selected-node-identifier" transform={transform} style={{ transformOrigin: "" + centerH + "px " + centerV + "px" }}>
            <SelectedNodeIdentifierShape height={useHeight} width={useWidth} segmentLengthX={segmentLength} segmentLengthY={segmentLength} />
        </g>
    );
});

/**
 * @todo Move segmentLength to dims?
 * @todo Make into instantiable component and if detect width change, height change, etc, then use d3 transition.
 */
const SelectedNodeIdentifierShape = React.memo(function SelectedNodeIdentifierShape(props){
    const {
        height, width,
        segmentLengthY = 7,
        segmentLengthX = 7,
        offset = 18
    } = props;

    const cornerPaths = {
        topLeft: null, topRight: null, bottomRight: null, bottomleft: null
    };

    const topLeft = d3Path();
    topLeft.moveTo(-offset, -offset + segmentLengthY);
    topLeft.lineTo(-offset, -offset);
    topLeft.lineTo(-offset + segmentLengthX, -offset);
    cornerPaths.topLeft = topLeft.toString();

    const topRight = d3Path();
    topRight.moveTo(0 - segmentLengthX + offset, -offset);
    topRight.lineTo(offset, -offset);
    topRight.lineTo(offset, -offset + segmentLengthY);
    cornerPaths.topRight = topRight.toString();

    const bottomRight = d3Path();
    bottomRight.moveTo(offset, offset - segmentLengthY);
    bottomRight.lineTo(offset, offset);
    bottomRight.lineTo(offset - segmentLengthX, offset);
    cornerPaths.bottomRight = bottomRight.toString();

    const bottomLeft = d3Path();
    bottomLeft.moveTo(-offset + segmentLengthX, offset);
    bottomLeft.lineTo(-offset, offset);
    bottomLeft.lineTo(-offset, offset - segmentLengthY);
    cornerPaths.bottomLeft = bottomLeft.toString();

    const cornerPathsJSX = Object.keys(cornerPaths).map(function(pos){
        const pathStr = cornerPaths[pos];
        const t = { x: 0, y: 0 };
        if (pos === "topRight" || pos === "bottomRight"){
            t.x = width;
        }
        if (pos === "bottomLeft" || pos === "bottomRight"){
            t.y = height;
        }
        return (
            <g className={"identifier-corner corner-" + pos} key={pos} transform={"translate(" + t.x + ", " + t.y + ")"}>
                <path d={pathStr} />
            </g>
        );
    });

    return <React.Fragment>{ cornerPathsJSX }</React.Fragment>;
});


/** Exports / entry-points */
export default PedigreeViz;
export {
    PedigreeVizView,
    GraphTransformer,
    buildGraphData as buildPedigreeGraphData,
    isRelationship as isRelationshipNode
};
