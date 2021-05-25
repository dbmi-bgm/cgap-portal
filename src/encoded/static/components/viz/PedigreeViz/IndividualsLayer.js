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
    // passProps contains also diseaseToIndex, showOrderBasedName, showNotes, textScale, textScaleTransformStr, maxHeightIndex
    return (
        <div className="individuals-layer">
            { g.map(function(individual, idx){
                return <IndividualDiv {...passProps} {...{ individual }} key={individual.id} />;
            }) }
        </div>
    );
});


export class IndividualDiv extends React.PureComponent {

    constructor(props){
        super(props);
        this.onMouseEnter = this.onMouseEnter.bind(this);

        this.memoized = {
            className   : memoize(individualClassName),
            left        : memoize(individualLeftPosition),
            top         : memoize(individualTopPosition)
        };
    }

    // state.currentOption is related to some some early ideas/logic
    // to potentially show an 'actions' menu which could alllow
    // to add child, parent, sibling, relationship, etc. in future
    // (as part of making pedigreviz end-user-editable).
    // componentDidUpdate(pastProps, pastState){
    //     const { selectedNode, individual } = this.props;
    //     if (selectedNode !== pastProps.selectedNode){
    //         if (selectedNode !== individual){
    //             this.setState(function({ currentOption }){
    //                 if (currentOption !== null){
    //                     return { currentOption: null };
    //                 }
    //                 return null;
    //             });
    //         }
    //     }
    // }

    /**
     * 'mouseenter' event doesn't bubble, so we bind it to leaf element
     * here, rather than handling in PedigreeVizViewUserInterface like
     * done for mouseup.
     */
    onMouseEnter(evt){
        const { onNodeMouseIn, individual: { id } } = this.props;
        evt.stopPropagation();
        onNodeMouseIn(id);
    }

    render(){
        const {
            dims,
            graphHeight,
            individual,
            onNodeMouseLeave,
            hoveredNode,
            selectedNode,
            editable,

            diseaseToIndex,
            showOrderBasedName = true,
            textScale,
            showNotes = true,
            maxHeightIndex = Infinity
        } = this.props;

        const {
            individualWidth: width,
            individualHeight: height
        } = dims;

        const { id, name, _drawing : { heightIndex, xCoord, yCoord } } = individual;
        const elemStyle = {
            width,
            height,
            top         : this.memoized.top(yCoord, dims),//this.memoized.top(heightIndex, dims, graphHeight),
            left        : this.memoized.left(xCoord, dims)
        };

        // Node selection itself is performed in PedigreeVizViewUserInterface, upon mouseup event in viewport (if event target === node).
        const isSelected = selectedNode === individual;
        const isBeingHovered = hoveredNode === individual;

        // const { currentOption } = this.state;
        // let actionButtons = null;
        // if (editable && !currentOption){
        //     /** TODO */
        //     actionButtons = (
        //         <div className={"btns-container" + (isSelected || isBeingHovered ? " visible" : "")}>
        //             <button type="button" className="add-btn" onClick={this.onAddBtnClick}>
        //                 <i className="icon icon-fw icon-plus fas"/>
        //             </button>
        //             <button type="button" className="add-btn">
        //                 <i className="icon icon-fw icon-link fas"/>
        //             </button>
        //         </div>
        //     );
        // }

        const indvNodeCls = (
            "pedigree-individual"
            + (editable ? " is-editable " : " ")
            + this.memoized.className(individual, isBeingHovered, isSelected)
        );

        return (
            <div style={elemStyle} id={id} data-height-index={heightIndex} className={indvNodeCls}
                data-y-coord={yCoord} data-node-type="individual">
                {/* actionButtons */}
                {/* currentOption === 'add' ?
                    <NodeOptionsPanel {...this.props} onAddSelect={this.handleAddNewIndividual} /> : null
                */}
                <div className="mouse-event-area" onMouseEnter={this.onMouseEnter} onMouseLeave={onNodeMouseLeave}/>
                <AboveNodeText {...{ individual, maxHeightIndex, dims, textScale }} />
                <DetailText {...{ individual, dims, diseaseToIndex, textScale, showNotes, showOrderBasedName }} />
            </div>
        );
    }
}

/** @todo Implement things like age, stillBirth, isEctopic, etc. */
const DetailText = React.memo(function DetailText (props) {
    const {
        individual,
        dims,
        //diseaseToIndex = {},
        showOrderBasedName = true,
        showNotes = true, // Name of this prop may change in future.
        textScale = 1,
        diseasesLimit = 8
    } = props;

    const {
        individualWidth: width,
        individualHeight: height,
        individualYSpacing,
        individualXSpacing
    } = dims;

    const {
        id,
        name,
        ageString,
        diseases = [],
        orderBasedName,
    } = individual;


    const textContainerStyle = {
        width: width + individualXSpacing,
        maxHeight: individualYSpacing - (height / 5),
        // Add extra few px to account for node shape border and such.
        // Additional margin-top for .detail-text may be supplied in (S)CSS sheets.
        transform: `translate3d(0, ${height + (height / 10)}px, 0)`,
        fontSize: (0.9 * Math.min(textScale, 2)) + "rem",
        transformOrigin: `${ width / 2 }px 0`
    };


    let diseasesBody = null;
    if (showNotes) {
        // Eventually could have more stuff here, maybe have showNotes be enum of various opts to display.. idk.
        /*
        diseases.filter(function(disease){
            return !diseaseToIndex[disease];
        })
        */
        let diseasesRows = diseases.map(function(disease, i){
            return (
                <li className="line-item" key={"d-" + i} data-describing="disease">
                    { disease }
                </li>
            );
        });

        const diseasesLen = diseasesRows.length;

        if (diseasesLen > diseasesLimit) {
            const difference = diseasesLen - diseasesLimit;
            diseasesRows = diseasesRows.slice(0, (diseasesLimit - 1));
            diseasesRows.push(<div className="line-item" key="end"><em>and { difference } more...</em></div>);
        }

        diseasesBody = <ul>{ diseasesRows }</ul>;
    }

    return (
        <div className="detail-text" style={textContainerStyle}>
            <h5 data-describing="title"
                className={(showOrderBasedName ? " showing-order-based-name" : "")}
                style={{ width }}>
                { showOrderBasedName ? orderBasedName : (name || id) }
            </h5>
            { ageString ?
                <span data-describing="age" className="line-item" style={{ minWidth: width }}>
                    { ageString }
                </span>
                : null }
            { diseasesBody }
        </div>
    );


});

const AboveNodeText = React.memo(function AboveNodeText (props){
    const {
        individual,
        dims: { individualXSpacing, individualHeight, individualWidth },
        maxHeightIndex,
        textScale = 1
    } = props;

    const {
        _drawing : { heightIndex },
        ancestry = []
    } = individual;

    if (heightIndex !== maxHeightIndex) return null;
    if (ancestry.length === 0) return null;

    // TODO return null if all partners in relationship have same ancestry contents
    // and then render out above the relationship node.

    const moreAncestryPresent = ancestry.length > 3;
    const showAncestry = moreAncestryPresent ? ancestry.slice(0, 3) : ancestry; // Up to 3 shown.

    const textContainerStyle = {
        width: individualWidth + individualXSpacing,
        // Add extra few px to account for node shape border and such.
        // Additional margin-top for .detail-text may be supplied in (S)CSS sheets.
        transform: `translate3d(-${ individualXSpacing / 2 }px,0,0)`,
        bottom: individualHeight * 1.5,
        fontSize: Math.min(textScale, 2) + "rem",
        transformOrigin: `${ individualWidth / 2 }px 100%`
    };

    return (
        <div className="above-node-text" data-describing="ancestry" style={textContainerStyle}>
            { showAncestry.join(" • ") }
        </div>
    );
});

/** TODO */
// function NodeOptionsPanel(props){
//     const { onAddSelect, individual } = props;
//     const { _parentReferences } = individual;
//     const numParents = _parentReferences.length;
//     return (
//         <div className="node-options-panel btns-container">
//             <select onChange={onAddSelect} onSelect={onAddSelect}>
//                 <option name="sibling">Sibling</option>
//                 <option name="child">Child</option>
//                 <option name="parent">{ numParents === 0 ? "Parents" : "Parent" }</option>
//             </select>
//         </div>
//     );
// }
