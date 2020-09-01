'use strict';

import React from 'react';
import { DefaultDetailPaneComponent } from './DefaultDetailPaneComponent';

/**
 * Default values for `props.dimensionOpts`
 * It is not advised to change these, including
 * in passed-in props, unless are up-to-date with
 * visibility graph generation code.
 * Maybe will handle more number options in future.
 */
export const POSITION_DEFAULTS = {
    individualWidth: 80,        // Should be divisible by 2 (@see `computeVisibilityGraph`)
    individualXSpacing: 80,     // THIS MUST BE EQUAL TO OR MULTIPLE OF INDIVIDUAL WIDTH FOR TIME BEING (@see `computeVisibilityGraph`)
    individualHeight: 80,       // This could vary I think
    individualYSpacing: 180,    // THIS MUST BE DIVISIBLE BY 60 (or by 2, 3, 4, (& ideally - 5, 6)) (for possible `subdivisionsUsed` in finding visibilitygraph/edges) (@see `computeVisibilityGraph`)
    graphPadding: 60,
    relationshipSize: 40,
    edgeCornerDiameter: 20
};

export const graphTransformerDefaultProps = {
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
};

export const pedigreeVizViewDefaultProps = {

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
     * Disables node selection.
     * Useful if purposely excluding `renderDetailPane`.
     * E.g. for a miniature preview view.
     */
    "disableSelect" : false,

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
     * @type {!function}
     */
    "renderDetailPane" : null,


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
     * If true, will show diseases currently that aren't part of color-coded ones.
     * This might change later, maybe could select from enum something to display,
     * etc.
     *
     * @type {boolean}
     */
    "showNotes" : true,

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


    "showZoomControls" : true,


    /**
     * If when detail pane is open it reduces width or height
     * of the container/viewport, can add the amount removed
     * here to be used in re-setting `minScale` when pane is
     * open.
     */
    "detailPaneOpenOffsetWidth" : 0,
    "detailPaneOpenOffsetHeight" : 0,


    /** Whether to allow to zoom w. mousewheel. Experimental. */
    "enableMouseWheelZoom" : false,


    /** Whether to allow to zoom w. mousewheel. Experimental. */
    "enablePinchZoom" : true
};

export const pedigreeVizDefaultProps = {
    ...graphTransformerDefaultProps,
    ...pedigreeVizViewDefaultProps,

    /**
     * A function which returns a React Component.
     * Will be instantiated/rendered at side of visualization.
     *
     * @type {!function}
     */

    "renderDetailPane" : function(vizProps){
        return <DefaultDetailPaneComponent {...vizProps} />;
    },
};
