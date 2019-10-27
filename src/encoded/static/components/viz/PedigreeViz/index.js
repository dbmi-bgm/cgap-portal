import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import memoize from 'memoize-one';
import { path as d3Path } from 'd3-path';
/** @todo Pull this out into here if making a lib */
import { requestAnimationFrame as raf } from '@hms-dbmi-bgm/shared-portal-components/es/components/viz/utilities';
import {
    standardizeObjectsInList, findNodeWithId,
    createObjectGraph, createRelationships, getRelationships
} from './data-utilities';
import { assignTreeHeightIndices, orderObjectGraph, positionObjectGraph } from './layout-utilities';
import {
    getGraphHeight, getGraphWidth,
    createEdges, relationshipTopPosition,
    graphToDiseaseIndices, orderNodesBottomRightToTopLeft
} from './layout-utilities-drawing';
import { ScaleController, ScaleControls } from './ScaleController';
import { IndividualsLayer, doesAncestorHaveId } from './IndividualsLayer';
import { IndividualNodeShapeLayer } from './IndividualNodeShapeLayer';
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

/**
 * Default values for `props.dimensionOpts`
 */
const POSITION_DEFAULTS = {
    individualWidth: 80,
    individualXSpacing: 80, // THIS MUST BE EQUAL TO OR MULTIPLE OF INDIVIDUAL WIDTH FOR TIME BEING
    individualHeight: 80,
    individualYSpacing: 180,
    graphPadding: 60,
    relationshipSize: 40,
    edgeLedge: 40,
    edgeCornerDiameter: 20
};

/**
 * Primary component to feed data into.
 *
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
export class PedigreeViz extends React.PureComponent {

    static propTypes = {
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
        onNodeSelect: PropTypes.func,
        renderDetailPane: PropTypes.func
    };

    static defaultProps = {
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
        "onNodeSelect" : function(node){
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
        "enableMouseWheelZoom" : false
    };

    static initState(dataset){
        const jsonList = dataset ? standardizeObjectsInList(dataset) : null;
        const history = jsonList? [jsonList] : [];
        return {
            // New individuals created in viz will be added to here.
            // If none, use a default trio set?
            history,
            'timesChanged' : 0,
            'currCounter' : history.length - 1
        };
    }

    constructor(props){
        super(props);
        this.state = PedigreeViz.initState(props.dataset);
    }

    componentDidUpdate(pastProps, pastState){
        const { dataset } = this.props;
        if (dataset !== pastProps.dataset){
            this.setState(PedigreeViz.initState(dataset));
        }
        /*
        if (stateDataset !== pastState.dataset){
            this.setState(function({ timesChanged, history: pastHistory }){
                const history = pastHistory.slice();
                return { 'timesChanged' : timesChanged + 1 };
            });
        }
        */
    }

    componentWillUnmount(){
        // TODO: if state.jsonList has changed, ask to save before exiting.
    }

    render(){
        const { dataset, ...passProps } = this.props;
        const { history, currCounter } = this.state;
        const jsonList = history[currCounter];
        return (
            <GraphTransformer jsonList={jsonList} {...passProps} />
        );
    }

}


function isMobileSize(windowWidth){
    if ((windowWidth || window.innerWidth) < 800){
        return true;
    }
    return false;
}

function getFullDims(dimensionOpts){
    return Object.assign(
        {},
        POSITION_DEFAULTS,
        dimensionOpts,
        {
            graphPadding : Math.max(
                dimensionOpts.graphPadding || POSITION_DEFAULTS.graphPadding,
                dimensionOpts.individualXSpacing || POSITION_DEFAULTS.individualXSpacing,
                dimensionOpts.individualYSpacing || POSITION_DEFAULTS.individualYSpacing
            )
        }
    );
}


class GraphTransformer extends React.PureComponent {

    constructor(props){
        super(props);
        // Funcs for which we don't expect result to change unless props.jsonList does.
        this.memoized = {
            createObjectGraph       : memoize(createObjectGraph),
            createRelationships     : memoize(createRelationships),
            assignTreeHeightIndices : memoize(assignTreeHeightIndices),
            orderObjectGraph        : memoize(orderObjectGraph),
            positionObjectGraph     : memoize(positionObjectGraph),
            getGraphHeight          : memoize(getGraphHeight),
            getGraphWidth           : memoize(getGraphWidth),
            createEdges             : memoize(createEdges),
            findNodeWithId          : memoize(findNodeWithId),
            getFullDims             : memoize(getFullDims),
            getRelationships        : memoize(getRelationships)
        };
    }

    render(){
        const {
            jsonList, children, dimensionOpts, filterUnrelatedIndividuals,
            zoomToExtentsOnMount, initialScale, enableMouseWheelZoom,
            ...passProps
        } = this.props;
        const { objectGraph, disconnectedIndividuals } = this.memoized.createObjectGraph(jsonList, filterUnrelatedIndividuals);
        const relationships = this.memoized.createRelationships(objectGraph);
        this.memoized.assignTreeHeightIndices(objectGraph);
        const order = this.memoized.orderObjectGraph(objectGraph, relationships, this.memoized);
        const dims = this.memoized.getFullDims(dimensionOpts);
        this.memoized.positionObjectGraph(objectGraph, order, dims);
        // Add extra to offset text @ bottom of nodes.
        const graphHeight = this.memoized.getGraphHeight(order.orderByHeightIndex, dims) + 60;
        const graphWidth = this.memoized.getGraphWidth(objectGraph, dims);
        const edges = this.memoized.createEdges(objectGraph, dims, graphHeight);
        console.log('TTT2', objectGraph, relationships, edges);

        const viewProps = {
            ...passProps,
            objectGraph, relationships, dims, order, edges,
            graphHeight, graphWidth,
            disconnectedIndividuals, filterUnrelatedIndividuals,
            memoized: this.memoized
        };

        if (children){
            return React.Children.map(children, (child) => React.cloneElement(child, viewProps));
        } else {
            return (
                <ScaleController {...{ zoomToExtentsOnMount, initialScale, enableMouseWheelZoom }}>
                    <PedigreeVizView {...viewProps} memoized={this.memoized} />
                </ScaleController>
            );
        }
    }
}


export class PedigreeVizView extends React.PureComponent {

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

    static defaultProps = {
        'width': 600,
        "scale" : 1,
        "visibleDiseases": null,
        "onDimensionsChanged" : function(width, height){
            console.log("DIMENSIONS CHANGED (default handler)", "WIDTH", width, "HEIGHT", height);
        },
        "onDataChanged" : function(objectGraph){
            console.log("DATA CHANGED (default handler)", objectGraph);
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
        this.handleNodeMouseIn = this.handleNodeMouseIn.bind(this);
        this.handleNodeMouseLeave = this.handleNodeMouseLeave.bind(this);
        this.handleNodeClick = this.handleNodeClick.bind(this);
        this.handleUnselectNode = this.handleUnselectNode.bind(this);
        this.handleContainerMouseDown = this.handleContainerMouseDown.bind(this);
        this.handleContainerMouseMove = this.handleContainerMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.handleMouseLeave = this.handleMouseLeave.bind(this);
        this.state = {
            'currHoverNodeId' : null,
            'currSelectedNodeId' :  null,
            'isMouseDownOnContainer' : true,
        };

        this.memoized = { // Differs from props.memoized
            diseaseToIndex: memoize(PedigreeVizView.diseaseToIndex),
            orderNodesBottomRightToTopLeft : memoize(orderNodesBottomRightToTopLeft)
        };

        this.innerRef = React.createRef();

        // We should move at least ~ initMouseX (or 'isDragging')
        // to state to allow to have "grab" vs "grabbing"
        // mouse cursor (via className / CSS)
        this.mouseMove = { ...PedigreeVizView.initialMouseMoveState };


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
        const { objectGraph, memoized, onDataChanged } = this.props;
        const { objectGraph: pastObjGraph } = pastProps;

        if (objectGraph !== pastObjGraph){
            onDataChanged(objectGraph);
            this.setState(function({ currSelectedNodeId }){
                const retState = { currHoverNodeId: null };
                const selectedNode = currSelectedNodeId && memoized.findNodeWithId(objectGraph, currSelectedNodeId);
                if (!selectedNode){
                    retState.currSelectedNodeId = null;
                }
                return retState;
            });
        }

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

    handleNodeMouseIn(id){
        const { windowWidth = null } = this.props;
        if (isMobileSize(windowWidth)){
            // Prevent hover interaction handling on mobile sizes for perf/safety.
            return false;
        }
        if (!id) {
            return;
        }
        this.setState({ 'currHoverNodeId' : id });
    }

    handleNodeMouseLeave(evt){
        const { currHoverNodeId = null } = this.state;
        if (!currHoverNodeId){
            return false;
        }
        //console.log('out', evt.currentTarget, evt.target, evt.relatedTarget);
        this.setState({ 'currHoverNodeId' : null });
    }

    handleNodeClick(id){
        if (!id){
            return false;
        }
        // Is triggered after onmouseup, vectors always === 0.
        //console.log(this.mouseMove.vectorX, this.mouseMove.vectorY);
        //if (Math.abs(this.mouseMove.vectorX) > 10 || Math.abs(this.mouseMove.vectorY) > 10){
        //    // Might have started to drag viewport; cancel.
        //    return false;
        //}
        this.setState(function({ currSelectedNodeId }){
            if (currSelectedNodeId === id){
                return null;
            }
            return {
                'currSelectedNodeId' : id,
                // For mobile
                'currHoverNodeId' : id
            };
        }, ()=>{
            const { onNodeSelect, memoized, objectGraph } = this.props;
            const { currSelectedNodeId } = this.state;
            if (typeof onNodeSelect === 'function'){
                const currSelectedNode = currSelectedNodeId && memoized.findNodeWithId(objectGraph, currSelectedNodeId);
                onNodeSelect(currSelectedNode);
            }
        });
    }

    handleUnselectNode(){
        this.setState({ 'currSelectedNodeId' : null }, ()=>{
            const { onNodeSelect, memoized, objectGraph } = this.props;
            const { currSelectedNodeId } = this.state;
            if (typeof onNodeSelect === 'function'){
                // Should always eval to null but keep remainder of logic in case state.currSelectedNodeId changes interim.
                const currSelectedNode = currSelectedNodeId && memoized.findNodeWithId(objectGraph, currSelectedNodeId);
                onNodeSelect(currSelectedNode);
            }
        });
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
            window.cancelAnimationFrame(nextAnimationFrame);
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
        this.mouseMove = { ...PedigreeVizView.initialMouseMoveState };
        const { currSelectedNodeId = null } = this.state;
        nextAnimationFrame && window.cancelAnimationFrame(nextAnimationFrame);

        // Act as click off of or onto node; we will have vectorX if 'click'ed within container.
        if (Math.abs(vectorX) <= 5 && Math.abs(vectorY) <= 5){
            const nodeID = (evt && evt.target && evt.target.id) || null;
            const nodeType = (evt && evt.target && evt.target.getAttribute("data-node-type")) || null;
            if (currSelectedNodeId !== null) {
                if (nodeID === currSelectedNodeId) {
                    // Keep same node selected if (re)click on it
                    return;
                }
                if (nodeID && (nodeType === "individual" || nodeType === "relationship")){
                    // Change to new node
                    this.handleNodeClick(nodeID);
                    return;
                } // Else
                this.handleUnselectNode();
                return;
            }
            if (currSelectedNodeId === null && nodeID && (nodeType === "individual" || nodeType === "relationship")){
                this.handleNodeClick(nodeID);
            }
        }
    }

    render(){
        const {
            width: containerWidth,
            height: propHeight,
            minimumHeight,
            objectGraph, dims, order, memoized,
            renderDetailPane, containerStyle,
            visibleDiseases = null,
            scale = 1,
            minScale, maxScale,
            graphHeight, graphWidth,
            setScale,
            ...passProps
        } = this.props;
        const { currSelectedNodeId, isMouseDownOnContainer } = this.state;
        const diseaseToIndex = this.memoized.diseaseToIndex(visibleDiseases, objectGraph);
        const orderedNodes = this.memoized.orderNodesBottomRightToTopLeft(objectGraph);

        const containerHeight = propHeight || Math.max(minimumHeight, graphHeight);

        const outerContainerStyle = { minHeight : containerHeight, ...containerStyle };
        const innerContainerStyle = { height: propHeight || "auto", minHeight : containerHeight };
        const scaledVizStyle = {
            'width': (graphWidth * scale),
            'height': (graphHeight * scale),
            'transform' : "scale3d(" + scale + "," + scale + ",1)"
        };

        //const innerElemStyle = {
        //    paddingTop: Math.max(0, (containerHeight - scaledVizStyle.height) / 2)
        //};

        const commonChildProps = {
            objectGraph: orderedNodes,
            graphHeight, graphWidth, dims, memoized, diseaseToIndex,
            containerHeight, containerWidth, scale,
            'onNodeMouseIn' : this.handleNodeMouseIn,
            'onNodeMouseLeave' : this.handleNodeMouseLeave,
            //'onNodeClick' : this.handleNodeClick,
            ...passProps, ...this.state
        };

        let selectedNodePane = null;
        if (typeof renderDetailPane === 'function'){
            selectedNodePane = renderDetailPane({
                objectGraph,
                currSelectedNodeId,
                memoized,
                diseaseToIndex,
                'unselectNode' : this.handleUnselectNode,
                'onNodeClick' : this.handleNodeClick,
            });
        }

        const detailPaneHasNode = !!(selectedNodePane && currSelectedNodeId);
        const hasExtraHeight = containerHeight >= scaledVizStyle.height;
        const hasExtraWidth = (typeof containerWidth === "number" && containerWidth >= scaledVizStyle.width);
        const isScrollable = !hasExtraHeight || !hasExtraWidth || detailPaneHasNode;

        return (
            <div className="pedigree-viz-container" style={outerContainerStyle} data-selected-node={currSelectedNodeId}>
                <div className="inner-container" ref={this.innerRef} style={innerContainerStyle}
                    onMouseDown={this.handleContainerMouseDown}
                    onMouseMove={this.handleContainerMouseMove}
                    data-has-extra-height={hasExtraHeight}
                    data-scrollable={isScrollable}
                    data-mouse-down={isMouseDownOnContainer}>
                    <div className="viz-area" style={scaledVizStyle} data-scale={scale}>
                        <ShapesLayer {...commonChildProps} />
                        <RelationshipsLayer {...commonChildProps} />
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
    const { graphHeight, graphWidth } = props;
    const svgStyle = { width: graphWidth, height: graphHeight };
    return (
        <svg className="shapes-layer" viewBox={"0 0 " + graphWidth + " " + graphHeight} style={svgStyle}>
            <EdgesLayer {...props} />
            <SelectedNodeIdentifier {...props} />
            <IndividualNodeShapeLayer {...props} />
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
const SelectedNodeIdentifier = React.memo(function SelectedNodeIdentifier(props){
    const { memoized, currSelectedNodeId, objectGraph, dims } = props;
    const selectedNode = currSelectedNodeId && memoized.findNodeWithId(objectGraph, currSelectedNodeId);
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

    const topLeftX = dims.graphPadding + xCoord - (useWidth / 2);
    const topLeftY = dims.graphPadding + yCoord - (useHeight / 2);
    const transform = "translate(" + topLeftX + ", " + topLeftY + ")";

    return (
        <g className="selected-node-identifier" transform={transform}>
            <SelectedNodeIdentifierShape height={useHeight} width={useWidth} />
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



const RelationshipsLayer = React.memo(function RelationshipsLayer(props){
    const { relationships, ...passProps } = props;
    const visibleRelationshipElements = relationships.map(function(relationship, idx){
        const partnersStr = relationship.partners.map(function(p){ return p.id; }).join(',');
        return <RelationshipNode relationship={relationship} key={partnersStr} partnersStr={partnersStr} {...passProps} />;
    });
    return (
        <div className="relationships-layer">{ visibleRelationshipElements }</div>
    );
});


function relationshipClassName(relationship, isSelected, isBeingHovered){
    const classes = ["pedigree-relationship"];
    if (isBeingHovered) {
        classes.push('is-hovered-over');
    }
    if (isSelected) {
        classes.push('is-selected');
    }
    return classes.join(' ');
}


class RelationshipNode extends React.PureComponent {

    constructor(props){
        super(props);
        this.onMouseEnter = this.onMouseEnter.bind(this);
        //this.onClick = this.onClick.bind(this);
        this.memoized = {
            top: memoize(relationshipTopPosition)
        };
    }

    onMouseEnter(evt){
        const { onNodeMouseIn, relationship: { id } } = this.props;
        evt.stopPropagation();
        onNodeMouseIn(id);
    }

    /* Handled by PedigreeVizView currently
    onClick(evt){
        const { onNodeClick, relationship: { id } } = this.props;
        evt.stopPropagation();
        onNodeClick(id);
    }
    */

    render(){
        const {
            relationship, partnersStr, dims, onNodeMouseLeave,
            currHoverNodeId, currSelectedNodeId, editable
        } = this.props;
        const { id, children = [], partners = [], _drawing : { xCoord, yCoord } } = relationship;

        const isSelected = currSelectedNodeId === id;
        const isHoveredOver = currHoverNodeId === id;

        const elemStyle = {
            width : dims.relationshipSize,
            height: dims.relationshipSize,
            top: this.memoized.top(yCoord, dims),
            left: dims.graphPadding + xCoord - (dims.relationshipSize / 2)
        };
        return (
            <div style={elemStyle} className={relationshipClassName(relationship, isSelected, isHoveredOver)}
                id={id} data-node-type="relationship" data-partners={partnersStr}
                onMouseEnter={this.onMouseEnter} onMouseLeave={onNodeMouseLeave}>
            </div>
        );
    }
}
