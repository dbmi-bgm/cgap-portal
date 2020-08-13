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
 * Excluding the Gene Area (under position in mockuop https://gyazo.com/81d5b75b167bddef1b4c0a97f1640c51)
 */

export function VariantTabBody ({ context, schemas }) {

    const getTipForField = useMemo(function(){
        if (!schemas) return function(){ return null; };
        // Helper func to basically just shorten `schemaTransforms.getSchemaProperty(field, schemas, itemType);`.
        return function(field, itemType = "Variant"){
            // Func is scoped within GeneTabBody (uses its 'schemas')
            const schemaProperty = schemaTransforms.getSchemaProperty(field, schemas, itemType);
            return (schemaProperty || {}).description || null;
        };
    }, [ schemas ]);

    return (
        <div className="variant-tab-body card-body">
            <div className="row">
                <div className="col-12 col-md-6 d-flex flex-column">

                    <div className="flex-grow-0 pb-2">
                        <div className="info-header-title">
                            <h4>GnomAD</h4>
                        </div>
                        <div className="info-body">
                            <GnomADTable {...{ context, schemas, getTipForField }} />
                        </div>
                    </div>

                    <div className="flex-grow-1 pb-2 pb-md-0">
                        <div className="info-header-title">
                            <h4>ClinVar</h4>
                        </div>
                        <div className="info-body">
                            {/* We could maybe rename+put `ExternalDatabasesSection` into own file (from GeneTabBody.js), parameterize itemtype for schemas, and re-use ? */}
                            <em>Todo</em>
                        </div>
                    </div>


                </div>
                <div className="col-12 col-md-6 d-flex flex-column">

                    <div className="flex-grow-1 pb-2">
                        <div className="info-header-title">
                            <h4>External Resources</h4>
                        </div>
                        <div className="info-body">
                            {/* We could maybe rename+put `ExternalDatabasesSection` into own file (from GeneTabBody.js), parameterize itemtype for schemas, and re-use ? */}
                            <em>Todo</em>
                        </div>
                    </div>

                    <div className="flex-grow-1 pb-2 pb-md-0">
                        <div className="info-header-title">
                            <h4>Predictors</h4>
                        </div>
                        <div className="info-body">
                            <PredictorsSection {...{ schemas, context }} />
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}

function GnomADTable({ context, getTipForField }){
    const { variant } = context;
    const {
        // Allele Counts
        gnomad_ac,      // Total
        gnomad_ac_female, // Female
        gnomad_ac_male, // Male
        // Allele Frequences
        gnomad_af, gnomad_af_female, gnomad_af_male,
        // Allele Numbers
        gnomad_an, gnomad_an_female, gnomad_an_male,
        // Homozygote Numbers
        gnomad_nhomalt, gnomad_nhomalt_female, gnomad_nhomalt_male
    } = variant;

    const populationsAncestryList = [
        // Todo: eventually collect from schemas?
        ["afr", "African-American/African"],
        ["ami", "Amish"],
        ["amr", "Latino"],
        ["asj", "Ashkenazi Jewish"],
        ["eas", "East Asian"],
        ["fin", "Finnish"],
        ["nfe", "Non-Finnish European"],
        ["sas", "South Asian"],
        ["oth", "Other Ancestry"]
    ];
    const ancestryRowData = _.sortBy(
        populationsAncestryList.map(function([popStr, populationTitle]){
            const {
                ["gnomad_ac_" + popStr]: alleleCount,
                ["gnomad_af_" + popStr]: alleleFreq,
                ["gnomad_an_" + popStr]: alleleNum,
                ["gnomad_nhomalt_" + popStr]: homozygoteNum,
            } = variant;
            return { popStr, populationTitle, alleleCount, alleleFreq, alleleNum, homozygoteNum };
        }),
        function({ alleleFreq }){
            return -alleleFreq;
        }
    );
    const ancestryTableRows = ancestryRowData.map(function({ popStr, populationTitle, alleleCount, alleleFreq, alleleNum, homozygoteNum }){
        return (
            <tr key={populationTitle}>
                <td className="text-600 text-left">{ populationTitle }</td>
                <td>{ alleleCount }</td>
                <td>{ alleleNum }</td>
                <td>{ homozygoteNum }</td>
                <td className="text-left">{ alleleFreq || "0.0000" }</td>
            </tr>
        );
    });

    return (
        <table className="w-100">
            <thead>
                <tr>
                    <th>Population</th>
                    <th data-tip={getTipForField("gnomad_ac")}>Allele Count</th>
                    <th data-tip={getTipForField("gnomad_an")}>Allele Number</th>
                    <th data-tip={getTipForField("gnomad_nhomalt")}># of Homozygotes</th>
                    <th data-tip={getTipForField("gnomad_af")}>Allele Frequency</th>
                </tr>
            </thead>
            <tbody>
                { ancestryTableRows }
                <tr className="border-top">
                    <td className="text-600 text-left">Female</td>
                    <td>{ gnomad_ac_female }</td>
                    <td>{ gnomad_an_female }</td>
                    <td>{ gnomad_nhomalt_female }</td>
                    <td className="text-left">{ gnomad_af_female || "0.0000" }</td>
                </tr>
                <tr>
                    <td className="text-600 text-left">Male</td>
                    <td>{ gnomad_ac_male }</td>
                    <td>{ gnomad_an_male }</td>
                    <td>{ gnomad_nhomalt_male }</td>
                    <td className="text-left">{ gnomad_af_male || "0.0000" }</td>
                </tr>
                <tr className="border-top">
                    <td className="bg-light text-left"><strong>Total</strong></td>
                    <td className="bg-light text-600">{ gnomad_ac }</td>
                    <td className="bg-light text-600">{ gnomad_an }</td>
                    <td className="bg-light text-600">{ gnomad_nhomalt }</td>
                    <td className="bg-light text-600 text-left">{ gnomad_af || "0.0000" }</td>
                </tr>
            </tbody>
        </table>
    );
}

function PredictorsSection(props){
    return <em>Todo</em>;
}
