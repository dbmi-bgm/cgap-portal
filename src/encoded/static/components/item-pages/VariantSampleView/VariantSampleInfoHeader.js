'use strict';

import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import DropdownButton from 'react-bootstrap/esm/DropdownButton';
import DropdownItem from 'react-bootstrap/esm/DropdownItem';
import { console, layout, ajax, object, schemaTransforms } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';



export function VariantSampleInfoHeader(props) {
    const { context, currentTranscriptIdx, currentGeneItemLoading, onSelectTranscript, schemas } = props;
    const { variant = {} } = context;
    const {
        transcript: geneTranscriptList = [],
        dbsnp_rs_number = <em>N/A</em>
    } = variant;

    function getTipForField(field, itemType = "VariantSample"){
        if (!schemas) return null;
        const schemaProperty = schemaTransforms.getSchemaProperty(field, schemas, itemType);
        return (schemaProperty || {}).description || null;
    }

    const geneTranscriptListLen = geneTranscriptList.length;

    // Grab it from embedded item, rather than the AJAXed in currentGeneItem, as is more 'up-to-date'.
    const selectedGeneTranscript = geneTranscriptList[currentTranscriptIdx];
    const selectedGeneTitle = <GeneTranscriptDisplayTitle transcript={selectedGeneTranscript} />;

    const geneListOptions = geneTranscriptList.map(function(transcript, idx){
        return (
            <DropdownItem key={idx} eventKey={idx} active={idx === currentTranscriptIdx}>
                <GeneTranscriptDisplayTitle transcript={transcript} />
            </DropdownItem>
        );
    });

    const geneTitleToShow = selectedGeneTranscript ? (
        <span>
            { selectedGeneTitle }
            { currentGeneItemLoading ? <i className="ml-07 icon icon-spin fas icon-circle-notch"/> : null }
        </span>
    ) : (geneTranscriptListLen === 0 ? <em>No genes available</em> : <em>No gene selected</em>);

    const currentTranscript = geneTranscriptList[currentTranscriptIdx];
    const {
        vep_hgvsc = <em>N/A</em>,
        vep_hgvsp = <em>N/A</em>,
        vep_exon = <em>N/A</em>,
        vep_gene : {
            display_title: currentGeneDisplayTitle = null
        } = {},
        vep_consequence = []
    } = currentTranscript;

    // TODO consider common styling for .info-header title, maybe it could be display: flex with align-items: center and vertically
    // center its children equally regardless if text or DropdownButton (and maybe is applied to a div where h4 would become child of it)

    // _POSSIBLE TODO_ - look up 'title', 'description' (for tooltips) for these fields from Schema where possible. Tho too early for that IMO since UX itself may still change.
    // So leaving flexible for now. Storing these fields for now into label htmlFor and ids, which may or may not be ultimately useful for anything other than semantics
    // (we could later use like SPC's object.getNestedProperty() if inside reusable component... maybe not re: selecting most severe thing tho..)
    return (
        // Stack these into flex column until large responsive size, then make into row.
        <div className="card mb-24">
            <div className="card-body">
                <div className="row flex-column flex-lg-row">
                    <div className="col col-lg-2 col-xl-1">
                        <div className="info-header-title">
                            <h4>Case ID</h4>
                        </div>
                        <div className="info-body">
                            {/** Can we get value for this from VariantSample Item itself?
                              * If not, it could be an optional prop which if present, renders this <div className="col col-lg-2">..</div>,
                              * else is just excluded?
                              */}
                        </div>
                    </div>
                    <div className="col">
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
                    <div className="col">
                        <div className="d-flex">
                            <div className="info-header-title">
                                <DropdownButton title={geneTitleToShow} variant="outline-dark" onSelect={onSelectTranscript} disabled={geneTranscriptListLen === 0}>
                                    { geneListOptions }
                                </DropdownButton>
                            </div>
                            <div className="flex-grow-1 text-right">
                                {/* BA1, BS1 here maybe */}
                            </div>
                        </div>
                        <div className="info-body">
                            <div className="row">

                                <div className="col col-xl-6">

                                    {/* We could make these below into reusable component later once know this what we want fo sure */}

                                    <div className="row mb-03">
                                        <div className="col-12 col-xl-3">
                                            <label htmlFor="variant.transcript.vep_gene.display_title" className="mb-0" data-tip={getTipForField("transcript.vep_gene", "Variant")}>
                                                Gene:
                                            </label>
                                        </div>
                                        {/**
                                          * 'col-xl' (instead of 'col-xl-9') allows entire item to ellide to next row.
                                          * May or may not be preferable depending on value content/type/label-size.
                                          * Will consider consistency more after.
                                          */}
                                        <div className="col-12 col-xl" id="variant.transcript.vep_gene.display_title">
                                            { currentGeneDisplayTitle || <em>No transcript selected.</em> }
                                        </div>
                                    </div>

                                    <div className="row mb-03">
                                        <div className="col-12 col-xl-3">
                                            <label htmlFor="vep_hgvsc" className="mb-0" data-tip={getTipForField("transcript.vep_hgvsc", "Variant")}>cDNA:</label>
                                        </div>
                                        <div className="col-12 col-xl-auto" id="variant.transcript.vep_hgvsc">
                                            { vep_hgvsc }
                                        </div>
                                    </div>

                                    <div className="row mb-03">
                                        <div className="col-12 col-xl-3">
                                            <label htmlFor="vep_hgvsp" className="mb-0" data-tip={getTipForField("transcript.vep_hgvsp", "Variant")}>AA / AA:</label>
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
                                            <label htmlFor="vep_exon" className="mb-0" data-tip={getTipForField("transcript.vep_exon", "Variant")}>Location:</label>
                                        </div>
                                        <div className="col-12 col-xl" id="variant.transcript.vep_exon">
                                            { vep_exon ? "Exon " + vep_exon : <em>No exon location</em> }
                                        </div>
                                    </div>

                                    <div className="row mb-03">
                                        <div className="col-12 col-xl-6">
                                            <label htmlFor="variant.transcript.vep_consequence" className="mb-0"
                                                data-tip={getTipForField("transcript.vep_consequence", "Variant")}>
                                                Coding Effect:
                                            </label>
                                        </div>
                                        <div className="col-12 col-xl" id="variant.transcript.vep_consequence">
                                            <CodingEffectValue vep_consequence={vep_consequence} />
                                        </div>
                                    </div>

                                </div>

                            </div>
                        </div>
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
            <div className="col-12 col-md-3 text-italic"><em>GRCh38</em></div>
            <div className="col-12 col-md-2 ">{ chrom }</div>
            <div className="col-12 col-md-7">{ mutanno_hgvsg }</div>
        </div>
    );

    // Legacy GRCh37/hg19 support.
    hg19.forEach(function({ hg19_pos, hg19_chrom, hg19_hgvsg }, idx){
        renderedRows.push(
            <div className="row pb-1 pb-md-03" key={idx}>
                <div className="col-12 col-md-3 text-italic"><em>GRCh37 (hg19)</em></div>
                <div className="col-12 col-md-2 ">{ hg19_chrom }</div>
                <div className="col-12 col-md-7">{ hg19_hgvsg }</div>
            </div>
        );
    });

    return renderedRows;
}

const CodingEffectValue = React.memo(function CodingEffectValue({ vep_consequence = [] }){
    // TODO grab most severe one?
    // This will likely need/get feedback and may change
    const vcLen = vep_consequence.length;
    let mostSevereConsequence = null;

    if (vcLen === 0) {
        return <em>N/A</em>;
    } else if (vcLen === 1) {
        [ mostSevereConsequence ] = vep_consequence;
    } else {
        [ mostSevereConsequence ] = vep_consequence.slice().sort(function({ impact: iA }, { impact: iB }){
            return CodingEffectValue.impactMap[iA] - CodingEffectValue.impactMap[iB];
        });
    }

    const { display_title, coding_effect, '@id' : consequenceHref } = mostSevereConsequence;
    return (
        <a href={consequenceHref}>
            { coding_effect || display_title }
        </a>
    );

});
CodingEffectValue.impactMap = {
    "HIGH" : 0,
    "MODERATE" : 1,
    "LOW" : 2,
    "MODIFIER" : 3
};

