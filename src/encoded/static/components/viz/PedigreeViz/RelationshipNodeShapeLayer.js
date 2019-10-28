import React from 'react';
import memoize from 'memoize-one';
import { relationshipTopPosition } from './layout-utilities-drawing';



export const RelationshipNodeShapeLayer = React.memo(function IndividualNodeShapeLayer(props){
    const { relationships, dims, ...passProps } = props;
    const halfRelationshipSize = dims.relationshipSize / 2;
    const relationshipCircleRadius = halfRelationshipSize * 0.6;
    const visibleRelationshipElements = relationships.map(function(relationship, idx){
        const partnersStr = relationship.partners.map(function(p){ return p.id; }).join(',');
        return (
            <RelationshipNode key={partnersStr} {...passProps}
                {...{ relationship, partnersStr, dims, halfRelationshipSize, relationshipCircleRadius }} />
        );
    });

    return <g className="relationships-layer">{ visibleRelationshipElements }</g>;
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
        this.memoized = {
            top: memoize(relationshipTopPosition)
        };
    }

    onMouseEnter(evt){
        const { onNodeMouseIn, relationship: { id } } = this.props;
        evt.stopPropagation();
        onNodeMouseIn(id);
    }

    /*
    componentDidUpdate(pastProps){
        Object.keys(pastProps).forEach((k)=>{
            if (pastProps[k] !== this.props[k]){
                console.log('RRR', k, pastProps[k], this.props[k]);
            }
        });
    }
    */

    /* Handled by PedigreeVizView currently
    onClick(evt){}
    */

    render(){
        const {
            relationship, partnersStr, dims, halfRelationshipSize, relationshipCircleRadius,
            onNodeMouseLeave, selectedNode, hoveredNode, editable
        } = this.props;
        const { id, _drawing : { xCoord, yCoord } } = relationship;

        const isSelected = selectedNode === relationship;
        const isHoveredOver = hoveredNode === relationship;
        const x = dims.graphPadding + xCoord - halfRelationshipSize;
        const y = this.memoized.top(yCoord, dims);

        let groupTransform = "translate(" + x + " " + y + ")";
        if (isHoveredOver && !isSelected){
            groupTransform += (
                " scale(1.1)"
                + " translate(" + (-dims.relationshipSize * .05) + " " + (-dims.relationshipSize * .05) + ")"
            );
        }

        return (
            <g className={relationshipClassName(relationship, isSelected, isHoveredOver)} transform={groupTransform}>
                <circle id={id} data-node-type="relationship" data-partners={partnersStr}
                    onMouseEnter={this.onMouseEnter} onMouseLeave={onNodeMouseLeave}
                    r={relationshipCircleRadius} cx={halfRelationshipSize} cy={halfRelationshipSize} />
            </g>
        );
    }
}

