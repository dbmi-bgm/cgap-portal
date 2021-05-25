'use strict';

import React, { useMemo } from 'react';
import queryString from 'query-string';
import moment from 'moment';
import DropdownButton from 'react-bootstrap/esm/DropdownButton';
import { LocalizedTime } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/LocalizedTime';
import { variantSampleColumnExtensionMap, VariantSampleDisplayTitleColumn } from './../../browse/variantSampleColumnExtensionMap';

/**
 * For now, we just re-use the column render func from some VariantSample columns
 * as value 'cells' of this card.
 */
const {
    "variant.genes.genes_most_severe_gene.display_title": { render: geneTranscriptRenderFunc },
    "variant.genes.genes_most_severe_hgvsc": { render: variantRenderFunc },
    "associated_genotype_labels.proband_genotype_label": { render: genotypeLabelRenderFunc },
} = variantSampleColumnExtensionMap;


export const InterpretationTab = React.memo(function InterpretationTab (props) {
    const { variantSampleListItem, schemas, caseAccession } = props;
    const { variant_samples: vsSelections = [] } = variantSampleListItem;

    const {
        "VariantSample": {
            columns: {
                "variant.genes.genes_most_severe_gene.display_title": {
                    title: geneTranscriptColTitle,
                    description: geneTranscriptColDescription
                } = {},
                "variant.genes.genes_most_severe_hgvsc": {
                    title: variantColTitle,
                    description: variantColDescription
                } = {},
                "associated_genotype_labels.proband_genotype_label": {
                    title: genotypeLabelColTitle,
                    description: genotypeLabelColDescription
                } = {}
            } = {}
        } = {}
    } = schemas || {};

    const placeholderStatusIndicator =  (
        <span className="text-left text-muted text-truncate">
            <i className="status-indicator-dot mr-1" data-status="Not Available"/>Not Available
        </span>);

    const renderedSections = vsSelections.map(function(sel, idx){
        const {
            date_selected,
            filter_blocks_request_at_time_of_selection,
            variant_sample_item
        } = sel;
        const { "@id": vsID, interpretation = null, discovery_interpretation = null } = variant_sample_item || {};
        const { classification: acmgClassification = null } = interpretation || {};
        const { gene_candidacy: geneCandidacy = null, variant_candidacy: variantCandidacy = null } = discovery_interpretation || {};
        return (
            <div className="card mb-1" key={idx}>
                <div className="card-header">
                    <div className="d-flex align-items-center">

                        <div className="flex-grow-1 d-flex flex-column flex-sm-row">
                            <div className="flex-auto">
                                <VariantSampleDisplayTitleColumn result={variant_sample_item}
                                    link={`${vsID}?showInterpretation=True&interpretationTab=1${caseAccession ? '&caseSource=' + caseAccession : ''}`} />
                            </div>
                            <div className="flex-grow-1  d-sm-block">
                                &nbsp;
                            </div>
                            <div className="flex-auto text-small" data-tip="Date Selected">
                                <i className="icon icon-calendar far mr-07"/>
                                <LocalizedTime timestamp={date_selected} />
                            </div>
                        </div>

                        <div className="flex-auto pl-16">
                            <DropdownButton size="sm" variant="light" disabled title={
                                <React.Fragment>
                                    <i className="icon icon-bars fas mr-07"/>
                                    Actions
                                </React.Fragment>
                            }>
                                TODO
                            </DropdownButton>
                        </div>
                    </div>
                </div>
                <div className="card-body pt-0 pb-08">
                    <div className="row flex-column flex-sm-row">
                        <div className="col col-sm-4 col-lg-2 py-2">
                            <label className="mb-04 text-small" data-tip={geneTranscriptColDescription}>
                                { geneTranscriptColTitle || "Gene, Transcript" }
                            </label>
                            { geneTranscriptRenderFunc(variant_sample_item, { align: 'left', link: vsID + '?showInterpretation=True&annotationTab=0&interpretationTab=0' + (caseAccession ? '&caseSource=' + caseAccession : '') }) }
                        </div>
                        <div className="col col-sm-4 col-lg-2 py-2">
                            <label className="mb-04 text-small" data-tip={variantColDescription}>
                                { variantColTitle || "Variant" }
                            </label>
                            { variantRenderFunc(variant_sample_item, { align: 'left', link: vsID + '?showInterpretation=True&annotationTab=1&interpretationTab=1' + (caseAccession ? '&caseSource=' + caseAccession : '') }) }
                        </div>
                        <div className="col col-sm-4 col-lg-3 py-2">
                            <label className="mb-04 text-small" data-tip={genotypeLabelColDescription}>
                                { genotypeLabelColTitle || "Genotype" }
                            </label>
                            { genotypeLabelRenderFunc(variant_sample_item, { align: 'left' }) }
                        </div>
                        <div className="col col-sm-4 col-lg-2 py-2">
                            <label className="mb-04 text-small">ACMG Classification</label>
                            { acmgClassification ?
                                <div className="w-100 text-left">
                                    <i className="status-indicator-dot mr-1" data-status={acmgClassification}/>
                                    {acmgClassification}
                                </div>:
                                <div className="w-100 text-left text-truncate">{placeholderStatusIndicator}</div>}
                        </div>
                        <div className="col col-sm-8 col-lg-3 py-2">
                            <label className="mb-04 text-small">Discovery</label>
                            <div className="w-100 text-left">
                                <span className="font-italic text-muted" style={{ marginRight: "25px" }}>Gene: </span>
                                { geneCandidacy ?
                                    <span className="text-left">
                                        <i className="status-indicator-dot mr-1" data-status={geneCandidacy}/>
                                        {geneCandidacy}
                                    </span>: placeholderStatusIndicator}
                            </div>
                            <div className="text-left">
                                <span className="font-italic text-muted mr-1">Variant: </span>
                                { variantCandidacy ?
                                    <span className="w-100 text-left">
                                        <i className="status-indicator-dot mr-1" data-status={variantCandidacy}/>
                                        {variantCandidacy}
                                    </span>: placeholderStatusIndicator}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    });

    return (
        <React.Fragment>
            <h1 className="text-300">
                Interpretation
            </h1>
            <div>
                { renderedSections }
            </div>
        </React.Fragment>
    );
});
