
import React, { useMemo } from 'react';
import { standardizeObjectsInList, createObjectGraph, createRelationships } from './data-utilities';
import { assignTreeHeightIndices, orderObjectGraph, positionObjectGraph } from './layout-utilities';
import { getGraphHeight, getGraphWidth, createEdges } from './layout-utilities-drawing';
import { graphTransformerPropTypes } from './prop-types';
import { graphTransformerDefaultProps, POSITION_DEFAULTS } from './default-props';

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
        objectGraph: initialObjectGraph,
        disconnectedIndividuals: detachedIndividuals
    } = createObjectGraph(jsonList, filterUnrelatedIndividuals);
    const initialRelationships = createRelationships(initialObjectGraph);
    const maxHeightIdx = assignTreeHeightIndices(initialObjectGraph);
    //const { objectGraph, relationships, ...order } = orderObjectGraph(initialObjectGraph, initialRelationships, maxHeightIdx);
    const { objectGraph, relationships, ...order } = orderObjectGraph(initialObjectGraph, initialRelationships, maxHeightIdx);
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

/** React Component wrapper */
export function GraphTransformer(props){
    const { dataset, children, dimensionOpts, filterUnrelatedIndividuals, ...passProps } = props;
    const graphData = useMemo(function(){
        return buildGraphData(dataset, dimensionOpts, filterUnrelatedIndividuals);
    }, [ dataset, dimensionOpts, filterUnrelatedIndividuals ]);
    const viewProps = { ...passProps, ...graphData };

    return React.Children.map(children, function(child){ return React.cloneElement(child, viewProps); });
}
GraphTransformer.propTypes = graphTransformerPropTypes;
GraphTransformer.defaultProps = graphTransformerDefaultProps;
