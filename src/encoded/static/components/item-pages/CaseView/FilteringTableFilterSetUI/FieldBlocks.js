'use strict';

import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import queryString from 'query-string';

import { console } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { getSchemaProperty } from '@hms-dbmi-bgm/shared-portal-components/es/components/util/schema-transforms';
import { FormattedToFromRangeValue } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/FacetList/RangeFacet';

import { Schemas } from '../../../util';

/**
 * Block containing list of fields and the terms (or ranges) which
 * are set in the passed-in `props.filterBlock`.
 *
 * @todo
 * If we are to re-use this in InterpretationTab, should use this component,
 * as we don't need the FilterBlock's title (or at least ability to edit it,
 * nor ability/icon delete the FilterBlock).
 */
export const FieldBlocks = React.memo(function FieldBlocks({ filterBlock, facetDict, schemas }) {
    const { query: filterStrQuery } = filterBlock;

    if (!filterStrQuery) {
        return (
            <div className="py-1 px-2">
                <em>No Filters Selected</em>
            </div>
        );
    }

    // Parse from and to range values, sort.
    const { correctedQuery, sortedFields, fieldSchemas } = useMemo(function(){

        const origQs = queryString.parse(filterStrQuery);

        const termQs = {};
        // Will fill this with `{ field: { from, to } }` and create combined items for them afterwards.
        const rangeQs = {};

        Object.keys(origQs).forEach(function(k){

            // Remove .from or .to if needed, confirm aggregation_type === stats, and transform/merge values
            let field = k;
            let v = origQs[k];

            let removedRangeFacetAppendage = false;
            if (k.slice(-5) === ".from"){
                field = k.slice(0, -5);
                if (!facetDict[field] || typeof facetDict[field].aggregation_type !== "string"){
                    // We might remove check of aggregation_type here since might not be present if being gotten from schemas.
                    // Becomes slightly risky, if there's embedded linkto with field 'from' or 'to'.
                    field = k;
                    console.error("Attempted to remove 'from' from field but couldn't succeed", field, facetDict);
                } else {
                    removedRangeFacetAppendage = true;
                    rangeQs[field] = rangeQs[field] || {};
                    rangeQs[field].from = v;
                }

            } else if (k.slice(-3) === ".to") {
                field = k.slice(0, -3);
                if (!facetDict[field] || typeof facetDict[field].aggregation_type !== "string"){
                    // We might remove check of aggregation_type here since might not be present if being gotten from schemas.
                    // Becomes slightly risky, if there's embedded linkto with field 'from' or 'to'.
                    field = k;
                    console.error("Attempted to remove 'to' from field but couldn't succeed", field, facetDict);
                } else {
                    removedRangeFacetAppendage = true;
                    rangeQs[field] = rangeQs[field] || {};
                    rangeQs[field].to = v;
                }
            }

            if (removedRangeFacetAppendage) {
                return;
            }


            // Standardize term values of the parsed query object into arrays (including w. length=1).
            if (!Array.isArray(v)) {
                v = [v];
            }
            // If not range facet, transform vals to proper names.
            // (formatRangeVal will do same if necessary)
            v = v.map(function(termVal){
                // Special case for 'q' (free text search field)
                if (field === "q") {
                    return "\"" + termVal + "\"";
                }
                return Schemas.Term.toName(field, termVal);
            });

            // Merge, e.g. if a from and a to
            if (typeof termQs[field] !== "undefined") {
                termQs[field] = termQs[field].concat(v);
            } else {
                termQs[field] = v;
            }

        });


        // TODO: Consider moving this up to where facetDict is created, but would be
        // bit more complexy to memoize well (and need to ensure removal of .from and .to for ranges).
        const allFieldSchemas = {};

        // Transform rangeQs numbers into values.
        Object.keys(rangeQs).forEach(function(field){
            const { from = null, to = null } = rangeQs[field];
            const fieldSchema = allFieldSchemas[field] = getSchemaProperty(field, schemas, "VariantSample");
            const facet = facetDict[field];
            const { title: facetTitle, abbreviation: facetAbbreviation = null } = facet;
            const { abbreviation: fieldAbbreviation = null } = fieldSchema || {};
            const title = facetAbbreviation || fieldAbbreviation || (facetTitle.length > 5 ? <em>N</em> : facetTitle);
            rangeQs[field] = [
                <FormattedToFromRangeValue {...{ from, to, facet, title }} termTransformFxn={Schemas.Term.toName} key={0} />
            ];
        });

        // Get rest of field schemas for term facets
        const termFields = Object.keys(termQs);
        termFields.forEach(function(field){
            allFieldSchemas[field] = getSchemaProperty(field, schemas, "VariantSample");
        });

        // Combine & sort all filtered-on fields by their schema.facet.order, if any.
        const sortedFields = termFields.concat(Object.keys(rangeQs)).sort(function(fA, fB){
            const fsA = facetDict[fA];
            const fsB = facetDict[fB];
            if (fsA && !fsB) return -1;
            if (!fsA && fsB) return 1;
            if (!fsA && !fsB) return 0;
            return (fsA.order || 10000) - (fsB.order || 10000);
        });

        return {
            sortedFields,
            "fieldSchemas": allFieldSchemas,
            "correctedQuery" : { ...termQs, ...rangeQs }
        };
    }, [ filterBlock, facetDict, schemas ]);

    return (
        <div className="d-flex flex-wrap filter-query-viz-blocks px-2">
            { sortedFields.map(function(field, index){
                return <FieldBlock {...{ field }} fieldFacet={facetDict[field]} fieldSchema={fieldSchemas[field]} terms={correctedQuery[field]} key={field} />;
            }) }
        </div>
    );
});



/** A single field and its values/terms */
function FieldBlock({ field, terms, fieldFacet, fieldSchema }){
    const {
        title: facetTitle = null,
        // description: facetDescription = null,
        // aggregation_type = "terms"
    } = fieldFacet || {};

    const {
        // Used primarily as fallback, we expect/hope for fieldFacet to be present/used primarily instead.
        title: fieldTitle = null,
        // description: fieldDescription = null
    } = fieldSchema || {};

    const title = facetTitle || fieldTitle || field;

    const valueBlocks = terms.map(function(val, idx){
        return (
            <div className="value-block" key={idx}>
                { val }
            </div>
        );
    });

    return (
        <div className="field-block py-1">
            <div className="value-blocks d-flex flex-wrap">
                { valueBlocks }
            </div>
            <div className="field-name">
                <em>{ title }</em>
            </div>
        </div>
    );
}