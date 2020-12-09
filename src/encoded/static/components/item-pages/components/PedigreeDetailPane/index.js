'use strict';

import React from 'react';
import memoize from 'memoize-one';
import ReactTooltip from 'react-tooltip';
import { IndividualBody, getIndividualDisplayTitle } from './IndividualBody';


export class PedigreeDetailPane extends React.PureComponent {

    componentDidUpdate(pastProps){
        const { selectedNode } = this.props;
        if (pastProps.selectedNode !== selectedNode) {
            ReactTooltip.rebuild();
        }
    }

    render(){
        const { PedigreeVizLibrary, hoveredNode, unselectNode: onClose, indvSchema, docSchema, imageSchema, ...passProps } = this.props;
        const { isRelationshipNode = null } = PedigreeVizLibrary || {};
        const { selectedNode } = passProps;
        const isHovered = hoveredNode === selectedNode;

        if (!selectedNode || !isRelationshipNode){
            // This PedigreeDetailPane shouldn't be visible in first place if no `PedigreeVizLibrary`/`isRelationshipNode`, but 'if check' on it here for safety.
            return null;
        } else if (isRelationshipNode(selectedNode)){
            return <RelationshipBody {...passProps} {...{ onClose, isHovered }} />;
        } else {
            return <IndividualBody {...passProps} {...{ onClose, isHovered, indvSchema, docSchema, imageSchema }} />;
        }
    }
}



function PartnersLinks(props){
    const { partners, type = "div", onNodeClick, className = "partners-links", ...passProps } = props;
    const onLinkClick = (evt) => {
        evt.preventDefault();
        const targetNodeId = evt.target.getAttribute('data-for-id');
        if (!targetNodeId){
            console.warn("No target node id available");
            return false;
        }
        onNodeClick(targetNodeId);
    };
    const partnerLinks = partners.map((p) =>
        <span key={p.id} className="partner-link">
            <a href="#" data-for-id={p.id} onClick={onLinkClick}>
                { getIndividualDisplayTitle(p) }
            </a>
        </span>
    );
    return React.createElement(
        type,
        { 'data-partner-count' : partners.length, className, ...passProps },
        partnerLinks
    );
}


class RelationshipBody extends React.PureComponent {

    constructor(props){
        super(props);
        this.onNodeClick= this.onNodeClick.bind(this);
    }

    onNodeClick(evt){
        evt.preventDefault();
        const { onNodeClick } = this.props;
        const targetNodeId = evt.target.getAttribute('data-for-id');
        if (!targetNodeId){
            console.warn("No target node id available");
            return false;
        }
        onNodeClick(targetNodeId);
    }

    render(){
        const { selectedNode: relationship, onNodeClick } = this.props;
        const { id, partners, children } = relationship;
        return (
            <div className="detail-pane-inner">
                <div className="title-box">
                    <label>Relationship between</label>
                    <PartnersLinks {...{ partners, onNodeClick }} type="h3"/>
                </div>
                <div className="details">
                    <div className="detail-row" data-describing="children">
                        <label>Children</label>
                        { !children.length ? <div><em>None</em></div>
                            : <PartnersLinks onNodeClick={onNodeClick} partners={children}/>
                        }
                    </div>
                </div>
            </div>
        );
    }
}

