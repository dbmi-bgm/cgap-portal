'use strict';

import React, { useMemo, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import { console, schemaTransforms, object } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';

import { ExternalDatabasesSection, GeneOverview, ConstraintScoresSection } from './AnnotationSections';
import ReactTooltip from 'react-tooltip';


/**
 * I feel like we can maybe re-use this as an overview tab for Gene ItemView eventually.
 * The only difference is instead of currentGeneItem, we'd get data from context. And there'd
 * be no currentGeneItemLoading.
 *
 * What we can do then is rename this component to "GeneOverview" or something and rename `currentGeneItem` to `context`
 * in this component and remove `currentGeneItemLoading` and logic re it. Then compose new component GeneTabBody
 * that simply does the currentGeneItemLoading logic or returns <GeneOverview context={currentGeneItem} />
 */
export function GeneTabBody(props){
    const { currentGeneItemLoading, currentGeneItem, context, schemas } = props;
    const fallbackElem = <em> - </em>;
    const {
        error               = null,
        '@id' : geneAtID    = null
    } = currentGeneItem || {};

    const getTipForField = useMemo(function(){
        if (!schemas) return function(){ return null; };
        // Helper func to basically just shorten `schemaTransforms.getSchemaProperty(field, schemas, itemType);`.
        return function(field, itemType = "Gene"){
            // Func is scoped within GeneTabBody (uses its 'schemas')
            const schemaProperty = schemaTransforms.getSchemaProperty(field, schemas, itemType);
            return (schemaProperty || {}).description || null;
        };
    }, [ schemas ]);

    // When gene item is loaded, trigger a quick update of tooltips
    useEffect(() => {
        ReactTooltip.rebuild();
    }, [currentGeneItem]);

    if (currentGeneItemLoading) {
        return (
            <div className="gene-tab-body card-body py-5 text-center text-large">
                <i className="icon icon-spin fas icon-circle-notch" />
            </div>
        );
    }

    if (error || !geneAtID) {
        // It's possible yet unlikely there might be view permission error or something.
        // Actually yeah.. this shouldnt happen since won't have been able to get ID
        // to load this w anyway.. will remove.
        // Added 'if no gene id' case to loadGene in VariantSampleOverview which would leave
        // Gene tab disabled - might be worth to enable and show this value tho by setting
        // currentGeneItem to { error: "no view permissions" } (instd of leaving as null).
        return (
            <div className="gene-tab-body card-body py-5 text-center">
                <em>{ error || "Gene Item not available." }</em>
            </div>
        );
    }

    return (
        <div className="gene-tab-body card-body">
            <div className="row">
                <div className="col-12 col-xl-6 d-flex flex-column">

                    <div className="inner-card-section flex-grow-1 pb-2 pb-xl-0">
                        <div className="info-header-title">
                            <h4>Overview</h4>
                        </div>
                        <div className="info-body">
                            <GeneOverview {...{ schemas, currentGeneItem, fallbackElem, getTipForField }} />
                        </div>
                    </div>

                    {/* Won't be ready for some time -
                    <div className="flex-grow-0 pb-2 pb-md-0">
                        <div className="info-header-title">
                            <h4>Conditions</h4>
                        </div>
                        <div className="info-body">
                            TODO<br/>
                            TODO TODO<br/>
                            TODO TODO TODO
                        </div>
                    </div>
                    */}


                </div>
                <div className="col-12 col-xl-6 d-flex flex-column">

                    <div className="inner-card-section flex-grow-1 pb-2 pb-xl-1">
                        <div className="info-header-title">
                            <h4>External Databases</h4>
                        </div>
                        <div className="info-body">
                            {/* maybe Gene Resources sub-header here */}
                            <ExternalDatabasesSection {...{ schemas }} currentItem={currentGeneItem} />
                        </div>
                    </div>

                    <div className="inner-card-section flex-grow-0 pb-2 pb-xl-0">
                        <div className="info-header-title">
                            <h4>Constraint Scores</h4>
                        </div>
                        <div className="info-body">
                            <ConstraintScoresSection {...{ schemas, currentGeneItem, getTipForField }} />
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}

