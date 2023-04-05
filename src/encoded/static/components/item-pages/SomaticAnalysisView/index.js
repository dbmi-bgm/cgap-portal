'use strict';

import React, { useState, useMemo, useCallback, useEffect, useContext } from 'react';

import DefaultItemView from './../DefaultItemView';
import { DotRouter, DotRouterTab } from '../components/DotRouter';
import { SomaticAccessioningTab } from './SomaticAccessioningTab';
import { SomaticBioinformaticsTab } from './SomaticBioinformaticsTab';


export default class SomaticAnalysisView extends DefaultItemView {

    getTabViewContents(controllerProps = {}) {
        console.log("SomaticAnalysisView getTabViewContents controllerProps", controllerProps);
        const commonTabProps = { ...this.props, ...controllerProps };
        const initTabs = [];

        initTabs.push(SomaticAnalysisInfoTabView.getTabObject(commonTabProps));

        return initTabs.concat(this.getCommonTabs());
    }
}

const SomaticAnalysisInfoTabView = React.memo(function CaseInfoTabView(props) {
    const {
        // Passed in from App or redux
        context,
        href,
        // Passed in from TabView
        isActiveTab
    } = props;

    // TODO: determine when/if ever the accessioning tab should be disabled (fall back to "no information available, etc.")
    const disableBioinfo = false; // TODO: determine when/if ever the bioinfo tab should be disabled

    console.log("SomaticAnalysisInfoTabView props", props);
    return (
        <>
            <DotRouter href={href} isActive={isActiveTab} navClassName="container-wide pt-36 pb-36" contentsClassName="container-wide bg-light pt-36 pb-36" prependDotPath="case-info">
                <DotRouterTab dotPath=".accessioning" default tabTitle="Accessioning">
                    <SomaticAccessioningTab {...{ context, href }} />
                </DotRouterTab>
                <DotRouterTab dotPath=".bioinformatics" disabled={disableBioinfo} tabTitle="Bioinformatics">
                    <SomaticBioinformaticsTab {...{ context, href }} />
                </DotRouterTab>
            </DotRouter>
        </>
    );
});
SomaticAnalysisInfoTabView.getTabObject = function (props) {
    return {
        "tab": (
            <React.Fragment>
                <i className="icon icon-project-diagram fas icon-fw" />
                <span>Analysis Info</span>
            </React.Fragment>
        ),
        "key": "case-info",
        "disabled": false,
        "content": (<SomaticAnalysisInfoTabView {...props} />),
        "cache": true
    };
};