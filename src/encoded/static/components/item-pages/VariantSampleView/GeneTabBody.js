'use strict';

import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import DropdownButton from 'react-bootstrap/esm/DropdownButton';
import DropdownItem from 'react-bootstrap/esm/DropdownItem';
import { console, layout, ajax } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';


export function GeneTabBody(props){
    const { currentGeneItemLoading, currentGeneItem, context, schemas } = props;
    const { Gene: { properties: geneSchemaProperties = null } = {} } = schemas || {};
    if (currentGeneItemLoading) {
        return (
            <div className="gene-tab-body card-body py-5 text-center text-large">
                <i className="icon icon-spin fas icon-circle-notch" />
            </div>
        );
    }

    // IN FUTURE WE WON"T HAVE THIS LIST
    // AND INSTEAD GATHER THE PROPERTIES FROM SCHEMA
    // ACCORDING TO PERHAPS "annotation_category" :"dbxref"
    // Clinvar, medgen not exist yet it seems.
    const externalDatabaseFieldnames = ["genecards", "gnomad", "clinvar", "medgen", "omim_id", "hpa", "gtex_expression", "brainatlas_microarray", "marrvel", "mgi_id"];

    const externalDBSection = useMemo(function(){
        let externalDBSection = null;
        const externalDatabaseSchemaFields = !geneSchemaProperties ? null : externalDatabaseFieldnames.map(function(fieldName){
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
            const externalID = currentGeneItem[fieldName];
            // IN FUTURE WE WILL GET LINK BACK FROM BACK-END RATHER THAN MAKE IT HERE.
            const linkToID = linkFormat.replace("<ID>", externalID);
            return (
                <a className="row" key={fieldName} href={linkToID || null} tagret="_blank"
                    rel="noopener noreferrer" data-tip={description}>
                    <h5 className="col my-1 text-600">
                        { title || fieldName }
                    </h5>
                    <div className="col-auto col-lg-4">
                        <i className="icon icon-fw icon-external-link-alt fas small text-secondary" />
                    </div>
                </a>
            );
        });

        const externalDatabaseElemsLen = externalDatabaseElems.length;
        if (externalDatabaseElemsLen > 4) {
            const mp = Math.ceil(externalDatabaseElemsLen / 2);
            const col1 = externalDatabaseElems.slice(0, mp);
            const col2 = externalDatabaseElems.slice(mp);
            externalDBSection = (
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
            externalDBSection = externalDatabaseElems;
        }

        return externalDBSection;
    }, [ currentGeneItem, schemas ]);


    return (
        <div className="gene-tab-body card-body">
            <div className="row">
                <div className="col d-flex flex-column">

                    <div className="flex-grow-1 pb-2">
                        <div className="info-header-title">
                            <h4>Overview</h4>
                        </div>
                        <div className="info-body">
                            ABCS
                        </div>
                    </div>

                    <div className="flex-grow-0">
                        <div className="info-header-title">
                            <h4>Conditions</h4>
                        </div>
                        <div className="info-body">
                            ABCDEF<br/>
                            ABCDFSDFS<br/>
                            ABCDFSDFS
                        </div>
                    </div>


                </div>
                <div className="col d-flex flex-column">

                    <div className="flex-grow-1 pb-2">
                        <div className="info-header-title">
                            <h4>External Databases</h4>
                        </div>
                        <div className="info-body">
                            {/* maybe Gene Resources sub-header here */}
                            { externalDBSection }
                        </div>
                    </div>

                    <div className="flex-grow-0">
                        <div className="info-header-title">
                            <h4>Constraint Scores</h4>
                        </div>
                        <div className="info-body">
                            ABCDFSDFS
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}