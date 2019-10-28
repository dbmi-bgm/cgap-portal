
import React from 'react';
import memoize from 'memoize-one';
import { standardizeObjectsInList, createObjectGraph, createRelationships } from './data-utilities';
import { assignTreeHeightIndices, orderObjectGraph, positionObjectGraph } from './layout-utilities';
import { getGraphHeight, getGraphWidth, createEdges } from './layout-utilities-drawing';

/**
 * Default values for `props.dimensionOpts`
 */
export const POSITION_DEFAULTS = {
    individualWidth: 80,
    individualXSpacing: 80, // THIS MUST BE EQUAL TO OR MULTIPLE OF INDIVIDUAL WIDTH FOR TIME BEING
    individualHeight: 80,
    individualYSpacing: 180,
    graphPadding: 60,
    relationshipSize: 40,
    edgeLedge: 40,
    edgeCornerDiameter: 20
};

export function buildGraphData(dataset, dimensionOpts, filterUnrelatedIndividuals = false){
    const jsonList = standardizeObjectsInList(dataset);
    const { objectGraph, disconnectedIndividuals } = createObjectGraph(jsonList, filterUnrelatedIndividuals);
    const relationships = createRelationships(objectGraph);
    assignTreeHeightIndices(objectGraph);
    const order = orderObjectGraph(objectGraph, relationships);
    const dims = getFullDims(dimensionOpts);
    positionObjectGraph(objectGraph, order, dims);
    // Add extra to offset text @ bottom of nodes.
    const graphHeight = getGraphHeight(order.orderByHeightIndex, dims) + 60;
    const graphWidth = getGraphWidth(objectGraph, dims);
    const edges = createEdges(objectGraph, dims, graphHeight);

    return {
        objectGraph,
        disconnectedIndividuals,
        relationships,
        order,
        dims,
        graphHeight,
        graphWidth,
        edges
    };
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
