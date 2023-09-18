'use strict';

import React, { useMemo } from 'react';
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
    const { objectGraph, dims, textScale, ...passProps } = props;
    // passProps contains also diseaseToIndex, showOrderBasedName, showNotes, maxHeightIndex

    const { aboveNodeTextContainerStyle, detailTextContainerStyle } = useMemo(function(){
        // These calculated styles are same for each node, so we do once here and then
        // pass down, rather than recalculating per each leaf component.
        return {
            "aboveNodeTextContainerStyle": AboveNodeText.textContainerStyle(dims, textScale),
            "detailTextContainerStyle": DetailText.textContainerStyle(dims, textScale)
        };
    }, [ dims, textScale ]);

    return (
        <div className="individuals-layer">
            { objectGraph.map(function(individual, idx){
                return <IndividualDiv {...passProps} {...{ individual, dims, aboveNodeTextContainerStyle, detailTextContainerStyle }} key={idx} />;
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
            showNotes = true,
            maxHeightIndex = Infinity,
            aboveNodeTextContainerStyle,
            detailTextContainerStyle
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
                <AboveNodeText {...{ individual, maxHeightIndex, dims, aboveNodeTextContainerStyle }} />
                <DetailText {...{ individual, dims, diseaseToIndex, showNotes, showOrderBasedName, detailTextContainerStyle }} />
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
        detailTextContainerStyle
    } = props;

    const { individualWidth: width } = dims;

    const {
        id,
        name,
        ageString,
        diseases = [],
        orderBasedName,
    } = individual;


    let diseasesBody = null;
    if (showNotes) {
        // Eventually could have more stuff here, maybe have `showNotes` be enum of various opts to display.. idk.
        let diseasesRows = diseases.map(function(disease, i){
            return (
                // Include bullet point inside text to minimize empty width
                <li className="line-item" key={"d-" + i} data-describing="disease">
                    { disease }
                </li>
            );
        });

        const diseasesLen = diseasesRows.length;
        const diseasesLimit = 8;
        // Currently trimmed according to this (at-the-moment) arbitrary-ish
        // `diseasesLimit`, in future we could take into account font-size + 1.25em lineheight
        // and measure out what a good diseasesLimit could be re: `dims.individualYSpacing`.
        // Would need to consider how to get font-size in pixels (currently is rem) .. maybe define font-size
        // in px in pedigreeviz to begin with?
        if (diseasesLen > diseasesLimit) {
            const difference = diseasesLen - diseasesLimit;
            diseasesRows = diseasesRows.slice(0, (diseasesLimit - 1));
            diseasesRows.push(<div className="line-item" key="end"><em>and { difference } more...</em></div>);
        }

        diseasesBody = <ul className="text-capitalize">{ diseasesRows }</ul>;
    }

    return (
        <div className="detail-text" style={detailTextContainerStyle}>
            <h5 data-describing="title"
                className={(showOrderBasedName ? " showing-order-based-name" : "")}
                style={{ width }}>
                { showOrderBasedName ? orderBasedName : (name || id) }
            </h5>
            { ageString ?
                <span data-describing="age" className="line-item" style={{ width }}>
                    { ageString }
                </span>
                : null }
            { diseasesBody }
        </div>
    );

});
/** @see AboveNodeText.textContainerStyle */
DetailText.textContainerStyle = function(dims, textScale = 1){
    const { individualWidth, individualHeight, individualYSpacing, individualXSpacing } = dims;
    return {
        width: individualWidth + individualXSpacing,
        maxHeight: individualYSpacing - (individualHeight / 5),
        // Add extra few px (individualHeight / 10) to account for node shape border and such.
        // Additional margin-top for .detail-text may be supplied in (S)CSS sheets.
        transform: `translate3d(0, ${individualHeight + (individualHeight / 10)}px, 0)`,
        fontSize: (0.9 * Math.min(textScale, 2)) + "rem",
        transformOrigin: `${ individualWidth / 2 }px 0`
    };
};

const AboveNodeText = React.memo(function AboveNodeText (props){
    const {
        individual,
        maxHeightIndex,
        aboveNodeTextContainerStyle
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

    return (
        <div className="above-node-text" data-describing="ancestry" style={aboveNodeTextContainerStyle}>
            { showAncestry.join(" • ") }
        </div>
    );
});
/**
 * Could potentially make this func a prop eventually if publish/export PedigreeViz as
 * a standalone library to allow people to customize.
 */
AboveNodeText.textContainerStyle = function(dims, textScale = 1){
    const { individualWidth, individualHeight, individualXSpacing } = dims;
    return {
        width: individualWidth + individualXSpacing,
        // Add extra few px to account for node shape border and such.
        // Additional margin-top for .detail-text may be supplied in (S)CSS sheets.
        transform: `translate3d(-${ individualXSpacing / 2 }px,0,0)`,
        // Enough space for 'selected-node-identifier'
        bottom: individualHeight * 1.4,
        // Scaling with fontSize makes it a little easier to keep text containers their intended width (with text-wrapping for text within it)
        // to avoid text overflowing (or containers overlapping) at greater scales.
        // Not too sure if there is performance impact (i.e. in browser repaints) compared to scale3d(..) tho..
        fontSize: Math.min(textScale, 2) + "rem",
        // Below necessary if changing from scaling fontSize to using transform: scale3d(..) or similar:
        // transformOrigin: `${ individualWidth / 2 }px 100%`
    };
};

/** Potential TODO for if making PedigreeViz user-editable in future */
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
