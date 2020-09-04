'use strict';

import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import DropdownButton from 'react-bootstrap/esm/DropdownButton';
import DropdownItem from 'react-bootstrap/esm/DropdownItem';
import { console, schemaTransforms } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';

import { Schemas } from './../../util';


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
    const {
        error               = null,
        '@id' : geneAtID    = null,
        name                = <em>None</em>,
        gene_symbol         = null,
        gene_biotype        = <em>None</em>,
        alias_symbol        = <em>Todo 2</em>,
        alias_name          = <em>Todo 3</em>,
        gene_summary        = <em>No summary available</em>
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
                                    <label htmlFor="variant.transcript.vep_gene.name" className="mb-0" data-tip={getTipForField("name")}>
                                        Gene Name:
                                    </label>
                                </div>
                                <div className="col-12 col-xl-9" id="variant.transcript.vep_gene.name">
                                    { name }
                                </div>
                            </div>

                            <div className="row mb-03">
                                <div className="col-12 col-xl-3">
                                    <label htmlFor="variant.transcript.vep_gene.gene_symbol" className="mb-0" data-tip={getTipForField("gene_symbol")}>
                                        Symbol:
                                    </label>
                                </div>
                                <div className="col-12 col-xl-9" id="variant.transcript.vep_gene.gene_symbol">
                                    { gene_symbol }
                                </div>
                            </div>

                            <div className="row mb-03">
                                <div className="col-12 col-xl-3">
                                    <label htmlFor="variant.transcript.vep_gene.todo1" className="mb-0" data-tip={null}>
                                        Gene Location:
                                    </label>
                                </div>
                                <div className="col-12 col-xl-9" id="variant.transcript.vep_gene.todo1">
                                    { <em>Todo 1</em> }
                                </div>
                            </div>

                            <div className="row mb-03">
                                <div className="col-12 col-xl-3">
                                    <label htmlFor="variant.transcript.vep_gene.gene_biotype" className="mb-0" data-tip={getTipForField("gene_biotype")}>
                                        Gene Type:
                                    </label>
                                </div>
                                <div className="col-12 col-xl-9" id="variant.transcript.vep_gene.gene_biotype">
                                    { Schemas.Term.toName("gene_biotype", gene_biotype) }
                                </div>
                            </div>

                            <div className="row mb-03">
                                <div className="col-12 col-xl-3">
                                    <label htmlFor="variant.transcript.vep_gene.alias_symbol" className="mb-0" data-tip={null}>
                                        Alias Symbol:
                                    </label>
                                </div>
                                <div className="col-12 col-xl-9" id="variant.transcript.vep_gene.alias_symbol">
                                    { alias_symbol }
                                </div>
                            </div>

                            <div className="row mb-03">
                                <div className="col-12 col-xl-3">
                                    <label htmlFor="variant.transcript.vep_gene.todo3" className="mb-0" data-tip={null}>
                                        Alias Names:
                                    </label>
                                </div>
                                <div className="col-12 col-xl-9" id="variant.transcript.vep_gene.todo3">
                                    { alias_name }
                                </div>
                            </div>

                            <div className="row mb-03">
                                <div className="col-12 col-xl-3">
                                    <label htmlFor="variant.transcript.vep_gene.gene_summary" className="mb-0" data-tip={getTipForField("gene_summary")}>
                                        Gene Summary:
                                    </label>
                                </div>
                                <div className="col-12 col-xl-9" id="variant.transcript.vep_gene.gene_summary">
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

export const ExternalDatabasesSection = React.memo(function ExternalDatabasesSection(props){
    const {
        currentItem, // Renamed from 'currentGeneItem' in case want to move & re-use for Variant, also.
        schemas = null,
        itemType = "Gene",
        // IN FUTURE WE WON"T HAVE THIS LIST
        // AND INSTEAD GATHER THE PROPERTIES FROM SCHEMA
        // ACCORDING TO PERHAPS "annotation_category" :"dbxref"
        // Clinvar, medgen not exist yet it seems.

        externalDatabaseFieldnames = [
            // TODO handle commented-out sub-objects:
            "genecards",
            "ensgid",
            "entrez_id",
            "hgnc_id",
            // "ccds_id", - duplicate
            "genereviews",
            // "transcriptid.ensembl_pro", - duplicate
            "uniprot_ids",
            "pdb",
            "mgi_id",
            "marrvel",
            "omim_id",
            "orphanet",
            "trait_association_gwas_pmid",
            "clingen",
            "pharmgkb",
            "gtex_expression",
            "brainspan_microarray",
            "brainspan_rnaseq",
            "brainatlas_microarray",
            "biogrid",
            "string",
            "gene_symbol",
            "refseq_accession",
            // "clingendis.disease_id", // todo - handle
            // "transcriptid.ensembl_trs", // todo - handle
            "gnomad"
        ]
    } = props;

    if (!schemas) {
        return (
            <div className="text-secondary d-flex align-items-center justify-content-center h-100 pb-12 text-larger pb-08">
                <i className="icon icon-spin icon-circle-notch fas" />
            </div>
        );
    }

    const externalDatabaseSchemaFields = externalDatabaseFieldnames.map(function(fieldName){
        const propertySchema = schemaTransforms.getSchemaProperty(fieldName, schemas, itemType);
        return [ fieldName, propertySchema ];
    }).filter(function(f){
        // Filter out fields which don't exist in schema yet.
        // Or for which we can't form links for.
        return !!(
            f[1] &&
            (f[1].link || (f[1].items && f[1].items.link))
        );
    });

    const externalDatabaseElems = externalDatabaseSchemaFields.map(function([ fieldName, fieldSchema ]){

        const isArray = fieldSchema.items && fieldSchema.type === "array";

        const {
            link: linkFormat = null,
            title = null,
            // description = null
        } = (isArray ? fieldSchema.items : fieldSchema);

        let externalIDs = currentItem[fieldName];
        if (typeof externalIDs === "undefined") {
            externalIDs = [];
        } else if (!isArray) {
            externalIDs = [ externalIDs ];
        }


        // if (!externalID) {
        //     return null;
        // }

        let val;

        if (externalIDs.length === 0) {
            val = <em data-tip="Not Available" className="px-1"> - </em>;
        } else {
            val = externalIDs.map(function(externalID){
                const linkToID = linkFormat.replace("<ID>", externalID);
                return (
                    <a href={linkToID || null} className="d-block" target="_blank" rel="noopener noreferrer" id={"external_resource_for_" + fieldName} key={externalID}>
                        <span>{ externalID }</span>
                        <i className="ml-05 icon icon-fw icon-external-link-alt fas text-smaller text-secondary" />
                    </a>
                );
            });
        }

        return (
            <div className="row mb-03" key={fieldName}>
                <div className="col-12 col-xl">
                    <label className="mb-0 black-label" htmlFor={"external_resource_for_" + fieldName}>{ title || fieldName }</label>
                </div>
                <div className="col-12 col-xl-auto">
                    { val }
                </div>
            </div>
        );
    }).filter(function(elem){ return !!elem; });

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

function ConstraintScoresSection({ currentGeneItem, getTipForField }){
    const {
        exp_lof, exp_mis, exp_syn,
        obs_lof, obs_mis, obs_syn,
        oe_lof,  oe_mis,  oe_syn,
        // more todo
    } = currentGeneItem;
    return (
        <table className="w-100">
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
                    <td className="text-600 text-left">{"Exp. SNV's"}</td>
                    <td data-tip={getTipForField("exp_syn")}>{ exp_syn }</td>
                    <td data-tip={getTipForField("exp_mis")}>{ exp_mis }</td>
                    <td data-tip={getTipForField("exp_lof")}>{ exp_lof }</td>
                </tr>
                <tr>
                    <td className="text-600 text-left">{"Obs. SNV's"}</td>
                    <td data-tip={getTipForField("obs_syn")}>{ obs_syn }</td>
                    <td data-tip={getTipForField("obs_mis")}>{ obs_mis }</td>
                    <td data-tip={getTipForField("obs_lof")}>{ obs_lof }</td>
                </tr>
                <tr>
                    <td className="text-600 text-left">{"o/e"}</td>
                    <td data-tip={getTipForField("oe_syn")}>{ oe_syn }</td>
                    <td data-tip={getTipForField("oe_mis")}>{ oe_mis }</td>
                    <td data-tip={getTipForField("oe_lof")}>{ oe_lof }</td>
                </tr>
            </tbody>
        </table>
    );
}
