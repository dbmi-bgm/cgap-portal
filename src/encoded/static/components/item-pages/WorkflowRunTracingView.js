import React from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import { Checkbox, Button } from 'react-bootstrap';
import * as globals from './../globals';
import { console, object, expFxn, ajax, Schemas } from './../util';
import { WorkflowNodeElement } from './components';
import { ItemBaseView } from './DefaultItemView';
import Graph, { parseAnalysisSteps, parseBasicIOAnalysisSteps } from './../viz/Workflow';
import { requestAnimationFrame } from './../viz/utilities';
import { commonGraphPropsFromProps, RowSpacingTypeDropdown } from './WorkflowView';
import { mapEmbeddedFilesToStepRunDataIDs, allFilesForWorkflowRunMappedByUUID } from './WorkflowRunView';
import ReactTooltip from 'react-tooltip';

// Testing / Dummy data
//import * as dummyFile from './../testdata/file-processed-4DNFIYIPFFUA-with-graph';
//import { dummy_analysis_steps } from './../testdata/steps-for-e28632be-f968-4a2d-a28e-490b5493bdc2';
//import { MORE_PARTIALLY_RELEASED_PROCESSED_FILES } from './../testdata/traced_workflow_runs/replicate-4DNESLLTENG9';


export function allFilesForWorkflowRunsMappedByUUID(items){
    return _.reduce(items, function(m, workflowRun){
        return _.extend(m, allFilesForWorkflowRunMappedByUUID(workflowRun));
    }, {});
}


export function filterOutIndirectFilesFromGraphData(graphData){
    var deleted = {  };
    var nodes = _.filter(graphData.nodes, function(n, i){
        if (n.type === 'input' || n.type === 'output'){
            if (n && n.meta && n.meta.in_path === true){
                return true;
            }
            deleted[n.id] = true;
            return false;
        }
        return true;
    });
    var edges = _.filter(graphData.edges, function(e,i){
        if (deleted[e.source.id] === true || deleted[e.target.id] === true) {
            return false;
        }
        return true;
    });
    return { nodes, edges };
}


/**
 * For when "Show Parameters" UI setting === false.
 * 
 * @param {Object}      graphData 
 * @param {Object[]}    graphData.nodes
 * @param {Object[]}    graphData.edges
 * @returns {Object}    Copy of graphData with 'parameters' nodes and edges filtered out.
 */
export function filterOutParametersFromGraphData(graphData){
    var deleted = {  };
    var nodes = _.filter(graphData.nodes, function(n, i){
        if (n.type === 'input' && n.format === 'Workflow Parameter') {
            deleted[n.id] = true;
            return false;
        }
        return true;
    });
    var edges = _.filter(graphData.edges, function(e,i){
        if (deleted[e.source.id] === true || deleted[e.target.id] === true) {
            return false;
        }
        return true;
    });
    return { nodes, edges };
}


export function filterOutReferenceFilesFromGraphData(graphData){
    var deleted = {  };
    var nodes = _.filter(graphData.nodes, function(n, i){

        if (n && n.meta && n.meta.run_data && n.meta.run_data.file && Array.isArray(n.meta.run_data.file['@type'])){

            if (n.meta.run_data.file['@type'].indexOf('FileReference') > -1) {
                deleted[n.id] = true;
                return false;
            }

        }

        return true;
    });
    var edges = _.filter(graphData.edges, function(e,i){
        if (deleted[e.source.id] === true || deleted[e.target.id] === true) {
            return false;
        }
        return true;
    });
    return { nodes, edges };
}


export class WorkflowRunTracingView extends ItemBaseView {
    
    constructor(props){
        super(props);
        this.componentDidMount = this.componentDidMount.bind(this);
        this.handleToggleAllRuns = this.handleToggleAllRuns.bind(this);
        //var steps = MORE_PARTIALLY_RELEASED_PROCESSED_FILES;
        var steps = null;
        this.state = {
            'mounted' : false,
            'steps' : steps,
            'allRuns' : false,
            'loading' : false
        };
    }

    componentDidMount(){
        var state = { 'mounted' : true };
        if (!this.state.steps){
            state.loading = true;
            this.loadGraphSteps();
        }
        this.setState(state);
    }

    loadGraphSteps(force = false, cb = null){
        var context = this.props.context;
        if (typeof context.uuid !== 'string') return;
        if (!force && Array.isArray(this.state.steps) && this.state.steps.length > 0) return;
        if (
            !force && (
                Array.isArray(context['@type']) && _.contains(context['@type'], 'ExperimentSet') // If ExpSet or Exp, don't do if no processed files
                && (!Array.isArray(context.processed_files) || context.processed_files.length === 0)
            ) || (
                Array.isArray(context['@type']) && _.contains(context['@type'], 'File') // If File, don't do if not output of a workflow_run.
                && (!(Array.isArray(context.workflow_run_outputs) && context.workflow_run_outputs.length > 0))
            )
        ) return;

        var callback = function(r){
            requestAnimationFrame(()=>{
                if (Array.isArray(r) && r.length > 0){
                    this.setState({ 'steps' : r, 'loading' : false }, cb);
                } else {
                    this.setState({ 'steps' : 'ERROR', 'loading' : false }, cb);
                }
            });
        }.bind(this);

        var tracingHref = '/trace_workflow_run_steps/' + this.props.context.uuid + '/';
        if (this.state.allRuns === true){
            tracingHref += '?all_runs=True';
        }

        ajax.load(tracingHref, callback, 'GET', callback);
    }

    handleToggleAllRuns(){
        this.setState({ 'allRuns' : !this.state.allRuns, 'loading' : true }, ()=>{
            this.loadGraphSteps(true);
        });
    }

}

export class TracedGraphSectionControls extends React.Component {
    render(){
        var { 
            showReferenceFiles, onToggleReferenceFiles, showIndirectFiles, onToggleIndirectFiles, showParameters, onToggleParameters,
            allRuns, onToggleAllRuns, loading, isAllRunsCheckboxDisabled, rowSpacingType, onSetRowSpacingType, fullscreenViewEnabled, onToggleFullScreenView
        } = this.props;
        return (
            <div className="workflow-view-controls-container">
                
                { typeof showReferenceFiles === 'boolean' && typeof onToggleReferenceFiles === 'function' ?
                <div className="inline-block show-params-checkbox-container">
                    <Checkbox checked={showReferenceFiles} onChange={onToggleReferenceFiles}>
                        Show Reference Files
                    </Checkbox>
                </div>
                : null }

                { typeof showIndirectFiles === 'boolean' && typeof onToggleIndirectFiles === 'function' ?
                <div className="inline-block show-params-checkbox-container">
                    <Checkbox checked={showIndirectFiles} onChange={onToggleIndirectFiles}>
                        Show More Context
                    </Checkbox>
                </div>
                : null }

                { typeof showParameters === 'boolean' && typeof onToggleParameters === 'function' ? // Currently not used.
                <div className="inline-block show-params-checkbox-container">
                    <Checkbox checked={showParameters} onChange={onToggleParameters}>
                        Show Parameters
                    </Checkbox>
                </div>
                : null }
                
                { typeof allRuns === 'boolean' ? 
                <div className="inline-block show-params-checkbox-container">
                    <Checkbox checked={!allRuns && !isAllRunsCheckboxDisabled} onChange={onToggleAllRuns} disabled={isAllRunsCheckboxDisabled}>
                    { loading ? <i className="icon icon-spin icon-fw icon-circle-o-notch" style={{ marginRight : 3 }}/> : '' } Collapse Similar Runs
                    </Checkbox>
                </div>
                : null }

                { typeof rowSpacingType === 'string' && typeof onSetRowSpacingType === 'function' ?
                <div className="inline-block">
                    <RowSpacingTypeDropdown currentKey={rowSpacingType} onSelect={onSetRowSpacingType}/>
                </div>
                : null }
                {' '}
                { typeof fullscreenViewEnabled === 'boolean' && typeof onToggleFullScreenView === 'function' ?
                <div className="inline-block">
                    <Button onClick={onToggleFullScreenView} data-tip={!fullscreenViewEnabled ? 'Expand to full screen' : null}>
                        <i className={"icon icon-fw icon-" + (!fullscreenViewEnabled ? 'arrows-alt' : 'crop')}/>
                    </Button>
                </div>
                : null }

            </div>
        );
    }
}

export class FileViewGraphSection extends React.Component {
    
    static getTabObject(props, state, onToggleAllRuns){
        var { loading, steps, mounted, allRuns } = state;
        var { context } = props;

        var iconClass = "icon icon-fw icon-";
        var tooltip = null;
        if (steps === null || loading){
            iconClass += 'circle-o-notch icon-spin';
            tooltip = "Graph is loading";
        } else if (!Array.isArray(steps) || steps.length === 0) {
            iconClass += 'times';
            tooltip = "Graph currently not available for this file. Please check back later.";
        } else {
            iconClass += 'code-fork';
        }
        return {
            tab : <span data-tip={tooltip} className="inline-block"><i className={iconClass} /> Graph</span>,
            key : 'graph',
            disabled : !Array.isArray(steps) || steps.length === 0,
            content : <FileViewGraphSection
                {...props}
                steps={steps}
                mounted={mounted}
                key={"graph-for-" + context.uuid}
                onToggleAllRuns={onToggleAllRuns}
                allRuns={allRuns}
                loading={loading}
            />
        };
    }

    static isNodeDisabled(node){
        if (node.type === 'step') return false;
        if (node && node.meta && node.meta.run_data){
            return false;
        }
        return true;
    }

    static isNodeCurrentContext(node, context){
        return (
            context && typeof context.accession === 'string' && node.meta.run_data && node.meta.run_data.file
            && typeof node.meta.run_data.file !== 'string' && !Array.isArray(node.meta.run_data.file)
            && typeof node.meta.run_data.file.accession === 'string'
            && node.meta.run_data.file.accession === context.accession
        ) || false;
    }

    constructor(props){
        super(props);
        //this.componentWillReceiveProps = this.componentWillReceiveProps.bind(this);
        this.commonGraphProps = this.commonGraphProps.bind(this);
        this.onToggleIndirectFiles = this.onToggleIndirectFiles.bind(this);
        this.onToggleReferenceFiles = this.onToggleReferenceFiles.bind(this);
        this.onToggleAllRuns = _.throttle(this.onToggleAllRuns.bind(this), 1000);
        this.onSetRowSpacingType = this.onSetRowSpacingType.bind(this);
        this.onToggleFullScreenView = this.onToggleFullScreenView.bind(this);
        this.render = this.render.bind(this);
        this.state = {
            'showChart' : 'detail',
            'showIndirectFiles' : false,
            'showReferenceFiles' : false,
            'rowSpacingType' : 'stacked',
            'fullscreenViewEnabled' : false
        };
    }
    /*
    componentWillReceiveProps(nextProps){
        if (nextProps.allRuns !== this.props.allRuns){
            if (nextProps.allRuns && this.state.rowSpacingType !== 'stacked') {
                this.setState({ 'rowSpacingType' : 'stacked' });
            }
            else if (!nextProps.allRuns && this.state.rowSpacingType !== 'wide') {
                this.setState({ 'rowSpacingType' : 'wide' });
            }
        }
    }
    */
    commonGraphProps(){

        var steps = this.props.steps;
        
        var graphData = parseAnalysisSteps(this.props.steps);
        if (!this.state.showParameters){
            graphData = filterOutParametersFromGraphData(graphData);
        }

        this.anyGroupNodesExist = !this.props.allRuns && _.any(graphData.nodes, function(n){ return n.type === 'input-group' || n.type === 'output-group'; });

        //var graphData = this.parseAnalysisSteps(); // Object with 'nodes' and 'edges' props.
        if (!this.state.showIndirectFiles){
            graphData = filterOutIndirectFilesFromGraphData(graphData);
        }
        if (!this.state.showReferenceFiles){
            graphData = filterOutReferenceFilesFromGraphData(graphData);
        }
        var fileMap = allFilesForWorkflowRunsMappedByUUID(
            (this.props.context.workflow_run_outputs || []).concat(this.props.context.workflow_run_inputs || [])
        );
        var nodes = mapEmbeddedFilesToStepRunDataIDs( graphData.nodes, fileMap );
        return _.extend(commonGraphPropsFromProps(this.props), {
            'isNodeDisabled' : FileViewGraphSection.isNodeDisabled,
            'nodes' : nodes,
            'edges' : graphData.edges,
            'columnSpacing' : 100, //graphData.edges.length > 40 ? (graphData.edges.length > 80 ? 270 : 180) : 90,
            'rowSpacingType' : this.state.rowSpacingType,
            'nodeElement' : <WorkflowNodeElement />,
            'isNodeCurrentContext' : (typeof this.props.isNodeCurrentContext === 'function' && this.props.isNodeCurrentContext) || (node => FileViewGraphSection.isNodeCurrentContext(node, this.props.context))

        });
    }

    onToggleIndirectFiles(){
        this.setState({ 'showIndirectFiles' : !this.state.showIndirectFiles });
    }

    onToggleReferenceFiles(){
        this.setState({ 'showReferenceFiles' : !this.state.showReferenceFiles });
    }

    onToggleAllRuns(){
        return this.props.onToggleAllRuns();
    }

    onSetRowSpacingType(eventKey, evt){
        requestAnimationFrame(()=>{
            if (eventKey === this.state.rowSpacingType) return;
            this.setState({ 'rowSpacingType' : eventKey });
        });
    }

    onToggleFullScreenView(){
        requestAnimationFrame(()=>{
            var willBeFullscreen = !this.state.fullscreenViewEnabled;
            var bodyElement = (window && document && document.body) || null;

            if (bodyElement){
                if (willBeFullscreen){
                    bodyElement.className += ' is-full-screen';
                    //bodyElement.style.overflow = 'hidden';
                } else {
                    //bodyElement.style.overflow = '';
                    bodyElement.className = bodyElement.className.replace(' is-full-screen', '');
                }
            }

            this.setState({ 'fullscreenViewEnabled' : willBeFullscreen }, ()=>{
                ReactTooltip.rebuild();
            });
        });
    }

    render(){
        var graphProps = null;
        if (Array.isArray(this.props.steps)){
            graphProps = this.commonGraphProps();
        }
        var isAllRunsCheckboxDisabled = this.props.loading || (!this.props.allRuns && !this.anyGroupNodesExist ? true : false);

        return (
            <div ref="container" className={"workflow-view-container workflow-viewing-" + (this.state.showChart) + (this.state.fullscreenViewEnabled ? ' full-screen-view' : '')}>
                <h3 className="tab-section-title">
                    <span>Graph</span>
                    <TracedGraphSectionControls
                        {...this.state}
                        {..._.pick(this.props, 'allRuns', 'toggleAllRuns', 'loading')}
                        onToggleReferenceFiles={this.onToggleReferenceFiles} onToggleIndirectFiles={this.onToggleIndirectFiles} onSetRowSpacingType={this.onSetRowSpacingType}
                        onToggleFullScreenView={this.onToggleFullScreenView}
                        isAllRunsCheckboxDisabled={isAllRunsCheckboxDisabled}
                    />
                </h3>
                <hr className="tab-section-title-horiz-divider"/>
                <div className="graph-wrapper" style={{ opacity : this.props.loading ? 0.33 : 1 }}>
                    { graphProps ? <Graph { ...graphProps } /> : null }
                </div>
            </div>
        );

    }

}