'use strict';

import React, { useMemo } from 'react';
import queryString from 'query-string';
import moment from 'moment';
import memoize from 'memoize-one';
import _ from 'underscore';
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
    const { variant_samples: vsSelections = [], actions = [] } = variantSampleListItem;

    let renderedSections;

    const hasViewPermission = memoize(function hasViewPermission(arr) {
        return _.findWhere((arr), { "name": "view" });
    });

    // Not currently in use, but may be useful once we add actions (remove from variantsample list, etc.)
    const hasEditPermission = memoize(function hasViewPermission(arr) {
        return _.findWhere((arr), { "name": "view" });
    });

    let numWithoutPermissions;

    if (!hasViewPermission(actions)) {
        renderedSections = <div>Sorry, you lack permission to view this variant sample list.</div>;
    } else {
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

        // Ensure only the variants the user has permission to view are visible
        const filteredSelections = vsSelections.filter((selection) => {
            const { variant_sample_item } = selection;
            const { "@id": vsID, actions = [] } = variant_sample_item;

            if (vsID && hasViewPermission(actions)) {
                return true;
            }
            return false;
        });

        numWithoutPermissions = vsSelections.length - filteredSelections.length;

        renderedSections = filteredSelections.map(function(sel, idx){
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

                            <div className="flex-grow-1 d-flex flex-column flex-sm-row">
                                <div className="flex-auto">
                                    <VariantSampleDisplayTitleColumn result={variant_sample_item}
                                        link={`${vsID}?showInterpretation=True${caseAccession ? '&caseSource=' + caseAccession : ''}`} />
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
                            <div className="col col-sm-4 col-lg-3 py-2">
                                <label className="mb-04 text-small" data-tip={geneTranscriptColDescription}>
                                    { geneTranscriptColTitle || "Gene, Transcript" }
                                </label>
                                { geneTranscriptRenderFunc(variant_sample_item, { align: 'left', link: vsID + '?showInterpretation=True&annotationTab=0&interpretationTab=Gene%20Notes' + (caseAccession ? '&caseSource=' + caseAccession : '') }) }
                            </div>
                            <div className="col col-sm-4 col-lg-3 py-2">
                                <label className="mb-04 text-small" data-tip={variantColDescription}>
                                    { variantColTitle || "Variant" }
                                </label>
                                { variantRenderFunc(variant_sample_item, { align: 'left', link: vsID + '?showInterpretation=True&annotationTab=1' + (caseAccession ? '&caseSource=' + caseAccession : '') }) }
                            </div>
                            <div className="col col-sm-4 col-lg-3 py-2">
                                <label className="mb-04 text-small" data-tip={genotypeLabelColDescription}>
                                    { genotypeLabelColTitle || "Genotype" }
                                </label>
                                { genotypeLabelRenderFunc(variant_sample_item, { align: 'left' }) }
                            </div>
                            <div className="col col-sm-12 col-lg-3 py-2">
                                <label className="mb-04 text-small">Interpretation</label>
                                <div className="w-100 text-left text-muted">Pending</div>
                            </div>
                        </div>
                    </div>
                </div>
            );
        });
    }

    return (
        <React.Fragment>
            <h1 className="text-300">
                Interpretation
            </h1>
            <div>
                { renderedSections }
            </div>
            { numWithoutPermissions ? <div className="ml-2">+{numWithoutPermissions} Variant Sample(s) without View Permissions</div>: null }
        </React.Fragment>
    );
});
