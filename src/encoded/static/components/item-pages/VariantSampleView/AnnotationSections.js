'use strict';

import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import DropdownButton from 'react-bootstrap/esm/DropdownButton';
import DropdownItem from 'react-bootstrap/esm/DropdownItem';

import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';

import { layout, ajax, console, schemaTransforms, object } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Schemas } from './../../util';
import { LocalizedTime } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/LocalizedTime';
import QuickPopover from '../components/QuickPopover';

/**
 * Shared components between VariantSample and StructuralVariantSample item pages
 */

/**
 * Re-useable for any object, given a list of `externalDatabaseFieldnames` and a `currentItem`.
 * `currentItem` may be a composite object of values, as long as aligns with schema, so may clone a
 * `currentItem` or `context` or something and filter down some [{},{},{}] property value into [{}] to
 * narrow down values shown here.
 */
export const ExternalDatabasesSection = React.memo(function ExternalDatabasesSection(props){
    const {
        currentItem,
        schemas = null,
        itemType = "Gene",

        // IN FUTURE WE (likely) WON'T HAVE THIS LIST
        // AND INSTEAD GATHER THE PROPERTIES FROM SCHEMA
        // ACCORDING TO PERHAPS "annotation_category" :"dbxref"

        externalDatabaseFieldnames = [
            "genecards",
            "medline_plus",
            "gencc",
            "ensgid",
            "entrez_id",
            "hgnc_id",
            // "ccds_id", - duplicate/excluded
            "genereviews",
            // "transcriptid.ensembl_pro", // removed for now - (duplicate?), maybe todo/include later when can handle generic sub-objs
            "uniprot_ids",
            "pdb",
            "mgi_id",
            "marrvel",
            "omim_id",
            "orphanet",
            // "trait_association_gwas_pmid", // removed for now - will handle later as special case (sub-emb objects w. titles)
            "clingen",
            "pharmgkb",
            "gtex_expression",
            "brainspan_microarray",
            "brainspan_rnaseq",
            "brainatlas_microarray",
            "biogrid",
            "string",
            "hgmd_id"
            // "gene_symbol", - duplicate/excluded
            // "refseq_accession", - duplicate/excluded
            // "clingendis.disease_id", // removed for now ('user can find through clingen')
            // "transcriptid.ensembl_trs", // removed for now
            // "gnomad" // removed for now
        ],
        prependItems = [],
        appendItems = []
    } = props;

    if (!schemas) {
        return (
            <div className="text-secondary d-flex align-items-center justify-content-center h-100 pb-12 text-larger pb-08">
                <i className="icon icon-spin icon-circle-notch fas" />
            </div>
        );
    }

    const externalDatabaseSchemaFields = externalDatabaseFieldnames.map(function(fieldName){
        let propertySchema = schemaTransforms.getSchemaProperty(fieldName, schemas, itemType);
        // (Might change in future:) We get .items from this if array field since link & such defined in it.
        if (propertySchema && propertySchema.items) {
            propertySchema = propertySchema.items;
        }
        return [
            fieldName,
            propertySchema
        ];
    }).filter(function(f){
        // Filter out fields which don't exist in schema yet.
        // Or for which we can't form links for.
        return !!(
            f[1] &&
            (f[1].link || (f[1].items && f[1].items.link))
        );
    });

    let externalDatabaseElems = externalDatabaseSchemaFields.map(function([ fieldName, fieldSchema ]){
        const {
            link: linkFormat = null,
            title: schemaTitle = null,
            description: schemaDescription = null
        } = fieldSchema;

        let externalIDs = object.getNestedProperty(currentItem, fieldName); // currentItem[fieldName];

        // Value could be '0' or boolean or similar. Could also be [null] or [undefined] (handled below).
        if (!Array.isArray(externalIDs)) {
            externalIDs = [ externalIDs ];
        }

        externalIDs = externalIDs.filter(function(externalID){
            return typeof externalID !== "undefined" && externalID !== null;
        });

        const extIDsLen = externalIDs.length;


        // if (!externalID) {
        //     return null;
        // }

        let val;

        if (extIDsLen === 0) {
            val = <em data-tip="Not Available" className="px-1"> - </em>;
        } else if (extIDsLen < 5) {
            // Newline for each
            val = externalIDs.map(function(externalID){
                const linkToID = linkFormat.replace("<ID>", externalID);
                return (
                    <a href={linkToID} className="d-block" target="_blank" rel="noopener noreferrer" id={"external_resource_for_" + fieldName} key={externalID}>
                        <span className="align-middle">{ externalID }</span>
                        <i className="ml-05 icon icon-fw icon-external-link-alt fas text-smaller text-secondary" />
                    </a>
                );
            });
        } else {
            // Same line, comma, count instd of titles for subsequents.
            val = externalIDs.map(function(externalID, index){
                const linkToID = linkFormat.replace("<ID>", externalID);
                const title = index === 0 ? externalID : `(${index + 1})`;
                return (
                    <React.Fragment key={externalID}>
                        <a href={linkToID} target="_blank" rel="noopener noreferrer" id={"external_resource_for_" + fieldName}
                            data-tip={index === 0 ? null : externalID} className="align-middle">
                            { title }
                        </a>
                        { index === extIDsLen - 1 ?
                            <i className="ml-05 icon icon-fw icon-external-link-alt fas text-smaller text-secondary" />
                            : (index === 0 ? " + " : " ") }
                    </React.Fragment>
                );
            });
        }

        return (
            <div className="row mb-03" key={fieldName}>
                <div className="col-12 col-lg">
                    <label className="mb-0 black-label" htmlFor={"external_resource_for_" + fieldName}>
                        { schemaTitle || fieldName }
                        { schemaDescription ? <i className="icon icon-info-circle fas icon-fw ml-02 icon-sm"
                            data-tip={schemaDescription} /> : null}
                    </label>
                </div>
                <div className="col-12 col-lg-auto">
                    { val }
                </div>
            </div>
        );
    });

    // Merge with any custom-rendered items.
    externalDatabaseElems = prependItems.concat(externalDatabaseElems).concat(appendItems);

    const externalDatabaseElemsLen = externalDatabaseElems.length;
    if (externalDatabaseElemsLen === 0) {
        return <h4 className="text-center font-italic text-400 my-0 pb-08">No External Databases</h4>;
    } else if (externalDatabaseElemsLen >= 4) {
        const mp = Math.ceil(externalDatabaseElemsLen / 2);
        const col1 = externalDatabaseElems.slice(0, mp);
        const col2 = externalDatabaseElems.slice(mp);
        return (
            <div className="row">
                <div className="col-12 col-xl-6">
                    { col1 }
                </div>
                <div className="col-12 col-xl-6">
                    { col2 }
                </div>
            </div>
        );
    } else {
        return externalDatabaseElems;
    }

});



export const GeneOverview = React.memo(function GeneOverview(props) {
    const { currentGeneItem, getTipForField, fallbackElem } = props;
    const {
        name                = fallbackElem,
        gene_symbol         = null,
        gene_biotype        = fallbackElem,
        alias_symbol        = [],
        prev_symbol         = [],
        alias_name          = fallbackElem,
        gene_summary        = <em>No summary available</em>,
        chrom = null,
        start_display = null,
        end_display = null
    } = currentGeneItem || {};


    const aliasSymbolRendered = alias_symbol.length === 0 ? <em> - </em> : alias_symbol.join(", ");
    const prevSymbolRendered = prev_symbol.length === 0 ? <em> - </em> : prev_symbol.join(", ");

    const geneLocation = (
        (chrom ? chrom : "") +
        ((end_display || start_display) && chrom ? ": " : "") +
        (start_display || 'unknown') + "-" + (end_display || 'unknown')
    );

    return (
        <React.Fragment>
            <div className="row mb-03">
                <div className="col-12 col-xl-3">
                    <label htmlFor="variant.transcript.csq_gene.name" className="mb-0">
                        Gene Name: <i className="icon icon-info-circle fas icon-fw ml-02 icon-sm"
                            data-tip={getTipForField("name")}/>
                    </label>
                </div>
                <div className="col-12 col-xl-9" id="variant.transcript.csq_gene.name">
                    { name }
                </div>
            </div>

            <div className="row mb-03">
                <div className="col-12 col-xl-3">
                    <label htmlFor="variant.transcript.csq_gene.gene_symbol" className="mb-0" >
                        Symbol: <i className="icon icon-info-circle fas icon-fw ml-02 icon-sm"
                            data-tip={getTipForField("gene_symbol")}/>
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
                    <label htmlFor="variant.transcript.csq_gene.gene_biotype" className="mb-0">
                        Gene Type: <i className="icon icon-info-circle fas icon-fw ml-02 icon-sm"
                            data-tip={getTipForField("gene_biotype")} />
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
                    <label htmlFor="variant.transcript.csq_gene.gene_summary" className="mb-0">
                        Gene Summary: <i className="icon icon-info-circle fas icon-fw ml-02 icon-sm"
                            data-tip={getTipForField("gene_summary")}/>
                    </label>
                </div>
                <div className="col-12 col-xl-9" id="variant.transcript.csq_gene.gene_summary">
                    { gene_summary }
                </div>
            </div>
        </React.Fragment>
    );
});


export const ConstraintScoresSection = React.memo(function ConstraintScoresSection({ currentGeneItem, getTipForField }) {
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
                    <th>
                        Synonymous
                        <span data-tip="Score as applied to synonymous variants only. A dot (•) indicates the score is not applicable to synonymous variants.">
                            <i className="icon icon-info-circle fas ml-03"/>
                        </span>
                    </th>
                    <th>
                        Missense
                        <span data-tip="Score as applied to missense variants only. A dot (•) indicates the score is not applicable to missense variants.">
                            <i className="icon icon-info-circle fas ml-03"/>
                        </span>
                    </th>
                    <th>
                        LoF
                        <span data-tip="Score as applied to loss-of-function variants only. A dot (•) indicates the score is not applicable to LoF variants.">
                            <i className="icon icon-info-circle fas ml-03"/>
                        </span>
                    </th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td className="text-600 text-left">
                        Expected
                        <QuickPopover popID="gene_exp" className="p-0 icon-sm ml-02">{genePopoverContents.expected}</QuickPopover>
                    </td>
                    <td>
                        <span data-tip={getTipForField("exp_syn")}>{ falsyZeroCheck(exp_syn, fallbackNotPresent)}</span>
                    </td>
                    <td>
                        <span data-tip={getTipForField("exp_mis")}>{ falsyZeroCheck(exp_mis, fallbackNotPresent)}</span>
                    </td>
                    <td>
                        <span data-tip={getTipForField("exp_lof")}>{ falsyZeroCheck(exp_lof, fallbackNotPresent)}</span>
                    </td>
                </tr>
                <tr>
                    <td className="text-600 text-left">
                        Observed
                        <QuickPopover popID="gene_obs" className="p-0 icon-sm ml-02">{genePopoverContents.observed}</QuickPopover>
                    </td>
                    <td>
                        <span data-tip={getTipForField("obs_syn")}>{ falsyZeroCheck(obs_syn, fallbackNotPresent)}</span>
                    </td>
                    <td>
                        <span data-tip={getTipForField("obs_mis")}>{ falsyZeroCheck(obs_mis, fallbackNotPresent)}</span>
                    </td>
                    <td>
                        <span data-tip={getTipForField("obs_lof")}>{ falsyZeroCheck(obs_lof, fallbackNotPresent)}</span>
                    </td>
                </tr>
                <tr>
                    <td className="text-600 text-left">
                        O/E (range)
                        <QuickPopover popID="gene_oerange" className="p-0 icon-sm ml-02">{genePopoverContents.oerange}</QuickPopover>
                    </td>
                    <td>
                        <span data-tip={getTipForField("oe_syn")}>{ falsyZeroCheck(shortenToSignificantDigits(oe_syn), fallbackNotPresent)}</span>
                        { oe_syn_lower !== null && oe_syn_upper !== null ? ` (${oe_syn_lower} - ${oe_syn_upper})` : null }
                    </td>
                    <td>
                        <span data-tip={getTipForField("oe_mis")}>{ falsyZeroCheck(shortenToSignificantDigits(oe_mis), fallbackNotPresent)}</span>
                        { oe_mis_lower !== null && oe_mis_upper !== null ? ` (${oe_mis_lower} - ${oe_mis_upper})` : null }
                    </td>
                    <td>
                        <span data-tip={getTipForField("oe_lof")}>{ falsyZeroCheck(shortenToSignificantDigits(oe_lof), fallbackNotPresent)}</span>
                        { oe_lof_lower !== null && oe_lof_upper !== null ? ` (${oe_lof_lower} - ${oe_lof_upper})` : null }
                    </td>
                </tr>
                <tr>
                    <td className="text-600 text-left">
                        Z-score
                        <QuickPopover popID="gene_zscore" className="p-0 icon-sm ml-02">{genePopoverContents.zscore}</QuickPopover>
                    </td>
                    <td>
                        <span data-tip={getTipForField("syn_z")}>{ falsyZeroCheck(shortenToSignificantDigits(syn_z), fallbackNotPresent)}</span>
                    </td>
                    <td>
                        <span data-tip={getTipForField("mis_z")}>{ falsyZeroCheck(shortenToSignificantDigits(mis_z), fallbackNotPresent)}</span>
                    </td>
                    <td>
                        <span data-tip={getTipForField("lof_z")}>{ falsyZeroCheck(shortenToSignificantDigits(lof_z), fallbackNotPresent)}</span>
                    </td>
                </tr>
                <tr>
                    <td className="text-600 text-left">
                        LOEUF
                        <QuickPopover popID="gene_loeuf" className="p-0 icon-sm ml-02">{genePopoverContents.loeuf}</QuickPopover>
                    </td>
                    <td>{ fallbackNotImplemented }</td>
                    <td>{ fallbackNotImplemented }</td>
                    <td>
                        <span data-tip={getTipForField("oe_lof_upper")}>{ falsyZeroCheck(oe_lof_upper, fallbackNotPresent)}</span>
                    </td>
                </tr>
                <tr>
                    <td className="text-600 text-left">
                        S-Het
                        <QuickPopover popID="gene_shet" className="p-0 icon-sm ml-02">{genePopoverContents.shet}</QuickPopover>
                    </td>
                    <td>{ fallbackNotImplemented }</td>
                    <td>{ fallbackNotImplemented }</td>
                    <td>
                        <span data-tip={getTipForField("s_het")}>{ falsyZeroCheck(shortenToSignificantDigits(s_het), fallbackNotPresent)}</span>
                    </td>
                </tr>
                <tr>
                    <td className="text-600 text-left">
                        RVIS (ExAC)
                        <QuickPopover popID="gene_rvis" className="p-0 icon-sm ml-02">{genePopoverContents.rvis}</QuickPopover>
                    </td>
                    <td>{ fallbackNotImplemented }</td>
                    <td>
                        <span data-tip={getTipForField("rvis_exac")}>{ falsyZeroCheck(shortenToSignificantDigits(rvis_exac), fallbackNotPresent)}</span>
                    </td>
                    <td>{ fallbackNotImplemented }</td>
                </tr>
            </tbody>
        </table>
    );
});

/**
 * Takes in a potentially falsy (0) string or number value and if actually not present, returns fallback
 */
export function falsyZeroCheck(value, fallback) {
    if (value || value === "0" || value === 0) {
        return value;
    }
    return fallback;
}

/**
 * @todo Move into shared-portal-components > util > valueTransforms ?
 * @todo Maybe, if to be reused:
 *   Handle & abbreviate large numbers using 'M', 'B', 'T' maybe?
 *   We have `valueTransforms.roundLargeNumber(num, decimalPlaces = 2)` function already which can just be re-used if we paramaterize its `numberLevels`.
 *       (currently: `['', 'k', 'm', ' billion', ' trillion', ' quadrillion', ' quintillion']`)
 */
export function shortenToSignificantDigits(numberToShorten, countDigits = 3) {

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

// TODO: Potentially more work and more testing needed to modularize
export function ClinVarSection({ context, getTipForField, schemas, clinvarExternalHref, currentClinVarResponse }){
    const { variant = null, structural_variant = null } = context;
    const {
        csq_clinvar: variationID,
        csq_clinvar_clnsig: clinicalSignificanceFromVariant,
        csq_clinvar_clnsigconf: conflictingClinicalSignificance,
        clinvar_submission = [], // TODO - missing in data rn.
        csq_clinvar_clnrevstat: reviewStatusFromVariant,
        POS,
        CHROM
    } = variant || structural_variant;


    const clinvarVariantSearchUrl = useMemo(function(){
        if (!CHROM && !POS) {
            return null;
        }
        let chromosome = CHROM;
        chromosome = chromosome.toLowerCase();
        if (chromosome === "m"){
            chromosome = "mt";
        }
        return `https://www.ncbi.nlm.nih.gov/clinvar?term=((${chromosome}[Chromosome]) AND ${POS}[Base Position])`;
    }, [ variant || structural_variant ]);



    const { result: { [variationID]: clinVarResult } = {} } = currentClinVarResponse || {};
    const {
        clinical_significance: {
            description: clinicalSignificanceFromClinVar,
            review_status: reviewStatusFromClinVar,
            last_evaluated: lastEvaluatedFromClinVarRaw
        } = {}
    } = clinVarResult || {};

    // Ensure that the date is valid by running through date parser
    const lastEvaluatedFromClinVar = Date.parse(new Date(lastEvaluatedFromClinVarRaw));

    const externalLinkIconAppend = <i className="icon icon-external-link-alt fas ml-07 text-smaller text-secondary"/>;

    const clinVarSearchLink = clinvarVariantSearchUrl ? (
        <React.Fragment>
            <i className="icon icon-search fas small"/>&nbsp;&nbsp;
            <a href={clinvarVariantSearchUrl} target="_blank" rel="noopener noreferrer"
                data-tip="Search ClinVar for all variants at this variant's location">
                Variants at this location
                { externalLinkIconAppend }
            </a>
        </React.Fragment>
    ) : null;

    if (!variationID) {
        // No ClinVar info available. Still include link to search for variant at same location, though.
        return (
            <div className="d-flex align-items-center justify-content-center h-100 flex-column">
                { clinVarSearchLink ? <div className="my-2 flex-grow-1 w-100 text-left">{ clinVarSearchLink }</div> : null }
                <h4 className="font-italic text-400 my-0 pb-24 flex-grow-1">No record in ClinVar</h4>
            </div>
        );
    }

    return (
        <React.Fragment>

            <div className="mb-12">
                <label data-tip={getTipForField("csq_clinvar")} className="mb-0 d-inline">ID: </label>
                { clinvarExternalHref?
                    <a href={clinvarExternalHref} target="_blank" rel="noopener noreferrer" data-tip="View this variant in ClinVar">
                        { variationID }
                        { externalLinkIconAppend }
                    </a>
                    : <span>{ variationID }</span> }
                { clinVarSearchLink ? <>&nbsp;&nbsp;|&nbsp;&nbsp;{ clinVarSearchLink }</> : null }
            </div>

            <div className="row mt-03">
                <div className="col-3">
                    <label data-tip={getTipForField("csq_clinvar_clnsig")} className="mb-0">Interpretation: </label>
                </div>
                <div className="col-9">
                    { clinicalSignificanceFromClinVar || clinicalSignificanceFromVariant }
                </div>
            </div>

            <div className="row mt-03">
                <div className="col-3">
                    <label data-tip={getTipForField("csq_clinvar_clnrevstat")} className="mb-0">Review Status: </label>
                </div>
                <div className="col-9">
                    { reviewStatusFromClinVar || reviewStatusFromVariant }
                </div>
            </div>

            { lastEvaluatedFromClinVar && !isNaN(lastEvaluatedFromClinVar) ?
                <div className="row mt-03">
                    <div className="col-3">
                        <label className="mb-0">Last Evaluated: </label>
                    </div>
                    <div className="col-9">
                        <LocalizedTime timestamp={lastEvaluatedFromClinVar} localize={false} />
                    </div>
                </div>
                : null }

        </React.Fragment>
    );
}


/**
 * In some scenarios we may have arrays for some fields, esp for SNV gnomad v2 exome.
 * This is a simple workaround to standardize to show only first value, if this is case & >1 value (rare).
 * In future we may change how this logic works (so instead of [0], the index of the least rare total frequency to be shown.)
 */
export function standardizeGnomadValue(value, fallbackElem = <em data-tip="Not Available"> - </em>){
    if (typeof value === "number") return value;
    if (Array.isArray(value) && _.every(value, function(v){ return typeof v === "number"; })) {
        return value[0]; // Pick first
    }
    return fallbackElem;
}


export function GeneTranscriptDisplayTitle({ transcript, hideGene }){
    if (!transcript) return null;
    const {
        csq_canonical = false,
        csq_mane = null,
        csq_feature = <em>No Name</em>,
        csq_biotype = null,
        csq_gene : {
            display_title: geneDisplayTitle = null
        } = {}
    } = transcript;
    return (
        <React.Fragment>
            <span className="text-600">{ csq_mane || csq_feature }</span>
            { !hideGene ?
                <span className="text-400"> ({ geneDisplayTitle || <em>No Gene</em> })</span>
                : null}
            { csq_canonical ?
                <span className="text-400 ml-05 text-muted small" data-tip="Canonical Transcript">
                    <i className="icon icon-asterisk fas"/>
                </span>
                : null }
        </React.Fragment>
    );
}

/** This will likely need/get feedback and may change */
export function getMostSevereConsequence(csq_consequence = []){
    const impactMap = {
        "HIGH" : 0,
        "MODERATE" : 1,
        "LOW" : 2,
        "MODIFIER" : 3
    };

    if (csq_consequence.length === 0) {
        return null;
    }

    const [ mostSevereConsequence ] = csq_consequence.slice().sort(function({ impact: iA }, { impact: iB }){
        return impactMap[iA] - impactMap[iB];
    });

    return mostSevereConsequence;
}

export function getTranscriptLocation(transcript, mostSevereConsequence = null){
    const {
        csq_exon = null,
        csq_intron = null,
        csq_distance = null,
    } = transcript || {};

    const { var_conseq_name = null } = mostSevereConsequence || {};
    const consequenceName = (typeof var_conseq_name === "string" && var_conseq_name.toLowerCase()) || null;

    let returnString = null;

    if (csq_exon !== null) { // In case csq_exon is `0` or something (unsure if possible)
        returnString = "Exon " + csq_exon;
    } else if (csq_intron !== null) {
        returnString = "Intron " + csq_intron;
    } else if (csq_distance !== null) {
        if (consequenceName === "downstream_gene_variant") {
            returnString = csq_distance + "bp downstream";
        } else if (consequenceName === "upstream_gene_variant") {
            returnString = csq_distance + "bp upstream";
        }
    }

    if (consequenceName === "3_prime_utr_variant"){
        returnString = returnString ? returnString + " (3′ UTR)" : "3′ UTR" ;
    } else if (consequenceName === "5_prime_utr_variant"){
        returnString = returnString ? returnString + " (5′ UTR)" : "5′ UTR" ;
    }

    return returnString;
}

/**
 * Takes in a list of transcripts and returns the most severe, canonical, or the first in the array
 * @param {Array} transcript - array of SNV or SV transcripts
 * @returns Number
 */
export function getInitialTranscriptIndex(transcript) {
    // Set initial index to most severe or canonical transcript.
    let initialIndex = transcript.findIndex(function({ csq_most_severe }){
        return !!(csq_most_severe);
    });

    if (initialIndex === -1){
        initialIndex = transcript.findIndex(function({ csq_canonical }){
            return !!(csq_canonical);
        });
    }

    if (initialIndex === -1){
        initialIndex = 0;
    }
    return parseInt(initialIndex);
}

const linksToGnomad = <span>More information available <a href="https://gnomad.broadinstitute.org/help/constraint" target="_blank" rel="noreferrer">from gnomAD</a> and in the <a href="https://doi.org/10.1038/s41586-020-2308-7" target="_blank" rel="noreferrer">gnomAD flagship paper</a>.</span>;

const genePopoverContents = {
    expected: (
        <p>
            Expected variant counts (from gnomAD) for each mutation class. {linksToGnomad}
        </p>
    ),
    observed: (
        <p>
            Observed variant counts (from gnomAD) for each mutation class. {linksToGnomad}
        </p>
    ),
    oerange: (
        <p>
            Quotient of observed variant counts over expected variant counts (from gnomAD) for each variant class. {linksToGnomad}
        </p>
    ),
    zscore: (
        <p>
            Z-score for observed vs expected variant counts (from gnomAD) for each variant class. {linksToGnomad}
        </p>
    ),
    loeuf: (
        <p>
            Loss-of-function observed/expected upper bound fraction; a metric that is developed by the gnomAD team and supersedes pLI. Applicable to LoF variants only. {linksToGnomad}
        </p>
    ),
    shet: (
        <p>
            S-het is a score representing an estimate of the genome-wide distribution of selective effects for heterozygous protein truncating variants. Applicable to LoF variants only.
            For more information, see <a href="https://doi.org/10.1038/s41586-020-2308-7" target="_blank" rel="noreferrer">the publication</a>.
        </p>
    ),
    rvis: (
        <p>
            Residual Variation Intolerance Score, a gene-based score formulated based on allele frequency data in the ExAC cohort. Applicable to missense variants only.&nbsp;
            A positive score indicates more common functional variation in the gene compared to genome-wide expectation; a negative score indicates less functional variation or intolerance to variation.&nbsp;
            More information available at <a href="http://genic-intolerance.org/about" target="_blank" rel="noreferrer">http://genic-intolerance.org/about</a>.
        </p>
    )
};
