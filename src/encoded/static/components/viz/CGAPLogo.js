'use strict';

import React from 'react';
import _ from 'underscore';
import { selectAll as d3SelectAll } from 'd3-selection';
import { active as d3Active } from 'd3-transition';
import { easeQuadIn, easeQuadOut } from 'd3-ease';


const commonStyle1 = {
    "fill" : "#4579b4",
    "fillOpacity" : 1,
    "stroke": "#20445f", // "#083c52",
    "strokeWidth" : 0.5,
    "strokeLinejoin": "round",
    "strokeLinecap": "butt",
    "strokeMiterlimit": 4,
    "strokeDasharray" : "none",
    "strokeDashoffset" : 0,
    "strokeOpacity": 1,
    "paintOrder" :"fill markers stroke"
};

const commonStyle2 = _.extend({}, commonStyle1, {
    "fill" : "#73a5de", //"#6793c5",
    //"stroke" :"#4a7eba",
    //"stroke" :"#fff",
});

const commonStyle1Hover = _.extend({}, commonStyle1, {
    "fillOpacity": 0.3,
    "strokeWidth": 0.5,
    "fill" : "#73a5de",
    "stroke": "#73a5de" //"#3f6fa5",
    //"strokeOpacity": 0.7,
});

const commonTransform1 = "translate(0, 0)";
const commonTransform1Hover = "translate(-3, -4)";
const commonTransform1Hover2 = "translate(-7, -5)";
const commonTransform2 = "translate(0, 0)";
const commonTransform2Hover = "translate(3, 4)";
const commonTransform2Hover2 = "translate(7, 5)";


const svgElemStyle = {
    'verticalAlign' : "top",// 'middle',
    'display' : 'inline-block',
    'height' : '100%',
    'paddingTop' : 5,
    'paddingBottom' : 5,
    'maxHeight' : 80,
    //'borderRadius' : '50%'
};

const svgElemStyleHover = _.extend({}, svgElemStyle, {
    "paddingTop" : 0,
    "paddingBottom" : 0,
    //'borderRadius' : 0
});


export class CGAPLogo extends React.PureComponent {

    static defaultProps = {
        'id' : "logo_svg",
        'hoverDelayUntilTransform' : 10,
        "maxHeight": 80
    };

    constructor(props){
        super(props);
        this.setHoverStateOnDoTiming = _.throttle(this.setHoverStateOnDoTiming.bind(this), 1000);
        this.setHoverStateOn = this.setHoverStateOn.bind(this);
        this.setHoverStateOff = this.setHoverStateOff.bind(this);
        this.svgRef = React.createRef();
        this.state = { "hover" : false };
    }

    setHoverStateOn(e){
        this.setState({ 'hover': true }, this.setHoverStateOnDoTiming);
    }

    setHoverStateOnDoTiming(e){
        const { hoverDelayUntilTransform, id } = this.props;

        // CSS styles controlled via stylesheets
        setTimeout(()=>{

            const pathsG1 = d3SelectAll(`#${id} g path.path-g-1`);
            const pathsG2 = d3SelectAll(`#${id} g path.path-g-2`);

            if (!this.state.hover) return; // No longer hovering. Cancel.

            pathsG1
                .transition()
                .ease(easeQuadIn)
                .duration(200)
                .attr('transform', commonTransform1Hover)
                .transition()
                .ease(easeQuadOut)
                //.delay(250)
                .on('start', function(){
                    //if (!_this.state.hover) return;
                    // eslint-disable-next-line no-invalid-this
                    d3Active(this) // `this` refers to the paths here.
                        .duration(400)
                        .attr('transform', commonTransform1Hover2);
                });

            pathsG2
                .transition()
                .ease(easeQuadIn)
                .duration(200)
                .attr('transform', commonTransform2Hover)
                .transition()
                .ease(easeQuadOut)
                //.delay(250)
                .on('start', function(){
                    //if (!_this.state.hover) return;
                    // eslint-disable-next-line no-invalid-this
                    d3Active(this) // `this` refers to the paths here.
                        .duration(400)
                        .attr('transform', commonTransform2Hover2);
                });

        }, hoverDelayUntilTransform);

    }

    setHoverStateOff(e){
        const { id } = this.props;
        this.setState({ 'hover' : false }, ()=>{
            const pathsG1 = d3SelectAll(`#${id} g path.path-g-1`);
            const pathsG2 = d3SelectAll(`#${id} g path.path-g-2`);

            pathsG1.interrupt().transition()
                .ease(easeQuadOut)
                .duration(300)
                .attr('transform', commonTransform1);

            pathsG2.interrupt().transition()
                .ease(easeQuadOut)
                .duration(300)
                .attr('transform', commonTransform2);
        });

    }

    render(){
        const {
            id,
            onClick,
            maxHeight,
            className,
            title = <span className="navbar-title">CGAP</span>
        } = this.props;
        const { hover } = this.state;

        const outerStyle = { ...(hover ? svgElemStyleHover : svgElemStyle), maxHeight, width: maxHeight };
        const style1 = hover ? commonStyle1Hover : commonStyle1;
        const style2 = hover ? commonStyle1Hover : commonStyle2;
        // const transform1 = hover ? commonTransform1Hover : commonTransform1;
        // const transform2 = hover ? commonTransform2Hover : commonTransform2;

        const containerCls = "cgap-logo-wrapper img-container" + (hover ? " hover" : "") + (className ? " " + className : "");

        const groupTransformRotate = "rotate(135,41,31.25)";
        const groupTransform = groupTransformRotate; //= hover ? groupTransformRotate + " scale(1.125, 1.125) translate(-12,-8)" : groupTransformRotate;

        return (
            <div className={containerCls} onClick={onClick} onMouseEnter={this.setHoverStateOn} onMouseLeave={this.setHoverStateOff}>
                <svg id={id} ref={this.svgRef} style={outerStyle} viewBox="0 0 92 92">
                    <g transform={groupTransform}>
                        <path d="m 81.314453,24.175781 3.75,7.5 h 10.796875 l -3.71875,-7.5 z" style={style1} className="path-g-1" />
                        <path d="M 61.289062,4.3085938 55.621094,11.865234 84.261719,31.1875 80.705078,24.072266 Z" style={style1} className="path-g-1" />
                        <path d="M 0.66992188,4.5 4.3886719,12 h 9.8261721 l -3.75,-7.5 z" style={style1} className="path-g-2" />
                        <path d="m 11.253906,4.9628906 3.570313,7.1367184 20.412109,19.773438 5.669922,-7.558594 z" style={style1} className="path-g-2" />
                        <path d="M -0.56835938,19.923931 7.1035156,35.173892 H 25.59375 L 17.865234,19.923828 Z" style={style2} className="path-g-1" />
                        <path d="m 35.765625,4.1757812 5.625,7.4999998 h 13.748047 l 5.625,-7.4999998 z" style={style2} className="path-g-1" />
                        <path d="M 35.230469,4.296875 18.328125,19.728516 26.039062,34.94147 40.958984,11.933594 Z" style={style2} className="path-g-1" />
                        <path d="m 41.390625,24.5 -5.625,7.5 h 25 l -5.625,-7.5 z" style={style2} className="path-g-2" />
                        <path d="M 70.488281,1.25 55.570312,24.240234 61.300781,31.878906 78.205078,16.443359 Z" style={style2} className="path-g-2" />
                        <path d="m 70.921875,1 7.746094,15.25 H 97.109375 L 89.423828,1 Z" style={style2} className="path-g-2" />
                    </g>
                </svg>
                { title }
            </div>
        );
    }

}
