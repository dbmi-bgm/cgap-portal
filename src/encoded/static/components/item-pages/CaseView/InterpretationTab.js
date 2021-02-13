'use strict';

import React, { useMemo } from 'react';
import queryString from 'query-string';
import moment from 'moment';
import { variantSampleAdditionalColumnExtensionMap, VariantSampleDisplayTitleColumn } from './CaseViewEmbeddedVariantSampleSearchTable';

/**
 * For now, we just re-use the column render func from some VariantSample columns
 * as value 'cells' of this card.
 */
const {
    "DP": { render: dpRenderFunc },
    "associated_genotype_labels.proband_genotype_label": { render: genotypeLabelRenderFunc },
    "variant.genes.genes_most_severe_gene.display_title" : { render: geneTranscriptRenderFunc }
} = variantSampleAdditionalColumnExtensionMap;


export function InterpretationTab (props) {
    const { variantSampleListItem, schemas } = props;
    const { variant_samples: vsSelections = [] } = variantSampleListItem;

    // Not used yet
    // const {
    //     "VariantSample": { properties: {
    //         "DP" : dpFieldSchema
    //     } = {} } = {}
    // } = schemas || {};

    // // Not used yet
    // const getSchemaForField = useMemo(function(){
    //     if (!schemas) return function(){ return null; };
    //     // Helper func to basically just shorten `schemaTransforms.getSchemaProperty(field, schemas, itemType);`.
    //     return function(field, itemType = "VariantSample"){
    //         // Func is scoped within GeneTabBody (uses its 'schemas')
    //         const schemaProperty = schemaTransforms.getSchemaProperty(field, schemas, itemType);
    //         return (schemaProperty || {}).description || null;
    //     };
    // }, [ schemas ]);

    const renderedSections = vsSelections.map(function(sel, idx){
        const {
            date_selected,
            filter_blocks_request_at_time_of_selection,
            variant_sample_item
        } = sel;
        // const {} = variant_sample_item;
        return (
            <div className="card mb-1" key={idx}>
                <div className="card-header">
                    <VariantSampleDisplayTitleColumn result={variant_sample_item} />
                </div>
                <div className="card-body p-2">
                    <div className="row">
                        <div className="col" data-field="DP">
                            <label className="mb-03 small">Coverage, VAF</label>
                            { dpRenderFunc(variant_sample_item) }
                        </div>
                        <div className="col">
                            <label className="mb-03 small">Genotype</label>
                            { genotypeLabelRenderFunc(variant_sample_item) }
                        </div>
                        <div className="col">
                            <label className="mb-03 small">Gene, Transcript</label>
                            { geneTranscriptRenderFunc(variant_sample_item) }
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
}
