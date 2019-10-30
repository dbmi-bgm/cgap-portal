
import React from 'react';
import memoize from 'memoize-one';
import { standardizeObjectsInList, createObjectGraph, createRelationships } from './data-utilities';
import { assignTreeHeightIndices, orderObjectGraph, positionObjectGraph } from './layout-utilities';
import { getGraphHeight, getGraphWidth, createEdges } from './layout-utilities-drawing';

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

/**
 * Function to parse dataset into graph (and associated data).
 *
 * @param {Object[]} dataset - List of individual JSON items.
 * @param {Object} [dimensionOpts={}] - Dimension options.
 * @param {boolean} [filterUnrelatedIndividuals=false] - Whether to include detached (from proband) individuals in graph.
 * @returns {{ objectGraph, detachedIndividuals, edges, graphHeight, graphWidth, order, dims, relationships }} Props for PedigreeVizView
 */
export function buildGraphData(dataset, dimensionOpts = {}, filterUnrelatedIndividuals = false){
    const jsonList = standardizeObjectsInList(dataset);
    const {
        objectGraph,
        disconnectedIndividuals: detachedIndividuals
    } = createObjectGraph(jsonList, filterUnrelatedIndividuals);
    const relationships = createRelationships(objectGraph);
    assignTreeHeightIndices(objectGraph);
    const order = orderObjectGraph(objectGraph, relationships);
    const dims = getFullDims(dimensionOpts);
    positionObjectGraph(objectGraph, order, dims);
    // Add extra to offset text @ bottom of nodes.
    const graphHeight = getGraphHeight(order.orderByHeightIndex, dims) + 60;
    const graphWidth = getGraphWidth(objectGraph, dims);
    // Object consisting of { adjustableEdges, directEdges, visibilityGraph, subdivisions }
    const edges = createEdges(objectGraph, dims, graphHeight);

    dims.edgeCornerDiameter = Math.min(
        dims.edgeCornerDiameter,
        Math.floor(Math.min(
            dims.individualWidth,
            dims.individualHeight,
            dims.individualXSpacing,
            dims.individualYSpacing,
            // dims.relationshipSize // include?
        ) / edges.subdivisions)
    );

    return {
        objectGraph,
        detachedIndividuals,
        relationships,
        order,
        dims,
        graphHeight,
        graphWidth,
        edges
    };
}

function getFullDims(dimensionOpts = {}){
    const dims = Object.assign({}, POSITION_DEFAULTS, dimensionOpts);
    dims.graphPadding = Math.max(dims.graphPadding, dims.individualXSpacing, dims.individualYSpacing);
    dims.edgeLedge = dims.individualWidth / 2;
    return dims;
}

export class GraphTransformer extends React.PureComponent {

    constructor(props){
        super(props);
        this.buildGraphData = memoize(buildGraphData);
    }

    render(){
        const { dataset, children, dimensionOpts, filterUnrelatedIndividuals, ...passProps } = this.props;
        const graphData = this.buildGraphData(dataset, dimensionOpts, filterUnrelatedIndividuals);
        const viewProps = { ...passProps, ...graphData };
        return React.Children.map(children, (child) => React.cloneElement(child, viewProps));
    }
}
