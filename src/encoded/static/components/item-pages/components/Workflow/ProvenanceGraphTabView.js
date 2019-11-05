'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import memoize from 'memoize-one';
import Graph, { GraphParser } from '@hms-dbmi-bgm/react-workflow-viz';
import { console } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { WorkflowGraphSectionControls } from './WorkflowGraphSectionControls';
import { FullHeightCalculator } from './../FullHeightCalculator';
import { ProvenanceGraphOptionsStateController } from './ProvenanceGraphOptionsStateController';

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
                        rowSpacingTitleMap={ProvenanceGraphOptionsStateController.rowSpacingTitleMap} />
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
                <ProvenanceGraphOptionsStateController {...props}>
                    <ProvenanceGraphTabView />
                </ProvenanceGraphOptionsStateController>
            </FullHeightCalculator>
        )
    };
};
