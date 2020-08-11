'use strict';

import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import DropdownButton from 'react-bootstrap/esm/DropdownButton';
import DropdownItem from 'react-bootstrap/esm/DropdownItem';
import { console, layout, ajax } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';



export function VariantSampleInfoHeader(props) {
    const { context, currentTranscriptIdx, currentGeneItemLoading, onSelectTranscript } = props;
    const { variant: { transcript: geneTranscriptList = [] } = {} } = context;
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
    return (
        // Stack these into flex column until large responsive size, then make into row.
        <div className="card mb-24">
            <div className="card-body">
                <div className="row flex-column flex-lg-row">
                    <div className="col col-lg-2">
                        <div className="info-header-title">
                            <h4>Case ID</h4>
                        </div>
                        <div className="info-body">

                        </div>
                    </div>
                    <div className="col">
                        <div className="info-header-title">
                            <h4>Position</h4>
                        </div>
                        <div className="info-body">

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
                                            <label htmlFor="gene_display_title" className="mb-0">Gene:</label>
                                        </div>
                                        <div className="col-12 col-xl-auto" id="gene_display_title">
                                            { currentGeneDisplayTitle || <em>No transcript selected.</em> }
                                        </div>
                                    </div>

                                    <div className="row mb-03">
                                        <div className="col-12 col-xl-3">
                                            <label htmlFor="vep_hgvsc" className="mb-0">cDNA:</label>
                                        </div>
                                        <div className="col-12 col-xl-auto" id="vep_hgvsc">
                                            { vep_hgvsc }
                                        </div>
                                    </div>

                                    <div className="row mb-03">
                                        <div className="col-12 col-xl-3">
                                            <label htmlFor="vep_hgvsp" className="mb-0">AA / AA:</label>
                                        </div>
                                        <div className="col-12 col-xl-auto" id="vep_hgvsp">
                                            { vep_hgvsp }
                                        </div>
                                    </div>

                                </div>
                                <div className="col col-xl-6">

                                    {/* We could make these below into reusable component later once know this what we want fo sure */}

                                    <div className="row mb-03">
                                        <div className="col-12 col-xl-6">
                                            <label htmlFor="vep_exon" className="mb-0">Location:</label>
                                        </div>
                                        <div className="col-12 col-xl-auto" id="vep_exon">
                                            { vep_exon ? "Exon " + vep_exon : <em>No exon location</em> }
                                        </div>
                                    </div>

                                    <div className="row mb-03">
                                        <div className="col-12 col-xl-6">
                                            <label htmlFor="vep_feature" className="mb-0">Coding Effect:</label>
                                        </div>
                                        <div className="col-12 col-xl-auto" id="vep_feature">
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

const CodingEffectValue = React.memo(function CodingEffectValue({ vep_consequence = [] }){
    // TODO grab most severe one?
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

