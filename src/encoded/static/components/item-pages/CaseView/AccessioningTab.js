'use strict';

import React, { useState } from 'react';

import { PartialList } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/PartialList';

import { FamilyAccessionStackedTable } from '../../browse/CaseDetailPane';


export const AccessioningTab = React.memo(function AccessioningTab(props) {
    const { context, canonicalFamily, secondaryFamilies = [] } = props;
    const { display_title: primaryFamilyTitle, '@id': canonicalFamilyAtID } = canonicalFamily;
    const [isSecondaryFamiliesOpen, setSecondaryFamiliesOpen] = useState(false);
    const secondaryFamiliesLen = secondaryFamilies.length;

    const viewSecondaryFamiliesBtn = secondaryFamiliesLen === 0 ? null : (
        <div className="pt-2">
            <button
                type="button"
                className="btn btn-block btn-outline-dark"
                onClick={
                    function () {
                        setSecondaryFamiliesOpen(function (currentIsSecondaryFamiliesOpen) {
                            return !currentIsSecondaryFamiliesOpen;
                        });
                    }}>
                {!isSecondaryFamiliesOpen ? `Show ${secondaryFamiliesLen} more famil${secondaryFamiliesLen > 1 ? 'ies' : 'y'} that proband is member of` : 'Hide secondary families'}
            </button>
        </div>
    );

    // Using PartialList since we have it already, it hides DOM elements when collapsed.
    // In long run maybe a differing UI might be better, idk.
    return (
        <React.Fragment>
            <h1 className="row align-items-center">
                <div className="col">
                    <span className="text-300">Accessioning Report and History</span>
                </div>
                <div className="col-auto">
                    <span className="current-case text-small text-400 m-0">Current Selection</span>
                </div>
            </h1>
            <div className="tab-inner-container card">
                <div className="card-body">
                    <PartialList className="mb-0" open={isSecondaryFamiliesOpen}
                        persistent={[
                            <div key={canonicalFamilyAtID} className="primary-family">
                                <h4 className="mt-0 mb-16 text-400">
                                    <span className="text-300">Primary Cases from </span>
                                    {primaryFamilyTitle}
                                </h4>
                                <FamilyAccessionStackedTable family={canonicalFamily} result={context}
                                    fadeIn collapseLongLists collapseShow={1} />
                            </div>
                        ]}
                        collapsible={!isSecondaryFamiliesOpen ? null :
                            secondaryFamilies.map(function (family) {
                                const { display_title, '@id': familyID } = family;
                                return (
                                    <div className="py-4 secondary-family" key={familyID}>
                                        <h4 className="mt-0 mb-05 text-400">
                                            <span className="text-300">Related Cases from </span>
                                            {display_title}
                                        </h4>
                                        <FamilyAccessionStackedTable result={context} family={family} collapseLongLists />
                                    </div>
                                );
                            })
                        } />
                    {viewSecondaryFamiliesBtn}
                </div>
            </div>
        </React.Fragment>
    );
});