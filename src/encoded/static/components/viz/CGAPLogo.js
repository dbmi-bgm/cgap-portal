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
            showTitle = true
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
                <svg id={id} ref={this.svgRef} style={outerStyle} viewBox="0 0 92 92" width="98">
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
                { showTitle && <CGAPLogoText {...{ hover }} />}
            </div>
        );
    }
}

export const CGAPLogoText = () => {
    return (
        <svg className="navbar-title" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 91.05 25.06" width="80">
            <title>CGAP</title>
            <path d="M16.06,20.55c-1.03,.45-2.29,.68-3.78,.68-1.21,0-2.31-.21-3.31-.63-1-.42-1.86-1.01-2.59-1.79-.73-.78-1.29-1.7-1.69-2.77-.39-1.07-.59-2.24-.59-3.52s.2-2.45,.59-3.52c.39-1.07,.96-1.99,1.69-2.77,.73-.78,1.59-1.37,2.59-1.79,1-.42,2.1-.63,3.31-.63,1.37,0,2.57,.22,3.6,.66,1.03,.44,1.91,1.06,2.63,1.84l2.71-2.71c-1.11-1.11-2.39-2-3.83-2.65-1.44-.65-3.14-.97-5.12-.97-1.76,0-3.39,.33-4.89,.97-1.5,.65-2.8,1.54-3.92,2.68-1.11,1.14-1.97,2.47-2.58,3.98-.6,1.52-.91,3.15-.91,4.89s.3,3.37,.91,4.89c.6,1.52,1.46,2.85,2.58,4,1.11,1.15,2.42,2.04,3.92,2.68,1.5,.64,3.13,.96,4.89,.96,1.95,0,3.68-.33,5.19-.97,1.51-.65,2.82-1.54,3.93-2.68l-2.71-2.71c-.72,.79-1.6,1.41-2.63,1.86Z"/>
            <path d="M34.87,15.17h7.75c-.15,.94-.4,1.79-.79,2.52-.63,1.17-1.53,2.05-2.7,2.65-1.17,.59-2.57,.89-4.19,.89-1.53,0-2.9-.37-4.11-1.11-1.21-.74-2.16-1.77-2.87-3.08-.71-1.31-1.06-2.82-1.06-4.54s.35-3.22,1.04-4.52c.7-1.3,1.68-2.31,2.94-3.05,1.26-.73,2.73-1.1,4.4-1.1,1.39,0,2.69,.27,3.9,.82,1.21,.55,2.17,1.33,2.89,2.35l2.71-2.71c-1.11-1.37-2.49-2.42-4.14-3.17-1.65-.74-3.43-1.11-5.36-1.11-1.76,0-3.41,.32-4.92,.96-1.52,.64-2.84,1.53-3.97,2.68-1.13,1.15-2.01,2.48-2.64,3.98-.64,1.51-.96,3.13-.96,4.87s.32,3.37,.96,4.89c.64,1.52,1.51,2.85,2.63,4,1.11,1.15,2.41,2.05,3.9,2.7,1.48,.65,3.06,.97,4.73,.97,2.3,0,4.34-.48,6.13-1.43,1.79-.95,3.2-2.39,4.23-4.32,1.03-1.93,1.55-4.34,1.55-7.24v-.56h-12.04v3.65Z"/>
            <path d="M57.98,.35l-10.02,24.36h4.25l1.87-4.7h10.47l1.86,4.7h4.32L60.77,.35h-2.78Zm-2.52,16.18l3.87-9.71,3.84,9.71h-7.71Z"/>
            <path d="M89.99,3.93c-.71-1.14-1.67-2.02-2.89-2.65s-2.59-.94-4.12-.94h-9.05V24.71h4V15.52h5.05c1.53,0,2.91-.31,4.12-.94,1.22-.63,2.18-1.51,2.89-2.65,.71-1.14,1.06-2.47,1.06-4s-.35-2.87-1.06-4Zm-3.5,6.18c-.37,.62-.88,1.09-1.51,1.43-.64,.34-1.37,.5-2.21,.5h-4.84V3.83h4.84c.84,0,1.57,.17,2.21,.5,.64,.34,1.14,.81,1.51,1.43,.37,.62,.56,1.34,.56,2.18s-.19,1.56-.56,2.18Z"/>
        </svg>
    );
}
