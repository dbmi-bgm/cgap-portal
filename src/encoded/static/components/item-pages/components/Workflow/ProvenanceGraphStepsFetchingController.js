'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';
import _ from 'underscore';
import { console, object, ajax } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';

/**
 * `onMount`, sends ajax POST request to `trace_workflow_run_steps/{uuid}/?{options}`
 * and holds state for holding response, loading state, state for options, and methods
 * for handling those options.
 *
 * Used in ProcessedFileView, SampleView, and similar ItemViews
 * where need to show a provenance graph.
 *
 * Each ItemType/View that uses this controller should also have
 * a handler for the type on the backend in visualization.py.
 *
 * Can also be used to build a provenance graph view in any other
 * place, e.g. using results from AJAXed ProcessedFile or similar.
 *
 * (Off Topic)
 * In future, maybe we can stop extending DefaultItemView for ItemViews
 * and instead use composition & props for getTabViewContents and such.
 */
export class ProvenanceGraphStepsFetchingController extends React.PureComponent {

    static propTypes = {
        "context": PropTypes.shape({
            "uuid" : PropTypes.string, // We need UUID to send to endpoint, not `@id` as would be used for other requests for resource.
        }),
        "shouldGraphExist": PropTypes.func
    };

    static defaultProps = {
        "shouldGraphExist": function(context){
            console.warn("No `shouldGraphExist` prop is set, will make request even if nothing to trace on item.");
            return true;
        }
    };

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
        const passProps = { ...remainingProps, ...this.state, toggleAllRuns: this.toggleAllRuns };
        return React.Children.map(children, (child) => React.cloneElement(child, passProps));
    }

}

