'use strict';

import React, { useMemo, useState, useEffect } from 'react';
import ReactTooltip from 'react-tooltip';
import PropTypes from 'prop-types';
import DropdownButton from 'react-bootstrap/esm/DropdownButton';
import DropdownItem from 'react-bootstrap/esm/DropdownItem';

import { object, schemaTransforms } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { responsiveGridState } from './../../util/layout';

import { ExternalDatabasesSection, GeneOverview, ConstraintScoresSection, GeneTranscriptDisplayTitle } from '../VariantSampleView/AnnotationSections';

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

    useEffect(function(){
        setTimeout(function(){ ReactTooltip.rebuild(); }, 1000);
    }, []); // Empty array == memoized but on nothing == run it only once on mount

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
                    <div className="inner-card-section flex-grow-0 pb-2 pb-md-0">
                        <div className="info-header-title">
                            <h4>Consequence of SV</h4>
                            <TranscriptSelectionDropdown {...{ context, schemas, currentTranscriptIdx, setTranscriptIdx }}
                                transcripts={resultTranscripts}/>
                        </div>
                        <div className="info-body">
                            <ConsequenceOfSVSection currentTranscript={resultTranscripts[currentTranscriptIdx]} {...{ fallbackElem }}/>
                        </div>
                    </div>
                    <div className="inner-card-section flex-grow-1 pb-2 mt-1 pb-xl-0">
                        <div className="info-header-title">
                            <h4>Gene Overview</h4>
                        </div>
                        <div className="info-body">
                            <GeneOverview currentGeneItem={result} {...{ schemas, fallbackElem, getTipForField }} />
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

function TranscriptSelectionDropdown(props){
    const { setTranscriptIdx, currentTranscriptIdx, context, schemas, transcripts } = props;

    const currentTranscript = transcripts[currentTranscriptIdx] || null;
    const geneListOptions = transcripts.map(function(transcript, idx){
        return (
            <DropdownItem key={idx} eventKey={idx.toString()} active={idx === currentTranscriptIdx}>
                <GeneTranscriptDisplayTitle transcript={transcript} hideGene />
            </DropdownItem>
        );
    });
    const geneTranscriptListLen = geneListOptions.length;
    let dropdownTitleToShow;

    if (geneTranscriptListLen === 0) {
        dropdownTitleToShow = <em>No transcripts available</em>;
    } else {
        dropdownTitleToShow = <GeneTranscriptDisplayTitle transcript={currentTranscript} hideGene />;
    }

    return (
        <DropdownButton title={dropdownTitleToShow} size="sm py-1" variant="outline-secondary select-transcript" onSelect={setTranscriptIdx}
            disabled={geneTranscriptListLen <= 1} data-tip={"Select a transcript to view their details"}>
            { geneListOptions }
        </DropdownButton>
    );
}

function ConsequenceOfSVSection({ currentTranscript }) {
    if (!currentTranscript){
        return (
            <div className="row mb-03">
                <div className="col-12 text-center">
                    <em>No transcripts available</em>
                </div>
            </div>);
    }

    const { fallbackElem, csq_consequence = [] } = currentTranscript;
    // TODO: Add breakpoints once they are ready

    return (
        <React.Fragment>
            <div className="row mb-03">
                <div className="col-12 col-xl-3">
                    <label htmlFor="snv-consequence" className="mb-0" data-tip={null}>
                        Consequence:
                    </label>
                </div>
                <div className="col-12 col-xl-9" id="snv-consequence">
                    { csq_consequence.map((c) => c.display_title).join(", ") || fallbackElem}
                </div>
            </div>
            <div className="row mb-03">
                <div className="col-12 col-xl-3">
                    <label htmlFor="snv-con-break1" className="mb-0" data-tip={null}>
                        Breakpoint 1:
                    </label>
                </div>
                <div className="col-12 col-xl-9" id="snv-con-break1">
                    <span className="font-italic text-muted">{/*(Coming Soon)*/}</span>
                </div>
            </div>
            <div className="row mb-03">
                <div className="col-12 col-xl-3">
                    <label htmlFor="snv-con-break2" className="mb-0" data-tip={null}>
                        Breakpoint 2:
                    </label>
                </div>
                <div className="col-12 col-xl-9" id="snv-con-break2">
                    <span className="font-italic text-muted">{/*(Coming Soon)*/}</span>
                </div>
            </div>
        </React.Fragment>
    );
}