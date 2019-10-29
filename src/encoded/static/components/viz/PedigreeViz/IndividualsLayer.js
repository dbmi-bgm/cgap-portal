'use strict';

import React from 'react';
import memoize from 'memoize-one';
import { individualLeftPosition, individualTopPosition } from './layout-utilities-drawing';

/** WE MIGHT GET RID OF THIS FILE LATER AND JUST HAVE SVG NODES **/
/** HOWEVER ARE KEEPING FOR NOW BECAUSE IF WANT TO SHOW "pop-up" ui or similar, is much simpler with HTML than SVG **/

export function individualClassName(individual, isBeingHovered = false, isSelected = false){
    const classes = [];
    const { gender, isProband = false, diseases = [], isDeceased } = individual;
    if (isDeceased){
        classes.push("is-deceased");
    }
    if (diseases.length > 0){
        classes.push("is-affected");
    }
    if (gender){
        classes.push("gender-" + gender);
    }
    if (isProband === true){
        classes.push('is-proband');
    }
    if (isBeingHovered) {
        classes.push('is-hovered-over');
    }
    if (isSelected) {
        classes.push('is-selected');
    }
    return classes.join(' ');
}





export const IndividualsLayer = React.memo(function IndividualsLayer(props){
    const { objectGraph: g, ...passProps } = props;
    return (
        <div className="individuals-layer">
            { g.map((indv) => <IndividualDiv key={indv.id} individual={indv} {...passProps} /> )}
        </div>
    );
});


export class IndividualDiv extends React.PureComponent {

    constructor(props){
        super(props);
        this.onMouseEnter = this.onMouseEnter.bind(this);
        //this.onClick = this.onClick.bind(this);
        this.onAddBtnClick = this.onAddBtnClick.bind(this);
        this.state = {
            'currentOption' : null
        };
        this.memoized = {
            className   : memoize(individualClassName),
            left        : memoize(individualLeftPosition),
            top         : memoize(individualTopPosition)
        };
    }

    componentDidUpdate(pastProps, pastState){
        const { selectedNode, individual } = this.props;
        if (selectedNode !== pastProps.selectedNode){
            if (selectedNode !== individual){
                this.setState(function({ currentOption }){
                    if (currentOption !== null){
                        return { currentOption: null };
                    }
                    return null;
                });
            }
        }
    }

    onMouseEnter(evt){
        const { onNodeMouseIn, individual: { id } } = this.props;
        evt.stopPropagation();
        onNodeMouseIn(id);
    }

    /* Currently being managed by index.js / PedigreeVizView
    onClick(evt){
        const { onNodeClick, individual: { id } } = this.props;
        evt.stopPropagation();
        onNodeClick(id);
    }
    */

    /** Not used atm */
    onAddBtnClick(evt){
        this.setState({ "currentOption" : "add" });
    }

    /** Not used atm */
    handleAddNewIndividual(evt){
        evt.persist();
        console.log('EEE', evt);
    }

    render(){
        const {
            dims, graphHeight, individual, onNodeMouseLeave,
            hoveredNode, selectedNode, editable
        } = this.props;
        const { currentOption } = this.state;
        const { id, name, _drawing : { heightIndex, xCoord, yCoord } } = individual;
        const elemStyle = {
            width       : dims.individualWidth,
            height      : dims.individualHeight,
            top         : this.memoized.top(yCoord, dims),//this.memoized.top(heightIndex, dims, graphHeight),
            left        : this.memoized.left(xCoord, dims)
        };
        const isSelected = selectedNode === individual;
        const isBeingHovered = hoveredNode === individual;
        let actionButtons = null;
        if (editable && !currentOption){
            /** TODO */
            actionButtons = (
                <div className={"btns-container" + (isSelected || isBeingHovered ? " visible" : "")}>
                    <button type="button" className="add-btn" onClick={this.onAddBtnClick}>
                        <i className="icon icon-fw icon-plus fas"/>
                    </button>
                    <button type="button" className="add-btn">
                        <i className="icon icon-fw icon-link fas"/>
                    </button>
                </div>
            );
        }

        const indvNodeCls = (
            "pedigree-individual"
            + (editable ? " is-editable " : " ")
            + this.memoized.className(individual, isBeingHovered, isSelected)
        );

        return (
            <div style={elemStyle} id={id} data-height-index={heightIndex} className={indvNodeCls}
                data-y-coord={yCoord} data-node-type="individual"
                onMouseEnter={this.onMouseEnter} onMouseLeave={onNodeMouseLeave}>
                { actionButtons }
                { currentOption === 'add' ? /** TODO */
                    <NodeOptionsPanel {...this.props} onAddSelect={this.handleAddNewIndividual} /> : null
                }
                {/*
                <div className="detail-text" style={detailStyle}>
                    <span className="name line-item">{ name }</span>
                </div>
                */}
            </div>
        );
    }
}

/** TODO */
function NodeOptionsPanel(props){
    const { onAddSelect, individual } = props;
    const { _parentReferences } = individual;
    const numParents = _parentReferences.length;
    return (
        <div className="node-options-panel btns-container">
            <select onChange={onAddSelect} onSelect={onAddSelect}>
                <option name="sibling">Sibling</option>
                <option name="child">Child</option>
                <option name="parent">{ numParents === 0 ? "Parents" : "Parent" }</option>
            </select>
        </div>
    );
}
