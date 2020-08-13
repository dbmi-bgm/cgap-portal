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
                <div className="col-12 col-md-6 d-flex flex-column">

                    <div className="flex-grow-1 pb-2 pb-md-0">
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
                                    <label htmlFor="variant.transcript.vep_gene.todo2" className="mb-0" data-tip={null}>
                                        Alias Symbol:
                                    </label>
                                </div>
                                <div className="col-12 col-xl-9" id="variant.transcript.vep_gene.todo2">
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
                <div className="col-12 col-md-6 d-flex flex-column">

                    <div className="flex-grow-1 pb-2">
                        <div className="info-header-title">
                            <h4>External Databases</h4>
                        </div>
                        <div className="info-body">
                            {/* maybe Gene Resources sub-header here */}
                            <ExternalDatabasesSection {...{ schemas, currentGeneItem }} currentItem={currentGeneItem} />
                        </div>
                    </div>

                    <div className="flex-grow-0 pb-2 pb-md-0">
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

const ExternalDatabasesSection = React.memo(function ExternalDatabasesSection(props){
    const {
        currentItem, // Renamed from 'currentGeneItem' in case want to move & re-use for Variant, also.
        schemas = null,
        itemType = "Gene",
        // IN FUTURE WE WON"T HAVE THIS LIST
        // AND INSTEAD GATHER THE PROPERTIES FROM SCHEMA
        // ACCORDING TO PERHAPS "annotation_category" :"dbxref"
        // Clinvar, medgen not exist yet it seems.
        externalDatabaseFieldnames = ["genecards", "gnomad", "clinvar", "medgen", "omim_id", "hpa", "gtex_expression", "brainatlas_microarray", "marrvel", "mgi_id"]
    } = props;

    if (!schemas) {
        return (
            <div className="text-center">
                <i className="icon icon-spin icon-circle-notch fas" />
            </div>
        );
    }

    const { [itemType]: { properties: geneSchemaProperties } } = schemas;


    const externalDatabaseSchemaFields = externalDatabaseFieldnames.map(function(fieldName){
        return [ fieldName, geneSchemaProperties[fieldName] ];
    }).filter(function(f){
        // Filter out fields which don't exist in schema yet.
        // Or for which we can't form links for.
        return !!(f[1] && f[1].link);
    });

    const externalDatabaseElems = externalDatabaseSchemaFields.map(function([ fieldName, fieldSchema ]){
        const {
            link: linkFormat = null,
            title = null,
            description = null
        } = fieldSchema;
        const externalID = currentItem[fieldName];
        if (!externalID) {
            return null;
        }
        // IN FUTURE WE WILL GET LINK BACK FROM BACK-END RATHER THAN MAKE IT HERE.
        const linkToID = linkFormat.replace("<ID>", externalID);
        return (
            <div className="row mb-03" key={fieldName}>
                <div className="col-12 col-xl">
                    <label className="mb-0" htmlFor={"variant.transcript.vep_gene." + fieldName} data-tip={description}>{ title || fieldName }</label>
                </div>
                <a className="col-12 col-xl-auto" href={linkToID || null} tagret="_blank" rel="noopener noreferrer" id={"variant.transcript.vep_gene." + fieldName}>
                    <span>{ externalID }</span>
                    <i className="ml-05 icon icon-fw icon-external-link-alt fas small text-secondary" />
                </a>
            </div>
        );
    }).filter(function(elem){ return !!elem; });

    const externalDatabaseElemsLen = externalDatabaseElems.length;
    if (externalDatabaseElemsLen === 0) {
        return <h4 className="text-center text-italic text-400">No External Databases</h4>;
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
            <thead>
                <tr>
                    <th>Constraint</th>
                    <th>Synonymous</th>
                    <th>Missense</th>
                    <th>LoF</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td className="text-600">{"Exp. SNV's"}</td>
                    <td data-tip={getTipForField("exp_syn")}>{ exp_syn }</td>
                    <td data-tip={getTipForField("exp_mis")}>{ exp_mis }</td>
                    <td data-tip={getTipForField("exp_lof")}>{ exp_lof }</td>
                </tr>
                <tr>
                    <td className="text-600">{"Obs. SNV's"}</td>
                    <td data-tip={getTipForField("obs_syn")}>{ obs_syn }</td>
                    <td data-tip={getTipForField("obs_mis")}>{ obs_mis }</td>
                    <td data-tip={getTipForField("obs_lof")}>{ obs_lof }</td>
                </tr>
                <tr>
                    <td className="text-600">{"o/e"}</td>
                    <td data-tip={getTipForField("oe_syn")}>{ oe_syn }</td>
                    <td data-tip={getTipForField("oe_mis")}>{ oe_mis }</td>
                    <td data-tip={getTipForField("oe_lof")}>{ oe_lof }</td>
                </tr>
            </tbody>
        </table>
    );
}
