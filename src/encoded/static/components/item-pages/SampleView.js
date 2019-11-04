'use strict';

import React from 'react';
import moment from 'moment';
import _ from 'underscore';
import memoize from 'memoize-one';
import { console, object, ajax } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { ItemFileAttachment } from './components/ItemFileAttachment';
import { getFile } from './components/Workflow/WorkflowDetailPane';
import { ProvenanceGraphStepsFetchingController } from './components/Workflow/ProvenanceGraphStepsFetchingController';
import { ProvenanceGraphTabView } from './components/Workflow/ProvenanceGraphTabView';
import DefaultItemView from './DefaultItemView';


export default class SampleView extends DefaultItemView {

    constructor(props){
        super(props);
        this.shouldGraphExist = this.shouldGraphExist.bind(this);
    }

    shouldGraphExist(){
        const { context : { processed_files = [] } } = this.props;
        const procFileLen = processed_files.length;
        let file;
        for (var i = 0; i < procFileLen; i++){
            file = processed_files[i];
            if (
                file && object.itemUtil.atId(file) &&
                Array.isArray(file.workflow_run_outputs) && file.workflow_run_outputs.length > 0
            ) {
                return true;
            }
        }
        return false;
    }

    getControllers(){
        return [<ProvenanceGraphStepsFetchingController key={0} shouldGraphExist={this.shouldGraphExist} />];
    }

    getTabViewContents(controllerProps){
        const initTabs = [
            // todo - FileViewOverview.getTabObject(this.props),
            ...this.getCommonTabs()
        ];

        if (this.shouldGraphExist()){
            initTabs.push(ProvenanceGraphTabView.getTabObject({
                ...this.props,
                ...controllerProps,
                isNodeCurrentContext
            }));
        }

        return initTabs;
    }

}


export function isNodeCurrentContext(node, context){
    if (node.nodeType !== 'input' && node.nodeType !== 'output') return false;
    const { processed_files = [] } = context;
    if (processed_files.length === 0) return false;
    const processedFileIds = processed_files.reduce(function(m, pf){
        if (pf['@id']){
            m[pf['@id']] = true;
        }
        return m;
    }, {});
    const file = getFile(node);
    if (file && file['@id'] && processedFileIds[file['@id']]){
        return true;
    }
    return false;
}



