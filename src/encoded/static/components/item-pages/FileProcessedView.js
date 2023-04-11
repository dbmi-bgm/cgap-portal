'use strict';

import React from 'react';
import _ from 'underscore';
import memoize from 'memoize-one';
import {
    console,
    object,
    ajax,
} from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { ItemFileAttachment } from './components/ItemFileAttachment';
import DefaultItemView from './DefaultItemView';
import { ProvenanceGraphStepsFetchingController } from './components/Workflow/ProvenanceGraphStepsFetchingController';
import { ProvenanceGraphTabView } from './components/Workflow/ProvenanceGraphTabView';

export default class FileProcessedView extends DefaultItemView {
    constructor(props) {
        super(props);
        this.shouldGraphExist = this.shouldGraphExist.bind(this);
    }

    shouldGraphExist() {
        const {
            context: { workflow_run_outputs = [] },
        } = this.props;
        return (
            workflow_run_outputs.length > 0
            // We can uncomment below line once do permissions checking on backend for graphing
            //&& _.any(context.workflow_run_outputs, object.itemUtil.atId)
        );
    }

    getControllers() {
        return [
            <ProvenanceGraphStepsFetchingController
                key={0}
                shouldGraphExist={this.shouldGraphExist}
            />,
        ];
    }

    getTabViewContents(controllerProps) {
        const initTabs = [
            // todo - FileViewOverview.getTabObject(this.props),
            ...this.getCommonTabs(),
        ];

        if (this.shouldGraphExist()) {
            initTabs.push(
                ProvenanceGraphTabView.getTabObject({
                    ...this.props,
                    ...controllerProps,
                    isNodeCurrentContext,
                })
            );
        }

        return initTabs;
    }
}

export function isNodeCurrentContext(node, context) {
    if (node.nodeType !== 'input' && node.nodeType !== 'output') return false;
    return (
        (context &&
            typeof context.accession === 'string' &&
            node.meta.run_data &&
            node.meta.run_data.file &&
            typeof node.meta.run_data.file !== 'string' &&
            !Array.isArray(node.meta.run_data.file) &&
            typeof node.meta.run_data.file.accession === 'string' &&
            node.meta.run_data.file.accession === context.accession) ||
        false
    );
}
