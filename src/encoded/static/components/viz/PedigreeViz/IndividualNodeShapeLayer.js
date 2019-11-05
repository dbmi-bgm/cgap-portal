import React from 'react';
import memoize from 'memoize-one';
import { path as d3Path } from 'd3-path';
import { individualLeftPosition, individualTopPosition } from './layout-utilities-drawing';
import { individualClassName } from './IndividualsLayer';

/** TODO split up into folder `Individual` (and include IndividualsLayer.js stuff in it maybe) */

export const IndividualNodeShapeLayer = React.memo(function IndividualNodeShapeLayer(props){
    const { objectGraph: g, ...passProps } = props;
    const { dims, vizViewID = 0 } = passProps;
    return (
        <g className="individuals-bg-shape-layer">
            <ClipPathDefinitions {...{ dims, vizViewID }} />
            { g.map((indv) => <IndividualNodeShape {...passProps} key={indv.id} individual={indv} /> )}
        </g>
    );
});

/**
 * These are instances of SVG shapes used for clip paths. We predefine them here
 * so Individual shapes may performantly reuse them for clipping background color
 * sections instead of defining new clip paths at each node.
 */
const ClipPathDefinitions = React.memo(function ClipPathDefinitions({ vizViewID, dims : { individualHeight: height, individualWidth: width } }){
    const numAppend = "_viewID" + vizViewID;
    return (
        <defs>
            <marker id={"pedigree_lineArrow" + numAppend} viewBox="0 0 10 10" refX="5" refY="5"
                markerWidth="4" markerHeight="4"
                orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" />
            </marker>
            <marker id={"pedigree_clipPath_for_debug_edge_circle" + numAppend} viewBox="0 0 10 10" refX="5" refY="5"
                markerWidth="4" markerHeight="4"
                orient="auto-start-reverse">
                <circle r={5} cx={5} cy={5} style={{ fill: "#0002" }} />
            </marker>
            <clipPath id={"pedigree_clipPath_for_FemaleShape" + numAppend}>
                <FemaleShape {...{ height, width }} />
            </clipPath>
            <clipPath id={"pedigree_clipPath_for_MaleShape" + numAppend}>
                <MaleShape {...{ height, width }} />
            </clipPath>
            <clipPath id={"pedigree_clipPath_for_UndeterminedShape" + numAppend}>
                <UndeterminedShape {...{ height, width }} />
            </clipPath>
            <clipPath id={"pedigree_clipPath_for_TerminatedPregnancyShape" + numAppend}>
                <TerminatedPregnancyShape {...{ height, width }} />
            </clipPath>
        </defs>
    );
});


const FemaleShape = React.memo(function FemaleShape({ height, width, ...passProps }){
    return <circle r={Math.floor(Math.min(height, width) / 2)} cx={Math.floor(width / 2)} cy={Math.floor(height / 2)} {...passProps} />;
});

const MaleShape = React.memo(function MaleShape({ height, width, ...passProps }){
    return <rect width={width} height={height} {...passProps} />;
});

const UndeterminedShape = React.memo(function UndeterminedShape({ height, width, ...passProps }){
    const pHeight = height * 1.15;
    const pWidth = width * 1.15;
    const pHypo = Math.sqrt((pHeight ** 2) + (pWidth ** 2)) / 2;
    const hypo = Math.sqrt((height ** 2) + (width ** 2)) / 2;
    const halfHypo = (hypo / 2);
    const transform = "rotate(45) translate(" + (halfHypo - ((pHypo - hypo) / 2)) + " -" + (halfHypo + ((pHypo - hypo) / 2)) + ")";
    return <rect width={pHypo} height={pHypo} transform={transform} rx={pHypo / 4} {...passProps} />;
});

const TerminatedPregnancyShape = React.memo(function TerminatedPregnancyShape({ width, height, ...passProps }){
    const path = d3Path();
    const y1 = 0;           //height * 0.25;
    const y2 = (height / 2);  //height * 0.75;
    path.moveTo(0, y2);
    path.lineTo(width / 2, y1);
    path.lineTo(width, y2);
    path.lineTo(0, y2);
    path.closePath();
    return <path d={path.toString()} {...passProps} />;
});


function getIndividualShape(individual, width, height){
    const { isPregnancy, isDeceased, gender } = individual;
    let shape = <rect width={width} height={height} />; // Default
    if (isPregnancy && isDeceased){
        shape = <TerminatedPregnancyShape {...{ width, height }} />;
    } else if (gender === "female"){
        shape = <FemaleShape {...{ width, height }} />;
    } else if (gender === "male"){
        shape = <MaleShape {...{ width, height }} />;
    } else {
        shape = <UndeterminedShape {...{ width, height }} />;
    }
    return shape;
}


export class IndividualNodeShape extends React.PureComponent {

    constructor(props){
        super(props);
        this.memoized = {
            className           : memoize(individualClassName),
            left                : memoize(individualLeftPosition),
            top                 : memoize(individualTopPosition),
            getIndividualShape  : memoize(getIndividualShape)
        };
    }

    render(){
        const {
            dims,
            individual,
            diseaseToIndex,
            textScale,
            textScaleTransformStr,
            vizViewID = 0,
            hoveredNode = null,
            selectedNode = null,
            showOrderBasedName = true,
            maxHeightIndex = Infinity
        } = this.props;
        const { individualWidth, individualHeight } = dims;
        const { id, _drawing : { xCoord, yCoord } } = individual;

        const isSelected = selectedNode === individual;
        const isHoveredOver = hoveredNode === individual;

        /*
        const height = isHoveredOver ? individualHeight * 1.2 : individualHeight;
        const width = isHoveredOver ? individualWidth * 1.2 : individualWidth;
        */

        const height = individualHeight;
        const width = individualWidth;
        const halfWidth = width / 2;
        const aboveNodeTextY = (dims.individualYSpacing - dims.individualHeight) / 3;
        const shape = this.memoized.getIndividualShape(individual, height, width);
        const top = this.memoized.top(yCoord, dims);
        const left = this.memoized.left(xCoord, dims);

        let groupTransform = "translate(" + left + " " + top + ")";
        if (isHoveredOver && !isSelected){
            groupTransform += (
                " scale(1.1)"
                + " translate(" + (-width * .05) + " " + (-height * .05) + ")"
            );
        }

        // Create 2 copies of the shape, one foreground and one background
        const bgShape = { ...shape, props : {
            ...shape.props,
            className: "bg-shape-copy"
        } };

        const fgShape = { ...shape, props: {
            ...shape.props, className: "fg-shape"
        } };

        return (
            <g width={width} height={height} transform={groupTransform} data-individual-id={id}
                className={"pedigree-individual-shape " + this.memoized.className(individual, isHoveredOver, isSelected)}>
                { bgShape }
                <UnderlayMarkers {...{ width, height, individual, shape, diseaseToIndex, vizViewID }} />
                { fgShape }
                <OverlayMarkers {...{ width, height, individual, shape, textScaleTransformStr, vizViewID }} />
                <AboveNodeText {...{ width, height, individual, maxHeightIndex, dims, halfWidth, aboveNodeTextY, textScale, textScaleTransformStr }} />
                <UnderNodeText {...{ width, height, individual, shape, diseaseToIndex, dims, halfWidth, showOrderBasedName, textScale, textScaleTransformStr }} />
            </g>
        );
    }
}


function shapeTypeToString(shapeType){
    switch (shapeType){
        case TerminatedPregnancyShape:
            return "TerminatedPregnancyShape";
        case FemaleShape:
            return "FemaleShape";
        case MaleShape:
            return "MaleShape";
        case UndeterminedShape:
            return "UndeterminedShape";
    }
}


const AffectedBGPieChart = React.memo(function AffectedBGPieChart({
    width,
    height,
    shape,
    vizViewID = 0,
    diseases = [],
    diseaseToIndex = {}
}){
    const visibleDiseases = diseases.filter(function(disease){
        return diseaseToIndex[disease];
    });
    const diseaseLen = visibleDiseases.length;
    if (diseaseLen === 0) return;
    const centerX = width / 2;
    const centerY = shape.type === TerminatedPregnancyShape ? height / 4 : height / 2;
    const clipID = "pedigree_clipPath_for_" + (shapeTypeToString(shape.type)) + "_viewID" + vizViewID;
    const startAngle = -(Math.PI / 2);
    const endAngle = (2 * Math.PI ) / diseaseLen;
    const arcPaths = visibleDiseases.map(function(disease, idx){
        const path = d3Path();
        path.moveTo(centerX, centerY);
        path.arc(
            centerX,
            centerY,
            Math.max(width, height),
            startAngle + (endAngle * idx),
            startAngle + (endAngle * (idx + 1))
        );
        path.closePath();
        return (
            <path d={path.toString()} clipPath={"url(#" + clipID + ")"} key={idx}
                data-disease-index={diseaseToIndex[disease]} title={disease}
                className="disease-arc" />
        );
    });
    return <g className="disease-path-arcs">{ arcPaths }</g>;
});

const UnderlayMarkers = React.memo(function UnderlayMarkers({ individual, width, height, shape, diseaseToIndex, vizViewID = 0 }){
    const { diseases = [], carrierOfDiseases = [], asymptoticDiseases = [] } = individual;
    const markers = [];

    if (diseases.length > 0) {
        markers.push(<AffectedBGPieChart {...{ width, height, diseases, shape, diseaseToIndex, vizViewID }} key="diseases-bg" />);
    }

    if (asymptoticDiseases.length > 0){
        markers.push(<ColumnOfDiseases {...{ individual, width, height, shape, diseaseToIndex }} key="diseases-rects" />);
    }

    if (carrierOfDiseases.length > 0){
        markers.push(<CircleOfDiseaseDots {...{ individual, width, height, shape, diseaseToIndex }} key="diseases-dots" />);
    }

    if (markers.length === 0) return null;

    return <React.Fragment>{ markers }</React.Fragment>;
});

const OverlayMarkers = React.memo(function OverlayMarkers(props){
    const {
        individual,
        width = 80,
        height = 80,
        shape,
        textScaleTransformStr = "scale3d(1,1,1)",
        vizViewID = 0
    } = props;
    const {
        //id,
        //name,
        //gender,
        isProband = false,
        isConsultand = false,
        //diseases = [],
        //carrierOfDiseases = [],
        //asymptoticDiseases = [],
        isDeceased = false,
        isPregnancy = false,
        isSpontaneousAbortion = false,
        //isTerminatedPregnancy = false,
        //_drawing : { xCoord, yCoord }
    } = individual;

    const showAsDeceased = isDeceased && !(isSpontaneousAbortion && isPregnancy);
    const showAsProband = isProband;
    const showAsConsultand = !showAsProband && isConsultand;

    const markers = [];

    if (showAsDeceased){
        // Line thru shape
        const path = d3Path();
        if (shape.type === TerminatedPregnancyShape){
            // TerminatedPregnancyShape is shorter than others, starts @ top.
            //const hypo = Math.sqrt(((width * 0.25) ** 2) + ((height * 0.25) ** 2));
            //path.moveTo((width / 2) - hypo, height / 2 + hypo);
            path.moveTo(width * 0.125, height * 0.75);
            path.lineTo(width * 0.875, 0);
        } else {
            path.moveTo(0, height);
            path.lineTo(width, 0);
        }
        markers.push(
            <path d={path.toString()} className="deceased-cross-through" key="deceased-cross-through" />
        );
    }

    if (showAsConsultand || showAsProband){
        const bottomLeftCornerOrigin = "0 " + height + "px";
        const bottomLeftScaleStyle = { transformOrigin: bottomLeftCornerOrigin, transform: textScaleTransformStr };
        // Arrow leading to bottom left corner (~)
        const path = d3Path();
        path.moveTo(-25, height + 10);
        path.lineTo(-10, height);
        markers.push(
            <path d={path.toString()} markerEnd={`url(#pedigree_lineArrow_viewID${vizViewID})`} key="consultand-arrow"
                style={bottomLeftScaleStyle} />
        );
        if (showAsProband){ // "P" text identifier
            markers.push(
                <text x={-38} y={height + 8} className="proband-identifier" key="proband-txt"
                    style={bottomLeftScaleStyle}>
                    P
                </text>
            );
        }
    }

    if (markers.length === 0) return null;

    return <React.Fragment>{ markers }</React.Fragment>;

});

/**
 * Used for showing `individual.carrierOfDiseases`.
 */
function CircleOfDiseaseDots({ individual, width, height, shape, diseaseToIndex }){
    const { carrierOfDiseases = [] } = individual;
    const visibleDiseases = carrierOfDiseases.filter(function(disease){
        return diseaseToIndex[disease];
    });
    const diseaseLen = visibleDiseases.length;

    if (diseaseLen === 0) return;
    const centerX = width / 2;
    const centerY = shape.type === TerminatedPregnancyShape ? height * 0.3 : height / 2;
    const smallestOuterDim = Math.min(width, height);
    const singleCircleRadius = smallestOuterDim / 12; // Arbitrary to what looks good
    if (diseaseLen === 1){
        return (
            <circle cx={centerX} cy={centerY} r={singleCircleRadius} className="circle-disease-dot"
                data-disease-index={diseaseToIndex[visibleDiseases[0]]} />
        );
    }
    const positioningCircleRadius = smallestOuterDim / ( shape.type === TerminatedPregnancyShape ? 8 : 4 );
    const positioningCircleCircumference = Math.PI * 2 * positioningCircleRadius;
    const maxSmallCircleRadius = ((positioningCircleCircumference / diseaseLen) / 2) - 5;
    const smallCircleRadius = Math.min(singleCircleRadius, maxSmallCircleRadius);
    const portionRadians = (Math.PI * 2) / diseaseLen;
    const startAngle = Math.PI * -0.5;
    const circleDims = visibleDiseases.map(function(diseaseStr, idx){
        return [
            (positioningCircleRadius * Math.cos(startAngle + (portionRadians * idx))) + centerX,
            (positioningCircleRadius * Math.sin(startAngle + (portionRadians * idx))) + centerY
        ];
    });

    const ringOfCircles = circleDims.map(function([ x, y ], idx){
        const diseaseStr = visibleDiseases[idx];
        return (
            <circle cx={x} cy={y} r={smallCircleRadius} className="circle-disease-dot"
                data-disease-index={diseaseToIndex[diseaseStr]} key={diseaseStr} />
        );
    });

    return (
        <React.Fragment>{ ringOfCircles }</React.Fragment>
    );
}

/**
 * Used for showing `individual.asymptoticDiseases`.
 */
function ColumnOfDiseases({ individual, width, height, shape, diseaseToIndex }){
    const { asymptoticDiseases = [] } = individual;
    const visibleDiseases = asymptoticDiseases.filter(function(disease){
        return diseaseToIndex[disease];
    });
    const diseaseLen = visibleDiseases.length;
    if (diseaseLen === 0) return;
    const clipID = "pedigree_clipPath_for_" + (shapeTypeToString(shape.type));
    const topY = 0;
    const centerX = width / 2;
    const bottomY = shape.type === TerminatedPregnancyShape ? height / 2 : height;
    const colHeight = bottomY - topY;
    const colWidth = Math.max(width / 10, 10);
    const partitionHeight = colHeight / diseaseLen;

    const colOfRects = visibleDiseases.map(function(diseaseStr, idx){
        return (
            <rect x={centerX - (colWidth / 2)} y={colHeight - ((idx + 1) * partitionHeight)}
                width={colWidth} height={partitionHeight} className="rect-disease-partition"
                data-disease-index={diseaseToIndex[diseaseStr]} key={diseaseStr} clipPath={"url(#" + clipID + ")"} />
        );
    });

    return (
        <React.Fragment>{ colOfRects }</React.Fragment>
    );
}

/** @todo Implement things like age, stillBirth, isEctopic, etc. */
function AboveNodeText(props){
    const {
        individual, maxHeightIndex, halfWidth, aboveNodeTextY,
        textScale = 1,
        textScaleTransformStr = "scale3d(1,1,1)",
    } = props;
    const {
        //id, name,
        //ageString,
        // diseases = [],
        //orderBasedName,
        _drawing : { heightIndex },
        ancestry = []
    } = individual;

    if (heightIndex !== maxHeightIndex) return null;
    if (ancestry.length === 0) return null;

    const moreAncestryPresent = ancestry.length > 3;
    const showAncestry = moreAncestryPresent ? ancestry.slice(0, 3) : ancestry; // Up to 3 shown.

    const rectTransform = "translate(0, -" + aboveNodeTextY + "), scale(" + textScale + ")";
    const rectTransform3d = "translate3d(0, -" + aboveNodeTextY + "px, 0) " + textScaleTransformStr;

    return (
        <g className="text-box above-node" transform={rectTransform} style={{
            transformOrigin: "" + halfWidth + "px 0px",
            transform: rectTransform3d
        }}>
            <text y={0} x={halfWidth} textAnchor="middle" data-describing="ancestry">
                { showAncestry.join(" • ") }
            </text>
        </g>
    );
}

/** @todo Implement things like age, stillBirth, isEctopic, etc. */
function UnderNodeText(props){
    const {
        individual,
        width = 80,
        height = 80,
        halfWidth = 40,
        diseaseToIndex = {},
        showOrderBasedName = true,
        textScale = 1,
        textScaleTransformStr = "scale3d(1,1,1)",
        dims
    } = props;
    const {
        id, name,
        ageString,
        diseases = [],
        orderBasedName,
    } = individual;
    //const textYStart = 18;
    const showTitle = showOrderBasedName ? orderBasedName : (name || id);

    const textRows = [[ showTitle, "title" ]];
    if (ageString){
        textRows.push([ ageString, "age" ]);
    }

    diseases.filter(function(disease){
        return !diseaseToIndex[disease];
    }).forEach(function(disease, i){
        textRows.push([
            <React.Fragment key={i}>
                &bull; { disease }
            </React.Fragment>,
            "disease"
        ]);
    });

    const renderedTexts = textRows.map(function([ content, desc ], idx){
        const txtProps = {
            "y": 18 + (20 * idx),
            "data-describing" : desc
        };
        if (desc === "title" && showOrderBasedName){
            txtProps.className = (txtProps.className || "") + " showing-order-based-name";
        }
        if (desc === "title" || desc === "age"){
            // Center text
            txtProps.textAnchor = "middle";
            txtProps.x = halfWidth;
        }
        if (desc === "disease"){
            // Left align text, but from midpoint
            // txtProps.x = halfWidth;
        }
        return <text {...txtProps} key={desc + "-" + idx}>{ content }</text>;
    });

    // todo maybe make an array of 'rows' to map to <text>s with incremented y coord.
    const rectTransform = "translate(0, " + (height + 4) + "), scale(" + textScale + ")";
    const rectTransform3d = "translate3d(0, " + (height + 4) + "px, 0) " + textScaleTransformStr;

    return (
        <g className="text-box" style={{ transformOrigin: halfWidth + "px 0", transform: rectTransform3d }} transform={rectTransform}>
            {/* <rect width={width + 4} x={-2} height={dims.individualYSpacing / 3} className="bg-rect" rx={5} /> */}
            { renderedTexts }
        </g>
    );
}
