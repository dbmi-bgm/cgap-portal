'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';
import _ from 'underscore';
import memoize from 'memoize-one';
import { parseAnalysisSteps } from '@hms-dbmi-bgm/react-workflow-viz';
import { console } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { WorkflowNodeElement } from './WorkflowNodeElement';
import { WorkflowDetailPane } from './WorkflowDetailPane';


export function getNodesInfo(steps){
    const { nodes } = parseAnalysisSteps(steps, { 'showReferenceFiles' : true, 'showIndirectFiles' : true });
    const anyReferenceFileNodes = _.any(nodes, function(n){
        return (n.nodeType === 'output' && n.meta && n.meta.in_path === false);
    });
    const anyIndirectFileNodes = _.any(nodes, function(n){
        return (n.ioType === 'reference file');
    });
    const anyGroupNodes = _.any(nodes, function(n){
        return n.nodeType === 'input-group' || n.nodeType === 'output-group';
    });
    return { anyReferenceFileNodes, anyIndirectFileNodes, anyGroupNodes };
}

/** Holds options for displaying provenance graph(s) */
export class ProvenanceGraphOptionsStateController extends React.PureComponent {

    static rowSpacingTitleMap = {
        // todo - rename internal stuff in workflow lib
        "compact" : "Centered",
        "stacked" : "Stacked",
        "wide" : "Spread"
    };

    static defaultProps = {
        'isNodeCurrentContext' : function(node, context){ return false; },
        'graphSteps' : null,
    };

    static propTypes = {
        height : PropTypes.number,
        windowWidth: PropTypes.number,
        toggleAllRuns: PropTypes.func.isRequired,
        includeAllRunsInSteps: PropTypes.bool,
        isLoadingGraphSteps: PropTypes.bool,
        isNodeCurrentContext: PropTypes.func.isRequired,
        graphSteps: PropTypes.array,
        children: PropTypes.node.isRequired
    };

    constructor(props){
        super(props);
        this.handleParsingOptChange = this.handleParsingOptChange.bind(this);
        this.handleRowSpacingTypeSelect = this.handleRowSpacingTypeSelect.bind(this);
        this.renderNodeElement = this.renderNodeElement.bind(this);
        this.renderDetailPane = this.renderDetailPane.bind(this);
        this.isNodeCurrentContext = this.isNodeCurrentContext.bind(this);

        this.memoized = {
            getNodesInfo: memoize(getNodesInfo)
        };

        this.state = {
            parsingOptions: {
                showReferenceFiles: true,
                showParameters: false,
                showIndirectFiles: false,
                parseBasicIO: false
            },
            rowSpacingType: "stacked"
        };
    }

    handleParsingOptChange(evt){
        const key = evt.target.getAttribute("name");
        console.log('evt', evt, key);
        if (!key) return false;
        this.setState(function({ parsingOptions : prevOpts }){
            const nextOpts = { ...prevOpts, [key] : !prevOpts[key] };
            return { parsingOptions : nextOpts  };
        });
    }

    handleRowSpacingTypeSelect(nextValue, evt){
        if (!nextValue) return false;
        this.setState({ rowSpacingType: nextValue });
    }

    renderNodeElement(node, graphProps){
        const { windowWidth, schemas } = this.props;
        return <WorkflowNodeElement {...graphProps} schemas={schemas} windowWidth={windowWidth} node={node}/>;
    }

    renderDetailPane(node, graphProps){
        const { context, schemas } = this.props;
        return <WorkflowDetailPane {...graphProps} {...{ context, node, schemas }} />;
    }

    /** Classes which extend this should override this. */
    isNodeCurrentContext(node){
        const { context, isNodeCurrentContext } = this.props;
        if (typeof isNodeCurrentContext !== 'function'){
            console.error("No function to determine if is current context.");
        }
        return isNodeCurrentContext(node, context);
    }


    render(){
        const { children, graphSteps, ...otherProps } = this.props;
        const { parsingOptions: origParseOpts } = this.state;
        const { anyReferenceFileNodes, anyIndirectFileNodes, anyGroupNodes } = this.memoized.getNodesInfo(graphSteps);
        const parsingOptionsForControls = { ...origParseOpts };
        const parsingOptsForGraph = { ...origParseOpts };
        if (!anyReferenceFileNodes){
            parsingOptionsForControls.showReferenceFiles = null;
            parsingOptsForGraph.showReferenceFiles = false;
            //delete parsingOptions.showReferenceFiles;
        }
        if (!anyIndirectFileNodes){
            parsingOptionsForControls.showIndirectFiles = null;
            parsingOptsForGraph.showIndirectFiles = false;
        }
        const passProps = {
            ...otherProps,
            ...this.state,
            graphSteps,
            anyReferenceFileNodes,
            anyIndirectFileNodes,
            anyGroupNodes,
            parsingOptionsForControls,
            parsingOptsForGraph,
            onParsingOptChange:     this.handleParsingOptChange,
            onRowSpacingTypeSelect: this.handleRowSpacingTypeSelect,
            renderNodeElement:      this.renderNodeElement,
            renderDetailPane:       this.renderDetailPane,
            isNodeCurrentContext:   this.isNodeCurrentContext
        };
        return React.Children.map(children, (child) => React.cloneElement(child, passProps));
    }

}
