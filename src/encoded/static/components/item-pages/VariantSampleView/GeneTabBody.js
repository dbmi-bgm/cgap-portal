'use strict';

import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import DropdownButton from 'react-bootstrap/esm/DropdownButton';
import DropdownItem from 'react-bootstrap/esm/DropdownItem';
import { console, schemaTransforms, object } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';

import { Schemas } from './../../util';
import { ExternalDatabasesSection } from './ExternalDatabasesSection';


/**
 * I feel like we can maybe re-use this as an overview tab for Gene ItemView eventually.
 * The only difference is instead of currentGeneItem, we'd get data from context. And there'd
 * be no currentGeneItemLoading.
 *
 * What we can do then is rename this component to "GeneOverview" or something and rename `currentGeneItem` to `context`
 * in this component and remove `currentGeneItemLoading` and logic re it. Then compose new component GeneTabBody
 * that simply does the currentGeneItemLoading logic or returns <GeneOverview context={currentGeneItem} />
 */
export function GeneTabBody(props){
    const { currentGeneItemLoading, currentGeneItem, context, schemas } = props;
    const fallbackElem = <em> - </em>;
    const {
        error               = null,
        '@id' : geneAtID    = null,
        name                = fallbackElem,
        gene_symbol         = null,
        gene_biotype        = fallbackElem,
        alias_symbol        = [],
        prev_symbol         = [],
        alias_name          = fallbackElem,
        gene_summary        = <em>No summary available</em>,
        chrom = null,
        spos = null,
        epos = null
    } = currentGeneItem;

    const getTipForField = useMemo(function(){
        if (!schemas) return function(){ return null; };
        // Helper func to basically just shorten `schemaTransforms.getSchemaProperty(field, schemas, itemType);`.
        return function(field, itemType = "Gene"){
            // Func is scoped within GeneTabBody (uses its 'schemas')
            const schemaProperty = schemaTransforms.getSchemaProperty(field, schemas, itemType);
            return (schemaProperty || {}).description || null;
        };
    }, [ schemas ]);

    if (currentGeneItemLoading) {
        return (
            <div className="gene-tab-body card-body py-5 text-center text-large">
                <i className="icon icon-spin fas icon-circle-notch" />
            </div>
        );
    }

    if (error || !geneAtID) {
        // It's possible yet unlikely there might be view permission error or something.
        // Actually yeah.. this shouldnt happen since won't have been able to get ID
        // to load this w anyway.. will remove.
        // Added 'if no gene id' case to loadGene in VariantSampleOverview which would leave
        // Gene tab disabled - might be worth to enable and show this value tho by setting
        // currentGeneItem to { error: "no view permissions" } (instd of leaving as null).
        return (
            <div className="gene-tab-body card-body py-5 text-center">
                <em>{ error || "Gene Item not available." }</em>
            </div>
        );
    }

    const aliasSymbolRendered = alias_symbol.length === 0 ? <em> - </em> : alias_symbol.join(", ");
    const prevSymbolRendered = prev_symbol.length === 0 ? <em> - </em> : prev_symbol.join(", ");

    const geneLocation = (
        (chrom? chrom : "") +
        ((epos || spos) && chrom ? ": " : "") +
        (spos || 'unknown') + "-" + (epos || 'unknown')
    );

    return (
        <div className="gene-tab-body card-body">
            <div className="row">
                <div className="col-12 col-lg-6 d-flex flex-column">

                    <div className="inner-card-section flex-grow-1 pb-2 pb-lg-0">
                        <div className="info-header-title">
                            <h4>Overview</h4>
                        </div>
                        <div className="info-body">

                            <div className="row mb-03">
                                <div className="col-12 col-xl-3">
                                    <label htmlFor="variant.transcript.csq_gene.name" className="mb-0" data-tip={getTipForField("name")}>
                                        Gene Name:
                                    </label>
                                </div>
                                <div className="col-12 col-xl-9" id="variant.transcript.csq_gene.name">
                                    { name }
                                </div>
                            </div>

                            <div className="row mb-03">
                                <div className="col-12 col-xl-3">
                                    <label htmlFor="variant.transcript.csq_gene.gene_symbol" className="mb-0" data-tip={getTipForField("gene_symbol")}>
                                        Symbol:
                                    </label>
                                </div>
                                <div className="col-12 col-xl-9" id="variant.transcript.csq_gene.gene_symbol">
                                    { gene_symbol }
                                </div>
                            </div>

                            <div className="row mb-03">
                                <div className="col-12 col-xl-3">
                                    <label htmlFor="variant.transcript.csq_gene.todo1" className="mb-0" data-tip={null}>
                                        Gene Location:
                                    </label>
                                </div>
                                <div className="col-12 col-xl-9" id="variant.transcript.csq_gene.todo1">
                                    { geneLocation }
                                </div>
                            </div>

                            <div className="row mb-03">
                                <div className="col-12 col-xl-3">
                                    <label htmlFor="variant.transcript.csq_gene.gene_biotype" className="mb-0" data-tip={getTipForField("gene_biotype")}>
                                        Gene Type:
                                    </label>
                                </div>
                                <div className="col-12 col-xl-9" id="variant.transcript.csq_gene.gene_biotype">
                                    { Schemas.Term.toName("gene_biotype", gene_biotype) }
                                </div>
                            </div>

                            <div className="row mb-03">
                                <div className="col-12 col-xl-3">
                                    <label htmlFor="variant.transcript.csq_gene.alias_symbol" className="mb-0" data-tip={null}>
                                        Alias Symbol:
                                    </label>
                                </div>
                                <div className="col-12 col-xl-9" id="variant.transcript.csq_gene.alias_symbol">
                                    { aliasSymbolRendered }
                                </div>
                            </div>

                            <div className="row mb-03">
                                <div className="col-12 col-xl-3">
                                    <label htmlFor="variant.transcript.csq_gene.prev_symbol" className="mb-0" data-tip={null}>
                                        Previous Symbol:
                                    </label>
                                </div>
                                <div className="col-12 col-xl-9" id="variant.transcript.csq_gene.prev_symbol">
                                    { prevSymbolRendered }
                                </div>
                            </div>

                            <div className="row mb-03">
                                <div className="col-12 col-xl-3">
                                    <label htmlFor="variant.transcript.csq_gene.todo3" className="mb-0" data-tip={null}>
                                        Alias Names:
                                    </label>
                                </div>
                                <div className="col-12 col-xl-9" id="variant.transcript.csq_gene.todo3">
                                    { alias_name }
                                </div>
                            </div>

                            <div className="row mb-03">
                                <div className="col-12 col-xl-3">
                                    <label htmlFor="variant.transcript.csq_gene.gene_summary" className="mb-0" data-tip={getTipForField("gene_summary")}>
                                        Gene Summary:
                                    </label>
                                </div>
                                <div className="col-12 col-xl-9" id="variant.transcript.csq_gene.gene_summary">
                                    { gene_summary }
                                </div>
                            </div>

                        </div>
                    </div>

                    {/* Won't be ready for some time -
                    <div className="flex-grow-0 pb-2 pb-md-0">
                        <div className="info-header-title">
                            <h4>Conditions</h4>
                        </div>
                        <div className="info-body">
                            TODO<br/>
                            TODO TODO<br/>
                            TODO TODO TODO
                        </div>
                    </div>
                    */}


                </div>
                <div className="col-12 col-lg-6 d-flex flex-column">

                    <div className="inner-card-section flex-grow-1 pb-2 pb-lg-1">
                        <div className="info-header-title">
                            <h4>External Databases</h4>
                        </div>
                        <div className="info-body">
                            {/* maybe Gene Resources sub-header here */}
                            <ExternalDatabasesSection {...{ schemas, currentGeneItem }} currentItem={currentGeneItem} />
                        </div>
                    </div>

                    <div className="inner-card-section flex-grow-0 pb-2 pb-lg-0">
                        <div className="info-header-title">
                            <h4>Constraint Scores</h4>
                        </div>
                        <div className="info-body">
                            <ConstraintScoresSection {...{ schemas, currentGeneItem, getTipForField }} />
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}



function ConstraintScoresSection({ currentGeneItem, getTipForField }){
    const fallbackNotPresent = <em data-tip="Not Available"> - </em>;
    const fallbackNotImplemented = <em data-tip="Not present or implemented"> &bull; </em>;
    const {
        exp_lof, exp_mis, exp_syn,
        obs_lof, obs_mis, obs_syn,
        oe_lof, oe_lof_lower = null, oe_lof_upper = null,
        oe_syn, oe_syn_lower = null, oe_syn_upper = null,
        oe_mis, oe_mis_lower =    0, oe_mis_upper = null,
        syn_z, mis_z, lof_z,
        s_het,
        rvis_exac
        // more todo
    } = currentGeneItem;
    return (
        <table className="w-100 text-left">
            <thead className="bg-transparent">
                <tr>
                    <th className="text-left">Constraint</th>
                    <th>Synonymous</th>
                    <th>Missense</th>
                    <th>LoF</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td className="text-600 text-left">Expected</td>
                    <td>
                        <span data-tip={getTipForField("exp_syn")}>{ exp_syn || fallbackNotPresent }</span>
                    </td>
                    <td>
                        <span data-tip={getTipForField("exp_mis")}>{ exp_mis || fallbackNotPresent }</span>
                    </td>
                    <td>
                        <span data-tip={getTipForField("exp_lof")}>{ exp_lof || fallbackNotPresent }</span>
                    </td>
                </tr>
                <tr>
                    <td className="text-600 text-left">Observed</td>
                    <td>
                        <span data-tip={getTipForField("obs_syn")}>{ obs_syn || fallbackNotPresent }</span>
                    </td>
                    <td>
                        <span data-tip={getTipForField("obs_mis")}>{ obs_mis || fallbackNotPresent }</span>
                    </td>
                    <td>
                        <span data-tip={getTipForField("obs_lof")}>{ obs_lof || fallbackNotPresent }</span>
                    </td>
                </tr>
                <tr>
                    <td className="text-600 text-left">O/E (range)</td>
                    <td>
                        <span data-tip={getTipForField("oe_syn")}>{ shortenToSignificantDigits(oe_syn) || fallbackNotPresent }</span>
                        { oe_syn_lower !== null && oe_syn_upper !== null ? ` (${oe_syn_lower} - ${oe_syn_upper})` : null }
                    </td>
                    <td>
                        <span data-tip={getTipForField("oe_mis")}>{ shortenToSignificantDigits(oe_mis) || fallbackNotPresent }</span>
                        { oe_mis_lower !== null && oe_mis_upper !== null ? ` (${oe_mis_lower} - ${oe_mis_upper})` : null }
                    </td>
                    <td>
                        <span data-tip={getTipForField("oe_lof")}>{ shortenToSignificantDigits(oe_lof) || fallbackNotPresent }</span>
                        { oe_lof_lower !== null && oe_lof_upper !== null ? ` (${oe_lof_lower} - ${oe_lof_upper})` : null }
                    </td>
                </tr>
                <tr>
                    <td className="text-600 text-left">Z-score</td>
                    <td>
                        <span data-tip={getTipForField("syn_z")}>{ shortenToSignificantDigits(syn_z) || fallbackNotPresent }</span>
                    </td>
                    <td>
                        <span data-tip={getTipForField("mis_z")}>{ shortenToSignificantDigits(mis_z) || fallbackNotPresent }</span>
                    </td>
                    <td>
                        <span data-tip={getTipForField("lof_z")}>{ shortenToSignificantDigits(lof_z) || fallbackNotPresent }</span>
                    </td>
                </tr>
                <tr>
                    <td className="text-600 text-left">LOEUF</td>
                    <td>{ fallbackNotImplemented }</td>
                    <td>{ fallbackNotImplemented }</td>
                    <td>
                        <span data-tip={getTipForField("oe_lof_upper")}>{ oe_lof_upper || fallbackNotPresent }</span>
                    </td>
                </tr>
                <tr>
                    <td className="text-600 text-left">S-Het</td>
                    <td>{ fallbackNotImplemented }</td>
                    <td>
                        <span data-tip={getTipForField("s_het")}>{ shortenToSignificantDigits(s_het) || fallbackNotPresent }</span>
                    </td>
                    <td>{ fallbackNotImplemented }</td>
                </tr>
                <tr>
                    <td className="text-600 text-left">RVIS (ExAC)</td>
                    <td>{ fallbackNotImplemented }</td>
                    <td>
                        <span data-tip={getTipForField("rvis_exac")}>{ shortenToSignificantDigits(rvis_exac) || fallbackNotPresent }</span>
                    </td>
                    <td>{ fallbackNotImplemented }</td>
                </tr>
            </tbody>
        </table>
    );
}

/**
 * @todo Move into shared-portal-components > util > valueTransforms ?
 * @todo Maybe, if to be reused:
 *   Handle & abbreviate large numbers using 'M', 'B', 'T' maybe?
 *   We have `valueTransforms.roundLargeNumber(num, decimalPlaces = 2)` function already which can just be re-used if we paramaterize its `numberLevels`.
 *       (currently: `['', 'k', 'm', ' billion', ' trillion', ' quadrillion', ' quintillion']`)
 */
function shortenToSignificantDigits(numberToShorten, countDigits = 3) {

    if (!numberToShorten) {
        // Pass through falsy values such as "0" (doesnt need shortening) or null, false, undefined.
        return numberToShorten;
    }

    if (typeof numberToShorten !== "number" || isNaN(numberToShorten)) {
        throw new Error("Expected well-formed number (or falsy value).");
    }

    if (numberToShorten >= Math.pow(10, countDigits - 1)) {
        // todo: handle later
        return "" + Math.round(numberToShorten);
    }

    return numberToShorten.toPrecision(countDigits);
}
