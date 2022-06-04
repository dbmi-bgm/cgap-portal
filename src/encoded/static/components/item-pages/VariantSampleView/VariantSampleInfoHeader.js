'use strict';

import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import DropdownButton from 'react-bootstrap/esm/DropdownButton';
import DropdownItem from 'react-bootstrap/esm/DropdownItem';
import { console, layout, ajax, object, schemaTransforms } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';
import { GeneTranscriptDisplayTitle, getMostSevereConsequence, getTranscriptLocation } from './AnnotationSections';
import QuickPopover from '../components/QuickPopover';



export function VariantSampleInfoHeader(props) {
    const fallbackElem = <em className="text-muted" data-tip="Not Available"> - </em>;
    const {
        context,
        currentTranscriptIdx,
        currentGeneItemLoading,
        onSelectTranscript,
        schemas,
        caseID = null,
        showTranscriptSelection = true
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

                    {/* caseID ?
                        <div className="inner-card-section col pb-2 pb-xl-0 col-lg-2 col-xl-1 d-flex flex-column">
                            <div className="info-header-title">
                                <h4 className="text-truncate">Case ID</h4>
                            </div>
                            <div className="info-body flex-grow-1 d-flex align-items-center">
                                <h4 className="text-400 text-center w-100">{ caseID || fallbackElem }</h4>
                            </div>
                        </div>
                    : null */}

                    <div className="inner-card-section col pb-2 pb-xl-0">
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
                    { showTranscriptSelection ?
                        <TranscriptSelectionSection {...{ context, currentTranscriptIdx, currentGeneItemLoading, onSelectTranscript, schemas }} />
                        : null }
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
            </span>
        ) : <em>No gene selected</em>;
        body = <TranscriptSelectionSectionBody {...{ schemas }} currentTranscript={geneTranscriptList[currentTranscriptIdx]} />;
    }


    return (
        <div className="inner-card-section col-12 col-xl pb-xl-2">

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

    const { display_title: consequenceTitle = fallbackElem } = mostSevereConsequence || {};

    return (
        <div className="row">



            <div className="col-5">

                {/* We could make these below into reusable component later once know this what we want fo sure */}

                <div className="row mb-03">
                    <div className="col-12 col-lg-5 col-xl-6">
                        <label htmlFor="calculated_transcript_location" className="mb-0">Location:</label>
                    </div>
                    <div className="col-12 col-lg-auto" id="calculated_transcript_location">
                        { transcriptLocation }
                    </div>
                </div>

                <div className="row mb-03">
                    <div className="col-12 col-lg-5 col-xl-6">
                        <label htmlFor="variant.transcript.csq_consequence" className="mb-0"
                            data-tip={getTipForField("transcript.csq_consequence")}>
                            Consequence:
                        </label>
                    </div>
                    <div className="col-12 col-lg-auto" id="variant.transcript.csq_consequence">
                        { consequenceTitle }
                    </div>
                </div>

            </div>



            <div className="col-7">

                {/* We could make these below into reusable component later once know this what we want fo sure */}

                <div className="row mb-03">
                    <div className="col-12 col-lg-4 col-xl-4">
                        <label htmlFor="variant.transcript.csq_gene.display_title" className="mb-0" data-tip={getTipForField("transcript.csq_gene")}>
                            Gene:
                        </label>
                    </div>
                    {/**
                            * 'col-xl' (instead of 'col-xl-9') allows entire item to ellide to next row.
                            * May or may not be preferable depending on value content/type/label-size.
                            * Will consider consistency more after.
                            */}
                    <div className="col-12 col-lg-auto" id="variant.transcript.csq_gene.display_title">
                        { currentGeneDisplayTitle || <em>None selected</em> }
                    </div>
                </div>

                <div className="row mb-03">
                    <div className="col-12 col-lg-4 col-xl-4">
                        <label htmlFor="csq_hgvsc" className="mb-0" data-tip={getTipForField("transcript.csq_hgvsc")}>cDNA:</label>
                    </div>
                    <div className="col-12 col-lg-auto" id="variant.transcript.csq_hgvsc">
                        { csq_hgvsc }
                    </div>
                </div>

                <div className="row mb-03">
                    <div className="col-12 col-lg-4 col-xl-4">
                        <label htmlFor="csq_hgvsp" className="mb-0" data-tip={getTipForField("transcript.csq_hgvsp")}>AA / AA:</label>
                    </div>
                    <div className="col-12 col-lg-auto" id="variant.transcript.csq_hgvsp">
                        { csq_hgvsp }
                    </div>
                </div>

            </div>

        </div>
    );
}
function GDNAList({ context }){
    const fallbackElem = <em data-tip="Not Available"> - </em>;
    const { variant = {} } = context;
    const {
        // mutanno_hgvsg = fallbackElem, // (temporarily?) removed
        // display_title: hgvsg_placeholder = fallbackElem, // Superseded by more explicit `hgvsg`
        // POS: pos,
        hgvsg = fallbackElem,
        CHROM: chrom = fallbackElem,
        hg19_chr = fallbackElem,
        hgvsg_hg19 = fallbackElem
    } = variant;

    const renderedRows =  (
        <React.Fragment>
            {/* Canononical GRCh38 entry */}
            <div className="row pb-1 pb-md-03" key="GRCh38">
                <div className="col-12 col-md-3 font-italic"><em>GRCh38</em></div>
                <div className="col-12 col-md-2">{ chrom }</div>
                <div className="col-12 col-md-7">{ hgvsg }</div>
            </div>
            {/* Legacy GRCh37/hg19 support. */}
            <div className="row pb-1 pb-md-03" key="GRCh37">
                <div className="col-12 col-md-3 font-italic">
                    <em>GRCh37 (hg19)</em>
                    <QuickPopover popID="sv_vi_grch37" title={hg19PopoverTitle} className="p-0 ml-02 icon-sm">
                        {hg19PopoverContent}
                    </QuickPopover>
                </div>
                <div className="col-12 col-md-2 ">{ hg19_chr }</div>
                <div className="col-12 col-md-7">{ hgvsg_hg19 }</div>
            </div>
        </React.Fragment>
    );

    //Legacy GRCh37/hg19 support.
    /** @DEPRECATED as of Annotations v20; leaving here since csq_hg19 may be reverted to array again in future
     * csq_hg19.forEach(function({ hg19_pos, hg19_chr, csq_hg19_hgvsg }, idx){
        renderedRows.push(
            <div className="row pb-1 pb-md-03" key={idx}>
                <div className="col-12 col-md-3 font-italic"><em>GRCh37 (hg19)</em></div>
                <div className="col-12 col-md-2 ">{ hg19_chr }</div>
                <div className="col-12 col-md-7">{ csq_hg19_hgvsg }</div>
            </div>
        );
    });
    */

    return renderedRows;
}


const hg19PopoverTitle = "The HGVS-formatted variant in hg19 coordinates is calculated.";
const hg19PopoverContent = (
    <div>
        <p>
            All variants are currently called for the hg38 reference genome. If the variant in hg19
            coordinates is not available, the conversion calculation was not successful.
        </p>
        <p>
            To calculate the variant for hg19 coordinates, the hg38 position is converted to hg19
            via an implementation of <a href="https://github.com/konstantint/pyliftover">LiftOver</a>. If the hg19 conversion
            is successful, the variant is then converted to HGSV format. If the HGSV conversion is
            also successful, the result will be displayed. Otherwise, only the hg38 coordinates for
            the variant will be displayed.
        </p>
    </div>
);