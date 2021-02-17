'use strict';

import React, { useMemo } from 'react';
import queryString from 'query-string';
import moment from 'moment';
import { LocalizedTime } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/LocalizedTime';
import { variantSampleAdditionalColumnExtensionMap, VariantSampleDisplayTitleColumn } from './CaseViewEmbeddedVariantSampleSearchTable';

/**
 * For now, we just re-use the column render func from some VariantSample columns
 * as value 'cells' of this card.
 */
const {
    "DP": { render: dpRenderFunc },
    "associated_genotype_labels.proband_genotype_label": { render: genotypeLabelRenderFunc },
    "variant.genes.genes_most_severe_gene.display_title": { render: geneTranscriptRenderFunc },
    "variant.genes.genes_most_severe_hgvsc": { render: variantRenderFunc },
} = variantSampleAdditionalColumnExtensionMap;


export const InterpretationTab = React.memo(function InterpretationTab (props) {
    const { variantSampleListItem, schemas } = props;
    const { variant_samples: vsSelections = [] } = variantSampleListItem;

    const {
        "VariantSample": {
            columns: {
                "DP": {
                    title: dpColTitle,
                    description: dpColDescription
                } = {},
                "associated_genotype_labels.proband_genotype_label": {
                    title: genotypeLabelColTitle,
                    description: genotypeLabelColDescription
                } = {},
                "variant.genes.genes_most_severe_gene.display_title": {
                    title: geneTranscriptColTitle,
                    description: geneTranscriptColDescription
                } = {},
                "variant.genes.genes_most_severe_hgvsc": {
                    title: variantColTitle,
                    description: variantColDescription
                } = {}
            } = {}
        } = {}
    } = schemas || {};

    const renderedSections = vsSelections.map(function(sel, idx){
        const {
            date_selected,
            filter_blocks_request_at_time_of_selection,
            variant_sample_item
        } = sel;
        const { "@id": vsID } = variant_sample_item;
        return (
            <div className="card mb-1" key={idx}>
                <div className="card-header">
                    <div className="d-flex align-items-center">
                        <div className="flex-auto">
                            <VariantSampleDisplayTitleColumn result={variant_sample_item} link={vsID} />
                        </div>
                        <div className="flex-grow-1">
                            &nbsp;
                        </div>
                        <div className="flex-auto text-secondary text-small" data-tip="Date Selected">
                            <i className="icon icon-calendar far mr-07"/>
                            <LocalizedTime timestamp={date_selected} formatType="date-time-sm" />
                        </div>
                        <div className="flex-auto pl-3">
                            <i className="icon icon-ellipsis-v fas"/>
                        </div>
                    </div>
                </div>
                <div className="card-body pt-0">
                    <div className="row flex-column flex-sm-row">
                        <div className="col col-sm-5 col-lg-2" data-field="DP">
                            <label className="mb-04 mt-08 text-small" data-tip={dpColDescription}>
                                { dpColTitle || "Coverage, VAF" }
                            </label>
                            { dpRenderFunc(variant_sample_item) }
                        </div>
                        <div className="col col-sm-7 col-lg-3">
                            <label className="mb-04 mt-08 text-small" data-tip={genotypeLabelColDescription}>
                                { genotypeLabelColTitle || "Genotype" }
                            </label>
                            { genotypeLabelRenderFunc(variant_sample_item) }
                        </div>
                        <div className="col col-sm-5 col-lg-2">
                            <label className="mb-04 mt-08 text-small" data-tip={geneTranscriptColDescription}>
                                { geneTranscriptColTitle || "Gene, Transcript" }
                            </label>
                            { geneTranscriptRenderFunc(variant_sample_item) }
                        </div>
                        <div className="col col-sm-7 col-lg-2">
                            <label className="mb-04 mt-08 text-small" data-tip={variantColDescription}>
                                { variantColTitle || "Variant" }
                            </label>
                            { variantRenderFunc(variant_sample_item) }
                        </div>
                        <div className="col col-sm-12 col-lg-3">
                            <label className="mb-04 mt-08 text-small">Interpretation</label>
                            <div><em>TODO</em></div>
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
