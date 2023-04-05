'use strict';

import React, { useState, useMemo, useCallback, useEffect, useContext } from 'react';
import DefaultItemView from './../DefaultItemView';




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
    return ("This is the Somatic Analysis Info Tab View");
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