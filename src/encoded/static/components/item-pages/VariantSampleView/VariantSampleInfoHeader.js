'use strict';

import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import DropdownButton from 'react-bootstrap/esm/DropdownButton';
import DropdownItem from 'react-bootstrap/esm/DropdownItem';
import { console, layout, ajax, object, schemaTransforms } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';



export function VariantSampleInfoHeader(props) {
    const fallbackElem = <em className="text-muted" data-tip="Not Available">N/A</em>;
    const {
        context,
        currentTranscriptIdx,
        currentGeneItemLoading,
        onSelectTranscript,
        schemas,
        caseID = <span className="text-muted">N/A</span> // null
    } = props;
    const { variant: { dbsnp_rs_number = fallbackElem } = {} } = context;

    function getTipForField(field, itemType = "VariantSample"){
        if (!schemas) return null;
        const schemaProperty = schemaTransforms.getSchemaProperty(field, schemas, itemType);
        return (schemaProperty || {}).description || null;
    }


    return (
        // Stack these into flex column until large responsive size, then make into row.
        <div className="card mb-24">
            <div className="card-body">
                <div className="row flex-column flex-lg-row">

                    { caseID ?
                        <div className="inner-card-section col pb-2 pb-lg-0 col-lg-2 col-xl-1 d-flex flex-column">
                            <div className="info-header-title">
                                <h4 className="text-ellipsis-container">Case ID</h4>
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
                                    <label htmlFor="variant.dbsnp_rs_number" className="mb-0" data-tip={getTipForField("variant.dbsnp_rs_number")}>
                                        dbSNP:
                                    </label>
                                </div>
                                {/**
                                 * 'col[-xl]-auto' allows entire item to ellide to next row.
                                 * May or may not be preferable depending on value content/type.
                                 */}
                                <div className="col-12 col-xl-auto" id="variant.dbsnp_rs_number">
                                    { dbsnp_rs_number }
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
            <DropdownItem key={idx} eventKey={idx} active={idx === currentTranscriptIdx}>
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
                <DropdownButton title={dropdownTitleToShow} size="lg py-1" variant="outline-secondary" onSelect={onSelectTranscript}
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
    const fallbackElem = <em className="text-muted" data-tip="Not Available">N/A</em>;
    const {
        vep_hgvsc = fallbackElem,
        vep_hgvsp = fallbackElem,
        vep_exon = null,
        vep_gene : {
            display_title: currentGeneDisplayTitle = null
        } = {},
        vep_consequence = []
    } = currentTranscript || {};

    function getTipForField(field, itemType = "Transcript"){
        if (!schemas) return null;
        const schemaProperty = schemaTransforms.getSchemaProperty(field, schemas, itemType);
        return (schemaProperty || {}).description || null;
    }

    return (
        <div className="row">

            <div className="col col-xl-6">

                {/* We could make these below into reusable component later once know this what we want fo sure */}

                <div className="row mb-03">
                    <div className="col-12 col-xl-3">
                        <label htmlFor="variant.transcript.vep_gene.display_title" className="mb-0" data-tip={getTipForField("vep_gene")}>
                            Gene:
                        </label>
                    </div>
                    {/**
                            * 'col-xl' (instead of 'col-xl-9') allows entire item to ellide to next row.
                            * May or may not be preferable depending on value content/type/label-size.
                            * Will consider consistency more after.
                            */}
                    <div className="col-12 col-xl" id="variant.transcript.vep_gene.display_title">
                        { currentGeneDisplayTitle || <em>None selected</em> }
                    </div>
                </div>

                <div className="row mb-03">
                    <div className="col-12 col-xl-3">
                        <label htmlFor="vep_hgvsc" className="mb-0" data-tip={getTipForField("vep_hgvsc")}>cDNA:</label>
                    </div>
                    <div className="col-12 col-xl-auto" id="variant.transcript.vep_hgvsc">
                        { vep_hgvsc }
                    </div>
                </div>

                <div className="row mb-03">
                    <div className="col-12 col-xl-3">
                        <label htmlFor="vep_hgvsp" className="mb-0" data-tip={getTipForField("vep_hgvsp")}>AA / AA:</label>
                    </div>
                    <div className="col-12 col-xl" id="variant.transcript.vep_hgvsp">
                        { vep_hgvsp }
                    </div>
                </div>

            </div>


            <div className="col col-xl-6">

                {/* We could make these below into reusable component later once know this what we want fo sure */}

                <div className="row mb-03">
                    <div className="col-12 col-xl-6">
                        <label htmlFor="vep_exon" className="mb-0" data-tip={getTipForField("vep_exon")}>Location:</label>
                    </div>
                    <div className="col-12 col-xl" id="variant.transcript.vep_exon">
                        { vep_exon ? "Exon " + vep_exon : fallbackElem }
                    </div>
                </div>

                <div className="row mb-03">
                    <div className="col-12 col-xl-6">
                        <label htmlFor="variant.transcript.vep_consequence" className="mb-0"
                            data-tip={getTipForField("vep_consequence")}>
                            Coding Effect:
                        </label>
                    </div>
                    <div className="col-12 col-xl" id="variant.transcript.vep_consequence">
                        <CodingEffectValue vep_consequence={vep_consequence} />
                    </div>
                </div>

            </div>

        </div>
    );
}


function GeneTranscriptDisplayTitle({ transcript, className = "text-600" }){
    if (!transcript) return null;
    const {
        vep_canonical = false,
        vep_feature_ncbi = null,
        vep_feature = <em>No Name</em>,
        vep_biotype = null,
        vep_gene : {
            display_title: geneDisplayTitle = null
        } = {}
    } = transcript;
    return (
        <span className={className}>
            <span>{ vep_feature_ncbi || vep_feature }</span>
            <span className="text-400"> ({ geneDisplayTitle || <em>No Gene</em> })</span>
            { vep_canonical ? <span className="text-300"> (canonical)</span> : null }
        </span>
    );
}

function GDNAList({ context }){
    const { variant = {} } = context;
    const {
        mutanno_hgvsg = <em>N/A</em>,
        // POS: pos,
        CHROM: chrom = <em>N/A</em>,
        hg19 = []
    } = variant;

    const renderedRows = [];

    // Canononical GRCh38 entry
    renderedRows.push(
        <div className="row pb-1 pb-md-03" key="GRCh38">
            <div className="col-12 col-md-3 font-italic"><em>GRCh38</em></div>
            <div className="col-12 col-md-2 ">{ chrom }</div>
            <div className="col-12 col-md-7">{ mutanno_hgvsg }</div>
        </div>
    );

    // Legacy GRCh37/hg19 support.
    hg19.forEach(function({ hg19_pos, hg19_chrom, hg19_hgvsg }, idx){
        renderedRows.push(
            <div className="row pb-1 pb-md-03" key={idx}>
                <div className="col-12 col-md-3 font-italic"><em>GRCh37 (hg19)</em></div>
                <div className="col-12 col-md-2 ">{ hg19_chrom }</div>
                <div className="col-12 col-md-7">{ hg19_hgvsg }</div>
            </div>
        );
    });

    return renderedRows;
}

/** This might not be needed since there's a 'most severe consequence' field... oh well. */
const CodingEffectValue = React.memo(function CodingEffectValue({ vep_consequence = [] }){
    // TODO grab most severe one?
    // This will likely need/get feedback and may change
    const vcLen = vep_consequence.length;
    let mostSevereConsequence = null;

    if (vcLen === 0) {
        return <em data-tip="None Available" className="text-muted">N/A</em>;
    } else if (vcLen === 1) {
        [ mostSevereConsequence ] = vep_consequence;
    } else {
        [ mostSevereConsequence ] = vep_consequence.slice().sort(function({ impact: iA }, { impact: iB }){
            return CodingEffectValue.impactMap[iA] - CodingEffectValue.impactMap[iB];
        });
    }

    const { display_title, coding_effect, '@id' : consequenceHref } = mostSevereConsequence;
    // return (
    //     <a href={consequenceHref}>
    //         { coding_effect || display_title }
    //     </a>
    // );
    return coding_effect || display_title;

});
CodingEffectValue.impactMap = {
    "HIGH" : 0,
    "MODERATE" : 1,
    "LOW" : 2,
    "MODIFIER" : 3
};
CodingEffectValue.propTypes = {
    /** Passed down from variant.transcript[currentTranscriptIdx].vep_consequence */
    vep_consequence: PropTypes.array.isRequired
};

