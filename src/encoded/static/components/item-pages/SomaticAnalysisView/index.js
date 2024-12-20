'use strict';

import React, { useState, useMemo, useCallback, useEffect, useContext } from 'react';
import { Accordion } from 'react-bootstrap';
import _ from 'underscore';

import { object } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';

import { usePrevious } from '../../util/hooks';
import { DotRouter, DotRouterTab } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/DotRouter';
import DefaultItemView from './../DefaultItemView';
import { SomaticAccessioningTab } from './SomaticAccessioningTab';
import { SomaticBioinformaticsTab } from './SomaticBioinformaticsTab';
import { CaseInfoToggle } from '../CaseView';
import { SomaticAnalysisStats } from './SomaticAnalysisStats';


/**
 * Might be able to create a more generic view for cases/somatic analyses items, but need the UX for this to be
 * solidified before we can figure out
 */
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
        context = {},
        href,
        schemas,
        // Passed in from TabView
        isActiveTab
    } = props;

    const {
        accession,
        display_title,
        external_identifier,
        description,
        actions: somaticAnalysisActions = []
    } = context;

    /**
     * Used to inform whether to show edit icons in places.
     * Used as fallback when difficult/inperformant to determine if have edit
     * permission for attached items such as Individual.
     * @type {boolean}
     */
    const haveSAEditPermission = useMemo(function () {
        return !!(_.findWhere(somaticAnalysisActions, { "name": "edit" }));
    }, [context]);

    // TODO: determine when/if ever the accessioning tab should be disabled (fall back to "no information available, etc.")
    const disableBioinfo = false; // TODO: determine when/if ever the bioinfo tab should be disabled

    console.log("SomaticAnalysisInfoTabView props", props);

    const [loadingAccordion, setLoadingAccordion] = useState(true);
    const [accordion, setAccordion] = useState(null);

    let defaultAccordionState = "0";

    const prevHref = usePrevious(href);

    useEffect(() => {
        // Want to make sure to skip that very first render where href is undefined, but before the dot path appears
        // (see note by dependency aray for info on when there isn't a dot path...)
        // Second render after that should have the "real href" with dotpath present (OR schemas should have loaded instead)
        if (loadingAccordion && (prevHref || schemas)) {

            // Only show case information by default when loading into accessioning (explicitly or no dot path provided)
            const dotPath = DotRouter.getDotPath(href);
            defaultAccordionState = (dotPath === ".accessioning" || !dotPath) ? "0" : null; // "0" is open, null is close

            // Need the defaultActiveKey to be correct on first render, so defining it here, and THEN rendering
            setAccordion(
                <Accordion
                    defaultActiveKey={defaultAccordionState}
                    className="w-100"
                >
                    {!isActiveTab ?
                        null :
                        <CaseInfoToggle eventKey="0">
                            <>
                                <div className="pt-12 pb-06">
                                    <span>
                                        <strong>{external_identifier || display_title}</strong> - {description}
                                    </span>
                                    <div className="d-flex text-smaller text-muted text-400 mt-02">
                                        <object.CopyWrapper className="font-monospace me-1" value={accession} stopPropagation>
                                            {accession}
                                        </object.CopyWrapper>
                                        <div>
                                            What is somatic analysis?
                                            <i className="icon-info-circle icon fas ms-05"
                                                data-tip="Identifies somatic mutations present in a sample and absent in reference normal tissue from the same individual. ">
                                            </i>
                                        </div>
                                    </div>
                                </div>
                            </>
                        </CaseInfoToggle>}
                    <Accordion.Collapse eventKey="0">
                        <>
                            <div className="container-wide bg-light pt-36 pb-36">
                                <div className="card-group case-summary-card-row">
                                    {!isActiveTab ? null : (
                                        <div className="col-stats mb-2 mb-lg-0">
                                            <SomaticAnalysisStats {...context} {...{ haveSAEditPermission }}/>
                                        </div>
                                    )}
                                    {/* <div id="case-overview-ped-link" className="col-pedigree-viz">
                                        <div className="card d-flex flex-column">
                                            <div className="pedigree-vis-heading card-header primary-header d-flex justify-content-between">
                                                <div>
                                                    <i className="icon icon-spinner fas icon-fw me-1" />
                                                    <h4 className="text-white text-400 d-inline-block mt-0 mb-0 ms-05 me-05">
                                                        Somatic Analysis Browser
                                                    </h4>
                                                </div>
                                                <button type="button" className="btn btn-primary btn-sm view-pedigree-btn">
                                                    View
                                                </button>
                                            </div>
                                            {/* / / TODO: Browser preview will go here
                                        </div>
                                    </div> */}
                                </div>
                            </div>
                        </>
                    </Accordion.Collapse>
                </Accordion>
            );

            // Once a default state has been decided, load the accordion
            setLoadingAccordion(false);
        }
    },
    // Use of schemas here is kiiinda hacky. When there is no dotpath, we need a way to know that there will not be a second update of href (which there isn't if server href matches href from window).
    // In app.js that second update of href happens in componentDidMount() when window is loaded. loadSchemas() is triggered right AFTER that, so schemas will always appear after that final href update.
    // We're using that here to ensure that SOMETHING will be rendered for the accordion in the case there is no second update of href. If there's a better way to do this: fix it.
    [
        href,
        schemas
    ]);

    return (
        <>
            {loadingAccordion &&
                <div className="container-wide d-flex justify-content-center" style={{ minHeight: "78px" }}>
                    <div className="pt-3">
                        <i className="icon-spin icon-circle-notch fas" />
                    </div>
                </div>}
            {!loadingAccordion && accordion}
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