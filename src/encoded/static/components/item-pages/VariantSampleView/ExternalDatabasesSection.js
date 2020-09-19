'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import { console, schemaTransforms, object } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';


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
            // "gene_symbol", - duplicate/excluded
            // "refseq_accession", - duplicate/excluded
            // "clingendis.disease_id", // removed for now ('user can find through clingen')
            // "transcriptid.ensembl_trs", // removed for now
            // "gnomad" // removed for now
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
        let propertySchema = schemaTransforms.getSchemaProperty(fieldName, schemas, itemType);
        // (Might change in future:) We get .items from this if array field since link & such defined in it.
        if (propertySchema && propertySchema.items) {
            propertySchema = propertySchema.items;
        }
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
                    <a href={linkToID || null} className="d-block" target="_blank" rel="noopener noreferrer" id={"external_resource_for_" + fieldName} key={externalID}>
                        <span>{ externalID }</span>
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
                        <a href={linkToID || null} target="_blank" rel="noopener noreferrer" id={"external_resource_for_" + fieldName}
                            data-tip={index === 0 ? null : externalID}>
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
                <div className="col-12 col-xl">
                    <label className="mb-0 black-label" htmlFor={"external_resource_for_" + fieldName} data-tip={schemaDescription}>
                        { schemaTitle || fieldName }
                    </label>
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
