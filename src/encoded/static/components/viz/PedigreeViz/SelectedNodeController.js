'use strict';

import React from 'react';
import memoize from 'memoize-one';
import { findNodeWithId } from './data-utilities';


function isMobileSize(windowWidth){
    if ((windowWidth || window.innerWidth) < 800){
        return true;
    }
    return false;
}


export class SelectedNodeController extends React.PureComponent {

    static defaultProps = {
        onNodeSelected: function(currSelectedNode){
            console.log('Currently selected node', currSelectedNode);
        },
        onDataChanged: function(objectGraph){
            console.log("DATA CHANGED (default handler)", objectGraph);
        }
    };

    static getDerivedStateFromProps(props, state){
        if (props.disableSelect) {
            if (state.currSelectedNodeId || state.currHoverNodeId) {
                return {
                    'currHoverNodeId' : null,
                    'currSelectedNodeId' :  null
                };
            }
        }
        return null;
    }

    constructor(props){
        super(props);
        this.handleSelectNode = this.handleSelectNode.bind(this);
        this.handleUnselectNode = this.handleUnselectNode.bind(this);
        this.handleNodeMouseIn = this.handleNodeMouseIn.bind(this);
        this.handleNodeMouseLeave = this.handleNodeMouseLeave.bind(this);
        this.state = {
            'currHoverNodeId' : null,
            'currSelectedNodeId' :  null
        };
        this.memoized = {
            findSelectedNode: memoize(findNodeWithId),
            findHoveredNode: memoize(findNodeWithId)
        };
    }

    componentDidUpdate(pastProps){
        const { objectGraph, onDataChanged } = this.props;
        const { objectGraph: pastObjGraph } = pastProps;

        if (objectGraph !== pastObjGraph){
            onDataChanged(objectGraph);
            this.setState(({ currSelectedNodeId })=>{
                const retState = { currHoverNodeId: null };
                const selectedNode = currSelectedNodeId && this.memoized.findSelectedNode(objectGraph, currSelectedNodeId);
                if (!selectedNode){
                    retState.currSelectedNodeId = null;
                }
                return retState;
            });
        }
    }

    handleSelectNode(id){
        const { disableSelect } = this.props;
        if (disableSelect || !id){
            return false;
        }
        // Is triggered after onmouseup, vectors always === 0.
        //console.log(this.mouseMove.vectorX, this.mouseMove.vectorY);
        //if (Math.abs(this.mouseMove.vectorX) > 10 || Math.abs(this.mouseMove.vectorY) > 10){
        //    // Might have started to drag viewport; cancel.
        //    return false;
        //}
        this.setState(function({ currSelectedNodeId }){
            if (currSelectedNodeId === id){
                return null;
            }
            return {
                'currSelectedNodeId' : id,
                'currHoverNodeId' : id
            };
        }, ()=>{
            const { onNodeSelected, objectGraph } = this.props;
            const { currSelectedNodeId } = this.state;
            if (typeof onNodeSelected === 'function'){
                const currSelectedNode = currSelectedNodeId && this.memoized.findSelectedNode(objectGraph, currSelectedNodeId);
                onNodeSelected(currSelectedNode);
            }
        });
    }

    handleUnselectNode(){
        this.setState({ 'currSelectedNodeId' : null }, ()=>{
            const { onNodeSelected, objectGraph } = this.props;
            const { currSelectedNodeId } = this.state;
            if (typeof onNodeSelected === 'function'){
                // Should always eval to null but keep remainder of logic in case state.currSelectedNodeId changes interim.
                const currSelectedNode = currSelectedNodeId && this.memoized.findSelectedNode(objectGraph, currSelectedNodeId);
                onNodeSelected(currSelectedNode);
            }
        });
    }

    handleNodeMouseIn(id){
        const { windowWidth = null } = this.props;
        if (isMobileSize(windowWidth)){
            // Prevent hover interaction handling on mobile sizes for perf/safety.
            return false;
        }
        if (!id) {
            return;
        }
        this.setState({ 'currHoverNodeId' : id });
    }

    handleNodeMouseLeave(){
        //console.log('out', evt.currentTarget, evt.target, evt.relatedTarget);
        this.setState({ 'currHoverNodeId' : null });
    }

    render(){
        const { children, objectGraph, ...passProps } = this.props;
        const { currSelectedNodeId, currHoverNodeId } = this.state;
        const selectedNode = this.memoized.findSelectedNode(objectGraph, currSelectedNodeId);
        const hoveredNode = this.memoized.findHoveredNode(objectGraph, currHoverNodeId);
        const childProps = {
            ...passProps,
            selectedNode,
            hoveredNode,
            onSelectNode: this.handleSelectNode,
            onUnselectNode: this.handleUnselectNode,
            onNodeMouseIn: this.handleNodeMouseIn,
            onNodeMouseLeave: this.handleNodeMouseLeave
        };
        return React.Children.map(children, (child) => React.cloneElement(child, childProps));
    }
}
