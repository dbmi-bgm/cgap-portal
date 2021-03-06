'use strict';

import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import DropdownButton from 'react-bootstrap/esm/DropdownButton';
import DropdownItem from 'react-bootstrap/esm/DropdownItem';
import { console, layout, ajax, object, schemaTransforms } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';



export function VariantSampleInfoHeader(props) {
    const fallbackElem = <em className="text-muted" data-tip="Not Available"> - </em>;
    const {
        context,
        currentTranscriptIdx,
        currentGeneItemLoading,
        onSelectTranscript,
        schemas,
        caseID = <span className="text-muted"> - </span> // null
    } = props;
    const { variant: { ID = fallbackElem } = {} } = context;

    function getTipForField(field, itemType = "VariantSample"){
        if (!schemas) return null;
        const schemaProperty = schemaTransforms.getSchemaProperty(field, schemas, itemType);
        return (schemaProperty || {}).description || null;
    }


    return (
        // Stack these into flex column until large responsive size, then make into row.
        <div className="card mb-24 sample-variant-info-header">
            <div className="card-body">
                <div className="row flex-column flex-lg-row">

                    { caseID ?
                        <div className="inner-card-section col pb-2 pb-lg-0 col-lg-2 col-xl-1 d-flex flex-column">
                            <div className="info-header-title">
                                <h4 className="text-truncate">Case ID</h4>
                            </div>
                            <div className="info-body flex-grow-1 d-flex align-items-center">
                                <h4 className="text-400 text-center w-100">{ caseID }</h4>
                            </div>
                        </div>
                        : null }

                    <div className="inner-card-section col pb-2 pb-lg-0">
                        <div className="info-header-title">
                            <h4>Position</h4>
                        </div>
                        <div className="info-body">

                            <div className="row mb-03">
                                <div className="col-12 col-xl-2">
                                    <label htmlFor="what_fields_is_this_idk" className="mb-0">gDNA:</label>
                                </div>
                                <div className="col-12 col-xl-10" id="what_fields_is_this_idk">
                                    <GDNAList {...{ context }} />
                                </div>
                            </div>

                            <div className="row mb-03">
                                <div className="col-12 col-xl-2">
                                    <label htmlFor="variant.ID" className="mb-0" data-tip={getTipForField("variant.ID")}>
                                        dbSNP:
                                    </label>
                                </div>
                                {/**
                                 * 'col[-xl]-auto' allows entire item to ellide to next row.
                                 * May or may not be preferable depending on value content/type.
                                 */}
                                <div className="col-12 col-xl-auto" id="variant.ID">
                                    { ID }
                                </div>
                            </div>

                        </div>
                    </div>

                    <TranscriptSelectionSection {...{ context, currentTranscriptIdx, currentGeneItemLoading, onSelectTranscript, schemas }} />

                </div>
            </div>
        </div>
    );
}


function TranscriptSelectionSection(props){
    const {
        context,
        schemas,
        currentTranscriptIdx,
        currentGeneItemLoading,
        onSelectTranscript,
    } = props;
    const { variant = {} } = context;
    const { transcript: geneTranscriptList = [] } = variant;

    const geneTranscriptListLen = geneTranscriptList.length;

    // Grab it from embedded item, rather than the AJAXed in currentGeneItem, as is more 'up-to-date'.
    const selectedGeneTranscript = geneTranscriptList[currentTranscriptIdx] || null;
    const selectedGeneTitle = <GeneTranscriptDisplayTitle transcript={selectedGeneTranscript} />;

    const geneListOptions = geneTranscriptList.map(function(transcript, idx){
        return (
            <DropdownItem key={idx} eventKey={idx.toString()} active={idx === currentTranscriptIdx}>
                <GeneTranscriptDisplayTitle transcript={transcript} />
            </DropdownItem>
        );
    });

    let dropdownTitleToShow = null;
    let body = null;

    if (geneTranscriptListLen === 0) {
        // Could maybe just return null, also, if want to hide completely..
        dropdownTitleToShow = <em>No transcripts available</em>;
        body = (
            <div className="d-flex align-items-center justify-content-center h-100">
                <i className="icon icon-fw icon-exclamation-triangle text-secondary text-larger fas py-08"/>
            </div>
        );
    } else {
        // TODO separate into own component?
        dropdownTitleToShow = selectedGeneTranscript ? (
            <span>
                { selectedGeneTitle }
                { currentGeneItemLoading ? <i className="ml-07 icon icon-spin fas icon-circle-notch"/> : null }
                &nbsp;
            </span>
        ) : <em>No gene selected</em>;
        body = <TranscriptSelectionSectionBody {...{ schemas }} currentTranscript={geneTranscriptList[currentTranscriptIdx]} />;
    }


    return (
        <div className="inner-card-section col pb-2 pb-lg-0">

            <div className="info-header-title">
                {/* passing 'py-1' to className of button via `size` prop - kinda hacky - noting here in case changes in future version, or if find better prop to use */}
                <DropdownButton title={dropdownTitleToShow} size="lg py-1" variant="outline-secondary select-transcript" onSelect={onSelectTranscript}
                    disabled={geneTranscriptListLen === 0} data-tip="Select a transcript (& gene) to view their details">
                    { geneListOptions }
                </DropdownButton>
                <div className="flex-grow-1 text-right">
                    {/* BA1, BS1 here maybe */}
                </div>
            </div>

            <div className="info-body">{ body }</div>
        </div>
    );
}

function TranscriptSelectionSectionBody({ schemas, currentTranscript }){
    const fallbackElem = <em className="text-muted" data-tip="Not Available"> - </em>;
    const {
        csq_hgvsc = fallbackElem,
        csq_hgvsp = fallbackElem,
        csq_exon = null,
        csq_gene : {
            display_title: currentGeneDisplayTitle = null
        } = {},
        csq_consequence = []
    } = currentTranscript || {};

    /* Helper func to basically just shorten `schemaTransforms.getSchemaProperty(field, schemas, itemType);`. */
    function getTipForField(field, itemType = "Variant"){
        if (!schemas) return null;
        const schemaProperty = schemaTransforms.getSchemaProperty(field, schemas, itemType);
        return (schemaProperty || {}).description || null;
    }

    const mostSevereConsequence = useMemo(function(){
        return getMostSevereConsequence(csq_consequence);
    }, [ csq_consequence ]);

    const transcriptLocation = useMemo(function(){
        return getTranscriptLocation(currentTranscript, mostSevereConsequence);
    }, [ currentTranscript, mostSevereConsequence ]);

    const { coding_effect: consequenceCodingEffect = fallbackElem } = mostSevereConsequence || {};

    return (
        <div className="row">



            <div className="col-5 col-lg-12 col-xl-5">

                {/* We could make these below into reusable component later once know this what we want fo sure */}

                <div className="row mb-03">
                    <div className="col-12 col-lg-4 col-xl-6">
                        <label htmlFor="calculated_transcript_location" className="mb-0">Location:</label>
                    </div>
                    <div className="col-12 col-lg" id="calculated_transcript_location">
                        { transcriptLocation }
                    </div>
                </div>

                <div className="row mb-03">
                    <div className="col-12 col-lg-4 col-xl-6">
                        <label htmlFor="variant.transcript.csq_consequence.coding_effect" className="mb-0"
                            data-tip={getTipForField("transcript.csq_consequence.coding_effect")}>
                            Coding Effect:
                        </label>
                    </div>
                    <div className="col-12 col-lg" id="variant.transcript.csq_consequence.coding_effect">
                        { consequenceCodingEffect }
                    </div>
                </div>

            </div>



            <div className="col-7 col-lg-12 col-xl-7">

                {/* We could make these below into reusable component later once know this what we want fo sure */}

                <div className="row mb-03">
                    <div className="col-12 col-lg-4 col-xl-3">
                        <label htmlFor="variant.transcript.csq_gene.display_title" className="mb-0" data-tip={getTipForField("transcript.csq_gene")}>
                            Gene:
                        </label>
                    </div>
                    {/**
                            * 'col-xl' (instead of 'col-xl-9') allows entire item to ellide to next row.
                            * May or may not be preferable depending on value content/type/label-size.
                            * Will consider consistency more after.
                            */}
                    <div className="col-12 col-lg" id="variant.transcript.csq_gene.display_title">
                        { currentGeneDisplayTitle || <em>None selected</em> }
                    </div>
                </div>

                <div className="row mb-03">
                    <div className="col-12 col-lg-4 col-xl-3">
                        <label htmlFor="csq_hgvsc" className="mb-0" data-tip={getTipForField("transcript.csq_hgvsc")}>cDNA:</label>
                    </div>
                    <div className="col-12 col-lg-auto" id="variant.transcript.csq_hgvsc">
                        { csq_hgvsc }
                    </div>
                </div>

                <div className="row mb-03">
                    <div className="col-12 col-lg-4 col-xl-3">
                        <label htmlFor="csq_hgvsp" className="mb-0" data-tip={getTipForField("transcript.csq_hgvsp")}>AA / AA:</label>
                    </div>
                    <div className="col-12 col-lg" id="variant.transcript.csq_hgvsp">
                        { csq_hgvsp }
                    </div>
                </div>

            </div>

        </div>
    );
}


function GeneTranscriptDisplayTitle({ transcript, className = "text-600" }){
    if (!transcript) return null;
    const {
        csq_canonical = false,
        csq_mane = null,
        csq_feature = <em>No Name</em>,
        csq_biotype = null,
        csq_gene : {
            display_title: geneDisplayTitle = null
        } = {}
    } = transcript;
    return (
        <span className={className}>
            <span>{ csq_mane || csq_feature }</span>
            <span className="text-400"> ({ geneDisplayTitle || <em>No Gene</em> })</span>
            { csq_canonical ? <span className="text-300"> (canonical)</span> : null }
        </span>
    );
}

/** This will likely need/get feedback and may change */
function getMostSevereConsequence(csq_consequence = []){
    const impactMap = {
        "HIGH" : 0,
        "MODERATE" : 1,
        "LOW" : 2,
        "MODIFIER" : 3
    };

    if (csq_consequence.length === 0) {
        return null;
    }

    const [ mostSevereConsequence ] = csq_consequence.slice().sort(function({ impact: iA }, { impact: iB }){
        return impactMap[iA] - impactMap[iB];
    });

    return mostSevereConsequence;
}

function getTranscriptLocation(transcript, mostSevereConsequence = null){
    const {
        csq_exon = null,
        csq_intron = null,
        csq_distance = null,
    } = transcript || {};

    const { var_conseq_name = null } = mostSevereConsequence || {};
    const consequenceName = (typeof var_conseq_name === "string" && var_conseq_name.toLowerCase()) || null;

    let returnString = null;

    if (csq_exon !== null) { // In case csq_exon is `0` or something (unsure if possible)
        returnString = "Exon " + csq_exon;
    } else if (csq_intron !== null) {
        returnString = "Intron " + csq_intron;
    } else if (csq_distance !== null) {
        if (consequenceName === "downstream_gene_variant") {
            returnString = csq_distance + "bp downstream";
        } else if (consequenceName === "upstream_gene_variant") {
            returnString = csq_distance + "bp upstream";
        }
    }

    if (consequenceName === "3_prime_utr_variant"){
        returnString = returnString ? returnString + " (3′ UTR)" : "3′ UTR" ;
    } else if (consequenceName === "5_prime_utr_variant"){
        returnString = returnString ? returnString + " (5′ UTR)" : "5′ UTR" ;
    }

    return returnString;
}

function GDNAList({ context }){
    const fallbackElem = <em data-tip="Not Available"> - </em>;
    const { variant = {} } = context;
    const {
        // mutanno_hgvsg = fallbackElem, // (temporarily?) removed
        display_title: hgvsg_placeholder = fallbackElem,
        // POS: pos,
        CHROM: chrom = fallbackElem,
        csq_hg19_chr = fallbackElem,
        csq_hg19_pos = fallbackElem
    } = variant;

    const renderedRows =  (
        <React.Fragment>
            {/* Canononical GRCh38 entry */}
            <div className="row pb-1 pb-md-03" key="GRCh38">
                <div className="col-12 col-md-3 font-italic"><em>GRCh38</em></div>
                <div className="col-12 col-md-2">{ chrom }</div>
                <div className="col-12 col-md-7">{ hgvsg_placeholder }</div>
            </div>
            {/* Legacy GRCh37/hg19 support. */}
            <div className="row pb-1 pb-md-03" key="GCRCh37">
                <div className="col-12 col-md-3 font-italic"><em>GRCh37 (hg19)</em></div>
                <div className="col-12 col-md-2 ">{ csq_hg19_chr }</div>
                <div className="col-12 col-md-7">{ csq_hg19_pos }</div>
            </div>
        </React.Fragment>
    );

    //Legacy GRCh37/hg19 support.
    /** @DEPRECATED as of Annotations v20; leaving here since csq_hg19 may be reverted to array again in future
     * csq_hg19.forEach(function({ csq_hg19_pos, csq_hg19_chrom, csq_hg19_hgvsg }, idx){
        renderedRows.push(
            <div className="row pb-1 pb-md-03" key={idx}>
                <div className="col-12 col-md-3 font-italic"><em>GRCh37 (hg19)</em></div>
                <div className="col-12 col-md-2 ">{ csq_hg19_chrom }</div>
                <div className="col-12 col-md-7">{ csq_hg19_hgvsg }</div>
            </div>
        );
    });
    */

    return renderedRows;
}

