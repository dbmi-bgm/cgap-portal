import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import memoize from 'memoize-one';
import { path as d3Path } from 'd3-path';
/** @todo Pull this out into here if making a lib */
import { requestAnimationFrame as raf, cancelAnimationFrame } from '@hms-dbmi-bgm/shared-portal-components/es/components/viz/utilities';
import { isRelationship } from './data-utilities';
import { graphToDiseaseIndices, orderNodesBottomRightToTopLeft } from './layout-utilities-drawing';
import { GraphTransformer, buildGraphData, POSITION_DEFAULTS } from './GraphTransformer';
import { ScaleController, ScaleControls } from './ScaleController';
import { SelectedNodeController } from './SelectedNodeController';
import { IndividualsLayer } from './IndividualsLayer';
import { IndividualNodeShapeLayer } from './IndividualNodeShapeLayer';
import { RelationshipNodeShapeLayer } from './RelationshipNodeShapeLayer';
import { EdgesLayer } from './EdgesLayer';
import { DefaultDetailPaneComponent } from './DefaultDetailPaneComponent';

/**
 * @typedef DatasetEntry
 * @type {Object}
 * @prop {!(string|number)} id          Unique Identifier of Individual within dataset.
 * @prop {string} [name]                Publicly visible name of Individual/Node.
 * @prop {string} gender                Should be one of "m", "f", or "u".
 * @prop {?number} [age]                Should be calculated from date of birth to be in context of today.
 * @prop {?string[]} [diseases]         List of diseases affecting the individual.
 * @prop {!boolean} [isProband]         If true, identifies the proband individual.
 * @prop {!boolean} [isDeceased]        If true, then Individual is deceased.
 * @prop {!string} [causeOfDeath]       Describes cause of death.
 * @prop {!boolean} [isConsultand]      If true, Individual is seeking consultation.
 * @prop {?boolean} [isStillBirth]      If present & true, deceased must also be truthy _and_ must have no children.
 * @prop {?boolean} [isPregnancy]       If present & true, this individual is not yet born.
 * @prop {?boolean} [isSpontaneousAbortion] `isPregnancy` must also be `true`.
 * @prop {?boolean} [isTerminatedPregnancy] `isPregnancy` must also be `true`.
 * @prop {?boolean} [isEctopic]         `isPregnancy` must also be `true`.
 * @prop {?Object} [data]               Additional or raw data of the Individual which may not be relevant in pedigree. Would only appear in detailpane.
 *
 * @prop {string[]} [parents]           List of parents of Individual in form of IDs.
 * @prop {?string[]} [children]         List of children of Individual in form of IDs.
 * @prop {!string} [father]             Father of Individual in form of ID. Gets merged into 'parents'.
 * @prop {!string} [mother]             Mother of Individual in form of ID. Gets merged into 'parents'.
 */

const pedigreeVizPropTypes = {
    dataset: PropTypes.arrayOf(PropTypes.exact({
        'id'                : PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
        'name'              : PropTypes.string,
        'gender'            : PropTypes.oneOf(["m", "M", "male", "f", "F", "female", "u", "U", "undetermined"]).isRequired,
        'age'               : PropTypes.number,
        'diseases'          : PropTypes.arrayOf(PropTypes.string),
        'carrierOfDiseases' : PropTypes.arrayOf(PropTypes.string),
        'asymptoticDiseases': PropTypes.arrayOf(PropTypes.string),
        'isProband'         : PropTypes.bool,
        'isDeceased'        : PropTypes.bool,
        'isConsultand'      : PropTypes.bool,
        'isPregnancy'       : PropTypes.bool,
        'isStillBirth'      : PropTypes.bool,
        'isSpontaneousAbortion' : PropTypes.bool,
        'isTerminatedPregnancy' : PropTypes.bool,
        'isEctopic'         : PropTypes.bool,
        'data'              : PropTypes.object,
        'parents'           : PropTypes.arrayOf(PropTypes.oneOfType([ PropTypes.string, PropTypes.number ])),
        'children'          : PropTypes.arrayOf(PropTypes.oneOfType([ PropTypes.string, PropTypes.number ])),
        'mother'            : PropTypes.oneOfType([ PropTypes.string, PropTypes.number ]),
        'father'            : PropTypes.oneOfType([ PropTypes.string, PropTypes.number ]),
    })),
    dimensionOpts: PropTypes.objectOf(PropTypes.number),
    height: PropTypes.number,
    width: PropTypes.number,
    editable: PropTypes.bool,
    onNodeSelected: PropTypes.func,
    renderDetailPane: PropTypes.func,
    filterUnrelatedIndividuals: PropTypes.bool
};

const pedigreeVizDefaultProps = {
    /** @type {DatasetEntry[]} dataset - Dataset to be visualized. */
    "dataset" : [
        {
            id: 1,
            name: "Jack",
            isProband: true,
            father: 2,
            mother: 3,
            gender: "m",
            data: {
                "notes" : "Likes cheeseburger and other sandwiches. Dislikes things that aren't those things.",
                "description" : "Too many calories in the diet."
            },
            age: 42,
            diseases: ["Badfeelingitis", "Ubercrampus", "Blue Thumb Syndrome"],
            carrierOfDiseases: ["Green Thumbitis", "BlueClues", "BlueClues2", "BluesClues3"],
            //asymptoticDiseases: ["Green Thumbitis", "BlueClues", "BlueClues2", "BluesClues3"]
        },
        { id: 2, name: "Joe", gender: "m" },
        { id: 3, name: "Mary", gender: "f", diseases: ["Blue Thumb Syndrome", "Green Thumbitis"] },
        { id: 4, name: "George", gender: "m", parents: [2,3], age: 45, carrierOfDiseases: ["Blue Thumb Syndrome"], },
        { id: 19, name: "George II", gender: "m", parents: [2,3], age: 46, carrierOfDiseases: ["Blue Thumb Syndrome"], },
        { id: 5, name: "Patricia", gender: "f", parents: [3, 6], diseases: ["Badfeelingitis", "Ubercrampus", "Blue Thumb Syndrome"] },
        {
            id: 6, name: "Patrick", gender: "m", children: [5],
            carrierOfDiseases: ["Blue Thumb Syndrome", "Ubercrampus"]
        },
        {
            id: 7, name: "Phillip", gender: "m", children: [6],
            carrierOfDiseases: ["Blue Thumb Syndrome", "Ubercrampus", "Green Thumbitis", "Badfeelingitis", "BlueClues", "BlueClues2", "BlueClues3"]
        },
        { id: 8, name: "Phillipina", gender: "f", children: [6] },
        { id: 9, name: "Josephina", gender: "f", children: [2] },
        { id: 10, name: "Joseph", gender: "m", children: [2] },
        {
            id: 11, name: "Max", gender: "m", parents: [],
            asymptoticDiseases: ["Green Thumbitis", "BlueClues", "BlueClues2", "BluesClues3"]
        },
        { id: 12, name: "Winnie the Pooh", gender: "u", parents: [11, 5], isDeceased: true, age: 24 },
        {
            id: 13, name: "Rutherford", gender: "m", parents: [10, 5], age: 0.3,
            isPregnancy: true, isDeceased: true, isTerminatedPregnancy: true,
            diseases: ["Ubercrampus", "Blue Thumb Syndrome", "Green Thumbitis"],
            carrierOfDiseases: ["BlueClues", "BlueClues2", "BluesClues3"]
        },
        { id: 14, name: "Sally", gender: "f", parents: [12, 9] },
        { id: 15, name: "Sally2", gender: "f" },
        { id: 16, name: "Silly", gender: "m", parents: [15, 12] },
        { id: 17, name: "Silly2", gender: "m", parents: [15, 12] },
        { id: 18, name: "Silly3", gender: "f", parents: [16, 14] },
    ],

    /** If true, will filter out and not display individuals who are detached from proband. */
    "filterUnrelatedIndividuals" : false,

    /**
     * Dimensions for drawing/layout of nodes.
     * Shouldn't need to change these.
     * May define some or all or no dimensions (defaults will be applied).
     *
     * @required
     */
    "dimensionOpts" : Object.assign({}, POSITION_DEFAULTS),

    /**
     * Height of parent container.
     * If not defined, visualization will be unbounded and extend as
     * tall as needed instead of being vertically scrollable.
     * Depending on UX/context, this is likely desirable.
     *
     * @optional
     */
    //"height" : null,

    /**
     * Minimum height of parent container,
     * if height is not set and want container to
     * be at least a certain height.
     *
     * @optional
     */
    "minimumHeight" : 400,

    /**
     * Width of parent container.
     * Will be scrollable left/right if greater than this.
     *
     * @required
     */
    //"width" : 600,

    /**
     * NOT YET SUPPORTED.
     * If true (unsupported yet), will be able to modify and add/remove nodes.
     */
    "editable" : false,

    /**
     * Callback function called upon changing of selectedNode.
     *
     * @optional
     */
    "onNodeSelected" : function(node){
        console.log('Selected', node);
    },

    /**
     * A function which returns a React Component.
     * Will be instantiated/rendered at side of visualization.
     *
     * @type {function}
     */
    "renderDetailPane" : function(vizProps){
        return <DefaultDetailPaneComponent {...vizProps} />;
    },


    /**
     * Can supply an array of strings to color only those diseases.
     * If null, then _all_ diseases will be colored.
     *
     * @type {!string[]}
     */
    "visibleDiseases": null,


    /**
     * If true, will show markers such as "II - 1", "IV - 2", etc. based on generation & order.
     * Else will use `individual.name` or `individual.id` (if no name).
     *
     * @type {boolean}
     */
    "showOrderBasedName" : true,

    /**
     * Initial zoom/scale.
     * Will be overriden if `zoomToExtentsOnMount` is true,
     * after mount.
     *
     * @type {number}
     */
    "initialScale" : 1,

    /**
     * If true, will zoom out the graph (if needed)
     * to fit into viewport. Will only fit to dimensions
     * passed in, e.g. `props.height` & `props.width`.
     *
     * @type {boolean}
     */
    "zoomToExtentsOnMount" : true,


    /** Whether to allow to zoom w. mousewheel. Experimental. */
    "enableMouseWheelZoom" : false,


    /** Whether to allow to zoom w. mousewheel. Experimental. */
    "enablePinchZoom" : true
};

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
function PedigreeVizView(props){
    const {
        objectGraph, onNodeSelected, onDataChanged,
        zoomToExtentsOnMount, initialScale,
        enableMouseWheelZoom, enablePinchZoom,
        ...passProps
    } = props;
    const pedigreeViewProps = { ...passProps, objectGraph };
    return (
        <ScaleController {...{ zoomToExtentsOnMount, initialScale, enableMouseWheelZoom, enablePinchZoom }}>
            <SelectedNodeController {...{ onNodeSelected, onDataChanged, objectGraph }}>
                <PedigreeVizViewUserInterface {...pedigreeViewProps} />
            </SelectedNodeController>
        </ScaleController>
    );
}

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

    static scaledVizStyle(graphHeight, graphWidth, scale){
        return {
            'width': (graphWidth * scale),
            'height': (graphHeight * scale),
            'transform' : "scale3d(" + scale + "," + scale + ",1)"
        };
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
        };

        this.memoized = { // Differs from props.memoized
            diseaseToIndex: memoize(PedigreeVizViewUserInterface.diseaseToIndex),
            orderNodesBottomRightToTopLeft : memoize(orderNodesBottomRightToTopLeft),
            scaledVizStyle: memoize(PedigreeVizViewUserInterface.scaledVizStyle)
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
                containerWidth: props.width,
                containerHeight: props.height || Math.max(props.minimumHeight, props.graphHeight),
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
            width: containerWidth,
            height: propHeight,
            graphHeight,
            graphWidth,
            minimumHeight,
            scale
        } = this.props;
        const {
            height: pastPropHeight,
            graphHeight: pastGraphHeight,
            graphWidth: pastGraphWidth,
            minimumHeight: pastMinHeight,
            width: pastContainerWidth,
            scale: pastScale
        } = pastProps;

        const containerHeight = propHeight || Math.max(minimumHeight, graphHeight);
        const pastContainerHeight = pastPropHeight || Math.max(pastMinHeight, pastGraphHeight);
        const didDimensionsChange = (
            containerWidth !== pastContainerWidth || containerHeight !== pastContainerHeight ||
            graphHeight !== pastGraphHeight || graphWidth !== pastGraphWidth
        );

        if (didDimensionsChange && typeof onDimensionsChanged === "function"){
            onDimensionsChanged({ containerWidth, containerHeight, graphWidth, graphHeight });
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

        const vectorX = evt.pageX - initMouseX;
        const vectorY = evt.pageY - initMouseY;

        this.mouseMove.vectorX = vectorX;
        this.mouseMove.vectorY = vectorY;

        const innerElem = this.innerRef.current;

        if (nextAnimationFrame){
            cancelAnimationFrame(nextAnimationFrame);
        }
        this.mouseMove.nextAnimationFrame = raf(() => {
            innerElem.scrollTo(
                Math.max(0, initScrollLeft - vectorX),
                Math.max(0, initScrollTop - vectorY)
            );
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
            width: propWidth,
            height: propHeight,
            minimumHeight,
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
            ...passProps
        } = this.props;
        const { isMouseDownOnContainer } = this.state;
        const diseaseToIndex = this.memoized.diseaseToIndex(visibleDiseases, objectGraph);
        const orderedNodes = this.memoized.orderNodesBottomRightToTopLeft(objectGraph);
        const scaledVizStyle = this.memoized.scaledVizStyle(graphHeight, graphWidth, scale);

        const containerHeight = propHeight || Math.max(minimumHeight, graphHeight);
        const containerWidth = propWidth || undefined; // TODO: consider measuring innerElem.offsetWidth, also detect/update if changes re: detailpane

        const outerContainerStyle = { minHeight : containerHeight, ...containerStyle };
        const innerContainerStyle = { height: propHeight || "auto", minHeight : containerHeight };

        //const innerElemStyle = {
        //    paddingTop: Math.max(0, (containerHeight - scaledVizStyle.height) / 2)
        //};

        const commonChildProps = {
            ...passProps,
            "objectGraph": orderedNodes,
            graphHeight, graphWidth, dims, diseaseToIndex,
            containerHeight, containerWidth, scale,
            selectedNode, hoveredNode,
            // In passProps:
            // onNodeMouseIn,
            // onNodeMouseLeave,
            // Handled here for now:
            // onNodeClick
        };

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
        const hasExtraHeight = containerHeight >= scaledVizStyle.height;
        const hasExtraWidth = (typeof containerWidth === "number" && containerWidth >= scaledVizStyle.width);
        const isScrollable = !hasExtraHeight || !hasExtraWidth || detailPaneHasNode;

        return (
            <div className="pedigree-viz-container" style={outerContainerStyle} data-selected-node={selectedNode && selectedNode.id}>
                <div className="inner-container" ref={this.innerRef} style={innerContainerStyle}
                    onMouseDown={this.handleContainerMouseDown}
                    onMouseMove={this.handleContainerMouseMove}
                    data-has-extra-height={hasExtraHeight}
                    data-scrollable={isScrollable}
                    data-mouse-down={isMouseDownOnContainer}>
                    <div className="viz-area" style={scaledVizStyle} data-scale={scale}>
                        <ShapesLayer {...commonChildProps} />
                        <IndividualsLayer {...commonChildProps} />
                    </div>
                </div>
                { typeof setScale === "function" ?
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
        dims, scale
    } = props;
    const textScale = (0.5 / scale) + 0.5;
    const textScaleTransformStr = "scale3d(" + textScale +"," + textScale +",1)";
    const svgStyle = { width: graphWidth, height: graphHeight };
    return (
        <svg className="pedigree-viz-shapes-layer shapes-layer" viewBox={"0 0 " + graphWidth + " " + graphHeight} style={svgStyle}>
            <EdgesLayer {...{ edges, dims }} />
            <SelectedNodeIdentifier {...{ selectedNode, dims, textScale }} />
            <RelationshipNodeShapeLayer {...{ relationships, hoveredNode, onNodeMouseIn, onNodeMouseLeave, dims, textScale, textScaleTransformStr }} />
            <IndividualNodeShapeLayer {...props} {...{ textScale, textScaleTransformStr }} />
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
    const { id, _drawing: { xCoord, yCoord } } = selectedNode;

    let useHeight = dims.individualHeight;
    let useWidth = dims.individualWidth;

    if (id.slice(0,13) === "relationship:"){ // Is relationship node.
        useHeight = dims.relationshipSize;
        useWidth = dims.relationshipSize;
    }

    const ourScale = ((textScale + 1) / 2);
    const centerH = useWidth / 2;
    const centerV = useHeight / 2;
    const topLeftX = dims.graphPadding + xCoord - centerH;
    const topLeftY = dims.graphPadding + yCoord - centerV;
    const transform = "translate(" + topLeftX + ", " + topLeftY + ") scale(" + ourScale + ")";
    const segmentLength = ourScale * 7;
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
