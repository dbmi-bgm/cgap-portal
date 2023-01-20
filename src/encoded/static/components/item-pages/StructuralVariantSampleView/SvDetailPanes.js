'use strict';

import React, { useMemo, useState, useEffect } from 'react';
import ReactTooltip from 'react-tooltip';
import PropTypes from 'prop-types';
import DropdownButton from 'react-bootstrap/esm/DropdownButton';
import DropdownItem from 'react-bootstrap/esm/DropdownItem';

import { object, schemaTransforms } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { responsiveGridState } from './../../util/layout';

import { ExternalDatabasesSection, GeneOverview, ConstraintScoresSection, GeneTranscriptDisplayTitle, getInitialTranscriptIndex } from '../VariantSampleView/AnnotationSections';
import QuickPopover from '../components/QuickPopover';
import Popover from 'react-bootstrap/esm/Popover';

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

    const externalDatabaseFieldnames = [
        "genecards",
        "medline_plus",
        "gencc",
        "ensgid",
        "entrez_id",
        "hgnc_id",
        "genereviews",
        "uniprot_ids",
        "pdb",
        "mgi_id",
        "marrvel",
        "omim_id",
        "orphanet",
        "clingen",
        "pharmgkb",
        "gtex_expression",
        "brainspan_microarray",
        "brainspan_rnaseq",
        "brainatlas_microarray",
        "biogrid",
        "string",
        "hgmd_id" // specific to sv detail pane
    ];

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
                            <ExternalDatabasesSection currentItem={result} {...{ schemas, externalDatabaseFieldnames }}/>
                        </div>
                    </div>

                    <div className="inner-card-section flex-grow-0 pb-2 pb-xl-0">
                        <div className="info-header-title">
                            <h4>Constraint Scores</h4>
                        </div>
                        <div className="info-body mb-2 overflow-auto">
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
        <DropdownButton title={dropdownTitleToShow} size="sm py-1" variant="outline-secondary select-transcript text-truncate" onSelect={setTranscriptIdx}
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
            </div>
        );
    }

    const {
        fallbackElem,
        csq_consequence = [],
        csq_variant_5_prime_location = "",
        csq_variant_3_prime_location = ""
    } = currentTranscript;

    return (
        <React.Fragment>
            <div className="row mb-03">
                <div className="col-12 col-xl-3 mb-04">
                    <label htmlFor="sv-consequence" className="mb-0" data-tip={null}>
                        Consequence:
                    </label>
                </div>
                <div className="col-12 col-xl-9" id="sv-consequence">
                    { csq_consequence.map((c) => c.display_title).join(", ") || fallbackElem}
                </div>
            </div>
            <div className="row mb-03">
                <div className="col-12 col-xl-3">
                    <label htmlFor="sv-con-break1" className="mb-0" data-tip={null}>
                        Breakpoint 1:
                        <QuickPopover popID="sv-con-break2-pop" className="p-0 ml-02 icon-sm" tooltip="Click for more information" title={breakpointPopoverTitle}>
                            { breakpointPopoverContent }
                        </QuickPopover>
                    </label>
                </div>
                <div className="col-12 col-xl-9" id="sv-con-break1">
                    { csq_variant_5_prime_location.split("_").join(" ") || fallbackElem }
                </div>
            </div>
            <div className="row mb-03">
                <div className="col-12 col-xl-3">
                    <label htmlFor="sv-con-break2" className="mb-0" data-tip={null}>
                        Breakpoint 2:
                        <QuickPopover popID="sv-con-break2-pop" className="p-0 ml-02 icon-sm" tooltip="Click for more information" title={breakpointPopoverTitle}>
                            { breakpointPopoverContent }
                        </QuickPopover>
                    </label>
                </div>
                <div className="col-12 col-xl-9" id="sv-con-break2">
                    { csq_variant_3_prime_location.split("_").join(" ") || fallbackElem }
                </div>
            </div>
        </React.Fragment>
    );
}

const breakpointPopoverTitle = "Breakpoint locations are determined relative to the transcript based on VEP annotations.";

const breakpointPopoverContent = (
    <div className="popover-content-inner">
        <p>
            Most transcripts have sufficient annotation information to calculate where the
            structural variant starts and ends relative to the 5 prime and 3 prime ends of the
            transcript. Possible values include:
        </p>
        <ul>
            <li>
                <b> Upstream </b>: Breakpoint is located beyond the 5 prime UTR.
            </li>
            <li>
                <b> Downstream </b>: Breakpoint is located beyond the 3 prime UTR.
            </li>
            <li>
                <b> 5 prime UTR </b>: Breakpoint is located within the 5 prime UTR.
            </li>
            <li>
                <b> 3 prime UTR </b>: Breakpoint is located within the 3 prime UTR.
            </li>
            <li>
                <b> Upstream or 5 prime UTR </b>: Breakpoint is located either upstream of or
                within the 5 prime UTR (insufficient information to determine which).
            </li>
            <li>
                <b> 3 prime UTR or Downstream </b>: Breakpoint is located either in the 3 prime
                UTR or downstream of it (insufficient information to determine which).
            </li>
            <li>
                <b> Exonic </b>: Breakpoint is located within an exon.
            </li>
            <li>
                <b> Intronic </b>: Breakpoint is located within an intron.
            </li>
            <li>
                <b> Within miRNA </b>: Breakpoint is located within an miRNA coding region.
            </li>
            <li>
                <b> Indeterminate </b>: Insufficient information to determine a location for the
                breakpoint relative to the transcript.
            </li>
        </ul>
    </div>
);