'use strict';

import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';

import { object, schemaTransforms } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { responsiveGridState } from './../../util/layout';

import { ExternalDatabasesSection, GeneOverview, ConstraintScoresSection } from '../VariantSampleView/AnnotationSections';

/** Reuse this method for SNVs if it remains the same */
function getInitialTranscriptIndex(transcript) {
    // Set initial index to most severe or canonical transcript.
    let initialIndex = transcript.findIndex(function({ csq_most_severe }){
        return !!(csq_most_severe);
    });

    if (initialIndex === -1){
        initialIndex = transcript.findIndex(function({ csq_canonical }){
            return !!(csq_canonical);
        });
    }

    if (initialIndex === -1){
        initialIndex = 0;
    }
    return parseInt(initialIndex);
}

export function SvGeneDetailPane(props) {
    const { paddingWidthMap, paddingWidth, containerWidth, windowWidth, result, minimumWidth, propsFromTable, schemas, context } = props;

    const { structural_variant: { transcript = [] } = {} } = context || {};
    const { ensgid: resultEnsgid = null } = result;

    // Filter out transcripts that do not match the current result's gene
    const resultTranscripts = transcript.filter(function({ csq_gene }){
        const { ensgid } = csq_gene;
        return (ensgid === resultEnsgid);
    });

    // Initialize state based on transcripts that match current result
    const [currentTranscriptIdx, setTranscriptIdx] = useState(getInitialTranscriptIndex(resultTranscripts));

    let usePadWidth = paddingWidth || 0;
    if (paddingWidthMap){
        usePadWidth = paddingWidthMap[responsiveGridState(windowWidth)] || paddingWidth;
    }

    const fallbackElem = <em> - </em>;

    const getTipForField = useMemo(function(){
        if (!schemas) return function(){ return null; };
        // Helper func to basically just shorten `schemaTransforms.getSchemaProperty(field, schemas, itemType);`.
        return function(field, itemType = "Gene"){
            // Func is scoped within GeneTabBody (uses its 'schemas')
            const schemaProperty = schemaTransforms.getSchemaProperty(field, schemas, itemType);
            return (schemaProperty || {}).description || null;
        };
    }, [ schemas ]);

    return (
        <div className="gene-tab-body card-body">
            <div className="row">
                <div className="col-12 col-md-6 d-flex flex-column">

                    <div className="inner-card-section flex-grow-1 pb-2 pb-xl-0">
                        <div className="info-header-title">
                            <h4>Overview</h4>
                        </div>
                        <div className="info-body">
                            <GeneOverview currentGeneItem={result} {...{ schemas, fallbackElem, getTipForField }} />
                        </div>
                    </div>

                    <div className="flex-grow-0 pb-2 pb-md-0">
                        <div className="info-header-title">
                            <h4>Consequence of SNV</h4>
                        </div>
                        <div className="info-body">
                            <ConsequenceOfSNVSection currentTranscript={resultTranscripts[currentTranscriptIdx]}/>
                        </div>
                    </div>
                </div>
                <div className="col-12 col-md-6 d-flex flex-column">

                    <div className="inner-card-section flex-grow-1 pb-2 pb-xl-1">
                        <div className="info-header-title">
                            <h4>External Databases</h4>
                        </div>
                        <div className="info-body">
                            <ExternalDatabasesSection currentItem={result} {...{ schemas }}/>
                        </div>
                    </div>

                    <div className="inner-card-section flex-grow-0 pb-2 pb-xl-0">
                        <div className="info-header-title">
                            <h4>Constraint Scores</h4>
                        </div>
                        <div className="info-body mb-2">
                            <ConstraintScoresSection currentGeneItem={result} {...{ schemas, getTipForField }} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ConsequenceOfSNVSection({ currentTranscript }) {
    if (!currentTranscript){
        return (
            <div className="row mb-03">
                <div className="col-12 text-center">
                    <em>No transcripts available</em>
                </div>
            </div>);
    }

    // const { } = currentTranscript;
    console.log("currentTranscript", currentTranscript);
    // TODO: Add Consequence and Breakpoints once they are added

    return (
        <React.Fragment>
            <div className="row mb-03">
                <div className="col-12 col-xl-3">
                    <label htmlFor="" className="mb-0" data-tip={null}>
                        Consequence:
                    </label>
                </div>
                <div className="col-12 col-xl-9" id="">
                    (Need Fieldname)
                </div>
            </div>
            <div className="row mb-03">
                <div className="col-12 col-xl-3">
                    <label htmlFor="" className="mb-0" data-tip={null}>
                        Breakpoint 1:
                    </label>
                </div>
                <div className="col-12 col-xl-9" id="">
                    (Need Fieldname)
                </div>
            </div>
            <div className="row mb-03">
                <div className="col-12 col-xl-3">
                    <label htmlFor="" className="mb-0" data-tip={null}>
                        Breakpoint 2:
                    </label>
                </div>
                <div className="col-12 col-xl-9" id="">
                    (Need Fieldname)
                </div>
            </div>
        </React.Fragment>
    );
}