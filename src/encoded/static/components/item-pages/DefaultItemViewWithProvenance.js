'use strict';

import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';
import _ from 'underscore';
import memoize from 'memoize-one';
import Graph, { GraphParser, parseAnalysisSteps } from '@hms-dbmi-bgm/react-workflow-viz';
import { console, object, ajax } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import DefaultItemView from './DefaultItemView';
import { WorkflowNodeElement } from './components/Workflow/WorkflowNodeElement';
import { WorkflowDetailPane } from './components/Workflow/WorkflowDetailPane';
import { WorkflowGraphSectionControls } from './components/Workflow/WorkflowGraphSectionControls';
import { FullHeightCalculator } from './components/FullHeightCalculator';




/**
 * NOT YET TESTED / EXPERIMENTAL
 * @todo refactor DefaultItemView into a functional component which uses hook(s)
 * @todo change all components which extend DefaultItemView into functional components that re-use that hook(s)
 * @todo figure out how to handle `getTabViewContents`.
 */
export function useLoadedProvenanceGraph(itemUUID){
    const [ includeAllRunsInSteps, setIncludeAllRunsInSteps ] = useState(false);
    const [ isLoadingGraphSteps, setIsLoadingGraphSteps ] = useState(false);
    const [ graphSteps, setGraphSteps ] = useState(null);
    const [ loadingStepsError, setLoadingStepsError ] = useState(null);

    // Load graph steps
    useEffect(function(){
        if (!isLoadingGraphSteps && graphSteps === null && loadingStepsError !== null) {
            if (typeof itemUUID !== 'string') {
                throw new Error("Expected context.uuid");
            }

            const callback = (res) => {
                if (Array.isArray(res) && res.length > 0){
                    setGraphSteps(res);
                    setIsLoadingGraphSteps(false);
                } else {
                    setGraphSteps(null);
                    setIsLoadingGraphSteps(false);
                    setLoadingStepsError(res.message || res.error || "No steps in response.");
                }
            };

            const uriOpts = {
                timestamp: moment.utc().unix()
            };

            if (includeAllRunsInSteps){
                uriOpts.all_runs = "True";
            }

            const tracingHref = (
                '/trace_workflow_run_steps/' + itemUUID + '/'
                + '?'
                + Object.keys(uriOpts).map(function(optKey){
                    return encodeURIComponent(optKey) + '=' + encodeURIComponent(uriOpts[optKey]);
                }).join('&')
            );

            if (isLoadingGraphSteps){
                console.error("Already loading graph steps");
                return false;
            }

            setIsLoadingGraphSteps(true);
            setLoadingStepsError(null);
            ajax.load(tracingHref, callback, 'GET', callback);
        }
    });

    function toggleIncludeAllRunsInSteps(){
        if (isLoadingGraphSteps) {
            return null;
        }
        setIncludeAllRunsInSteps(!includeAllRunsInSteps);
    }

    return {
        includeAllRunsInSteps,
        toggleIncludeAllRunsInSteps,
        isLoadingGraphSteps,
        graphSteps,
        loadingStepsError
    };
}



/**
 * DefaultItemView, extended with an onMount request to
 * `trace_workflow_run_steps/{uuid}/?{options}` as well
 * as state for holding response, loading state, state for
 * options, and methods for handling those options.
 *
 * @todo
 * Consider how we want to organize this logic better.
 * Especially given that we want to re-use some of this for ordinary Workflows/WorkflowRuns
 * And that tracing (on backend) might change in future.
 *
 * Possibly should remove DefaultItemView as a base class and make `getTabViewContents` into
 * a prop instead.
 */

export default class DefaultItemViewWithProvenance extends DefaultItemView {

    /** Extend DefaultItemView's init state to load in provenance graph */
    constructor(props){
        super(props);
        this.shouldGraphExist = this.shouldGraphExist.bind(this);
        this.loadGraphSteps = this.loadGraphSteps.bind(this);
        this.toggleAllRuns = _.throttle(this.toggleAllRuns.bind(this), 1000, { trailing: false });
        this.state = {
            ...this.state,
            includeAllRunsInSteps: false,
            isLoadingGraphSteps: false,
            graphSteps: null,
            loadingStepsError: null
        };
    }

    componentDidMount(){
        super.componentDidMount();
        this.loadGraphSteps();
    }

    /** Should be implemented/overriden by classes which extends this */
    shouldGraphExist(){
        return false;
    }

    loadGraphSteps(){
        const { context } = this.props;
        const { uuid } = context;
        if (typeof uuid !== 'string') {
            throw new Error("Expected context.uuid");
        }
        if (!this.shouldGraphExist(context)){
            console.warn("No or not populated workflow_run_outputs field");
            return;
        }

        const { includeAllRunsInSteps, isLoadingGraphSteps } = this.state;
        const callback = (res) => {
            if (Array.isArray(res) && res.length > 0){
                this.setState({
                    'graphSteps' : res,
                    'isLoadingGraphSteps' : false
                });
            } else {
                this.setState({
                    'graphSteps' : null,
                    'isLoadingGraphSteps' : false,
                    'loadingStepsError' : res.message || res.error || "No steps in response."
                });
            }
        };

        const uriOpts = {
            timestamp: moment.utc().unix()
        };

        if (includeAllRunsInSteps){
            uriOpts.all_runs = "True";
        }

        const tracingHref = (
            '/trace_workflow_run_steps/' + uuid + '/'
            + '?'
            + Object.keys(uriOpts).map(function(optKey){
                return encodeURIComponent(optKey) + '=' + encodeURIComponent(uriOpts[optKey]);
            }).join('&')
        );

        if (isLoadingGraphSteps){
            console.error("Already loading graph steps");
            return false;
        }

        this.setState({
            'isLoadingGraphSteps' : true,
            'loadingStepsError' : null
        }, ()=>{
            ajax.load(tracingHref, callback, 'GET', callback);
        });
    }

    toggleAllRuns(){
        let doRequest = false;
        this.setState(function({ includeAllRunsInSteps, isLoadingGraphSteps }){
            if (isLoadingGraphSteps){
                return null;
            }
            doRequest = true;
            return { includeAllRunsInSteps: !includeAllRunsInSteps };
        }, ()=>{
            if (!doRequest) return;
            this.loadGraphSteps();
        });
    }

}


/**
 * Same exact logic as above but without remainder of DefaultItemView stuff.
 * If it were a good practice (& natively supported), would just have had
 * `DefaultItemViewWithProvenance` extend both `ProvenanceGraphStepsController` &
 * `DefaultItemView`.
 *
 * In future, maybe we can stop extending DefaultItemView for ItemViews
 * and instead use composition & props for getTabViewContents and such.
 */

export function ProvenanceGraphStepsController(props){
    const { children, ...remainingProps } = props;
    const { context } = remainingProps;
    const { uuid } = context;
    const provenanceProps = useLoadedProvenanceGraph(uuid);
    const passProps = { ...remainingProps, ...provenanceProps };
    return React.Children.map(children, (child) => React.cloneElement(child, passProps));
}

export class ProvenanceGraphStepsControllerDeprecated extends React.PureComponent {

    constructor(props){
        super(props);
        this.loadGraphSteps = this.loadGraphSteps.bind(this);
        this.toggleAllRuns = _.throttle(this.toggleAllRuns.bind(this), 1000, { trailing: false });
        this.state = {
            includeAllRunsInSteps: false,
            isLoadingGraphSteps: false,
            graphSteps: null,
            loadingStepsError: null
        };
    }

    componentDidMount(){
        this.loadGraphSteps();
    }

    loadGraphSteps(){
        const { context, shouldGraphExist } = this.props;
        const { uuid } = context;
        if (typeof uuid !== 'string') {
            throw new Error("Expected context.uuid");
        }
        if (typeof shouldGraphExist === 'function' && !shouldGraphExist(context)){
            console.warn("No or not populated workflow_run_outputs field");
            return;
        }

        const { includeAllRunsInSteps, isLoadingGraphSteps } = this.state;
        const callback = (res) => {
            if (Array.isArray(res) && res.length > 0){
                this.setState({
                    'graphSteps' : res,
                    'isLoadingGraphSteps' : false
                });
            } else {
                this.setState({
                    'graphSteps' : null,
                    'isLoadingGraphSteps' : false,
                    'loadingStepsError' : res.message || res.error || "No steps in response."
                });
            }
        };

        const uriOpts = {
            timestamp: moment.utc().unix()
        };

        if (includeAllRunsInSteps){
            uriOpts.all_runs = "True";
        }

        const tracingHref = (
            '/trace_workflow_run_steps/' + uuid + '/'
            + '?'
            + Object.keys(uriOpts).map(function(optKey){
                return encodeURIComponent(optKey) + '=' + encodeURIComponent(uriOpts[optKey]);
            }).join('&')
        );

        if (isLoadingGraphSteps){
            console.error("Already loading graph steps");
            return false;
        }

        this.setState({
            'isLoadingGraphSteps' : true,
            'loadingStepsError' : null
        }, ()=>{
            ajax.load(tracingHref, callback, 'GET', callback);
        });
    }

    toggleAllRuns(){
        let doRequest = false;
        this.setState(function({ includeAllRunsInSteps, isLoadingGraphSteps }){
            if (isLoadingGraphSteps){
                return null;
            }
            doRequest = true;
            return { includeAllRunsInSteps: !includeAllRunsInSteps };
        }, ()=>{
            if (!doRequest) return;
            this.loadGraphSteps();
        });
    }

    render(){
        const { children, ...remainingProps } = this.props;
        const passProps = { ...remainingProps, ...this.state };
        return React.Children.map(children, (child) => React.cloneElement(child, passProps));
    }

}



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




export class ProvenanceGraphStateController extends React.PureComponent {

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



export const ProvenanceGraphTabView = React.memo(function ProvenanceGraphTabView(props){
    const {
        heading,
        graphSteps = null,
        height: fullVizSpaceHeight,
        windowWidth,
        toggleAllRuns,
        includeAllRunsInSteps,
        isLoadingGraphSteps,
        rowSpacingType,
        parsingOptionsForControls, parsingOptsForGraph,
        anyGroupNodes,
        renderNodeElement, renderDetailPane, isNodeCurrentContext,
        onParsingOptChange, onRowSpacingTypeSelect
    } = props;

    if (!Array.isArray(graphSteps) || graphSteps.length === 0){
        return (
            <div>
                <div className="container-wide">
                    <h3 className="tab-section-title">
                        { heading }
                    </h3>
                </div>
                <hr className="tab-section-title-horiz-divider mb-5"/>
                <div className="container-wide text-center">
                    { isLoadingGraphSteps?
                        <i className="icon icon-fw icon-circle-notch icon-spin fas text-larger"/>
                        :
                        <h5 className="text-400">
                            No steps available
                        </h5>
                    }
                </div>
            </div>
        );
    }

    const lastStep = graphSteps[graphSteps.length - 1];
    const graphProps = {
        rowSpacingType,
        minimumHeight: fullVizSpaceHeight || 300,
        renderNodeElement, renderDetailPane, isNodeCurrentContext
    };

    return (
        <div>
            <div className="container-wide">
                <h3 className="tab-section-title">
                    { heading }
                    <WorkflowGraphSectionControls
                        {...{ rowSpacingType, toggleAllRuns, isLoadingGraphSteps, windowWidth, onRowSpacingTypeSelect, onParsingOptChange }}
                        parsingOptions={parsingOptionsForControls}
                        includeAllRunsInSteps={anyGroupNodes || includeAllRunsInSteps ? includeAllRunsInSteps : null}
                        rowSpacingTitleMap={ProvenanceGraphStateController.rowSpacingTitleMap} />
                </h3>
            </div>
            <hr className="tab-section-title-horiz-divider"/>
            <GraphParser parsingOptions={parsingOptsForGraph} parentItem={lastStep} steps={graphSteps}>
                <Graph {...graphProps} />
            </GraphParser>
        </div>
    );
});
ProvenanceGraphTabView.defaultProps = {
    'graphSteps' : null,
    'heading' : <span>Provenance</span>
};
ProvenanceGraphTabView.getTabObject = function(props){
    const { windowWidth, windowHeight, isLoadingGraphSteps, graphSteps } = props;
    const stepsExist = Array.isArray(graphSteps) && graphSteps.length > 0;
    let icon;
    if (isLoadingGraphSteps){
        icon = <i className="icon icon-circle-notch icon-spin fas icon-fw"/>;
    } else if (!stepsExist){
        icon = <i className="icon icon-times fas icon-fw"/>;
    } else {
        icon = <i className="icon icon-sitemap icon-rotate-90 fas icon-fw"/>;
    }
    return {
        'tab' : (
            <React.Fragment>
                { icon }
                <span>Provenance</span>
            </React.Fragment>
        ),
        'key' : 'provenance',
        'disabled'  : false,
        'content' : (
            <FullHeightCalculator windowHeight={windowHeight} windowWidth={windowWidth}>
                <ProvenanceGraphStateController {...props}>
                    <ProvenanceGraphTabView />
                </ProvenanceGraphStateController>
            </FullHeightCalculator>
        )
    };
};
