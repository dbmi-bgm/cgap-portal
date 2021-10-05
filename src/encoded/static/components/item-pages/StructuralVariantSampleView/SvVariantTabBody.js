'use strict';

import React, { useMemo, useState, useCallback } from 'react';
import _ from "underscore";
import DropdownButton from 'react-bootstrap/esm/DropdownButton';
import DropdownItem from 'react-bootstrap/esm/DropdownItem';

import { console, schemaTransforms } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { ClinVarSection, getClinvarInfo, standardizeGnomadValue } from '../VariantSampleView/AnnotationSections';


export const SvVariantTabBody = React.memo(function SvVariantTabBody({ context, schemas }) {
    const [ showingTable, setShowingTable ] = useState("SV"); // Currently only "SV" allowed; more will be added in future

    const onSelectShowingTable = useCallback(function(evtKey, e){
        e.stopPropagation();
        setShowingTable(evtKey);
        return;
    });

    const titleDict = useMemo(function(){
        return {
            "SV": <React.Fragment>gnomAD <span className="text-400">SV</span></React.Fragment>,
        };
    });

    // TODO: Update w/links if/when we can figure out how to reliably link to svs in gnomAD

    return (
        <div className="variant-tab-body card-body">
            <div className="row flex-column flex-lg-row">
                <div className="inner-card-section col pb-2 pb-lg-0">
                    <div className="row">
                        <div className="col-12 d-flex flex-column">
                            <div className="inner-card-section flex-grow-0 pb-2 pb-xl-0">
                                <div className="info-header-title justify-content-start">
                                    <h4>{titleDict[showingTable]}</h4>
                                </div>
                                <div className="info-body overflow-auto">
                                    <SVGnomADTable {...{ context, schemas }} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});

const SVGnomADTable = React.memo(function SVGnomADTable(props) {
    const { context, schemas, prefix = "gnomadg" } = props;
    const { structural_variant } = context;

    const fallbackElem = <em data-tip="Not Available"> - </em>;

    const {
        [prefix + "_ac"]: gnomad_ac,
        [prefix + "_af"]: gnomad_af,
        [prefix + "_an"]: gnomad_an,
    } = structural_variant;

    const populationsAncestryList = [
        // Todo: eventually collect from schemas?
        ["afr", "African-American/African"],
        ["eas", "East Asian"],
        ["eur", "European"],
        ["oth", "Other Ancestry"]
    ];

    const ancestryRowData = _.sortBy(
        populationsAncestryList.map(function([popStr, populationTitle]){
            const {
                [prefix + "_ac-" + popStr]: alleleCount,
                [prefix + "_af-" + popStr]: alleleFreq,
                [prefix + "_an-" + popStr]: alleleNum,
            } = structural_variant;
            return { popStr, populationTitle, alleleCount, alleleFreq, alleleNum };
        }),
        function({ alleleFreq }){
            return -alleleFreq;
        }
    );
    const ancestryTableRows = ancestryRowData.map(function({ popStr, populationTitle, alleleCount, alleleFreq, alleleNum, homozygoteNum }){
        return (
            <tr key={populationTitle}>
                <td className="text-600 text-left">{ populationTitle }</td>
                <td>{ standardizeGnomadValue(alleleCount) }</td>
                <td>{ standardizeGnomadValue(alleleNum) }</td>
                <td className="text-left">{ alleleFreq === 0 ? "0.0000" : standardizeGnomadValue(alleleFreq) }</td>
            </tr>
        );
    });

    function getTipForField(field, itemType = "StructuralVariantSample"){
        if (!schemas) return null;
        const schemaProperty = schemaTransforms.getSchemaProperty(field, schemas, itemType);
        return (schemaProperty || {}).description || null;
    }

    return (
        <table className="w-100">
            <thead>
                <tr>
                    <th className="text-left">Population</th>
                    <th>
                        Allele Count
                        <i className="icon icon-info-circle fas icon-fw ml-05"
                            data-tip={getTipForField("structural_variant." + prefix + "_ac")} />
                    </th>
                    <th>
                        Allele Number
                        <i className="icon icon-info-circle fas icon-fw ml-05"
                            data-tip={getTipForField("structural_variant." + prefix + "_an")} />
                    </th>
                    <th className="text-left">
                        Allele Frequency
                        <i className="icon icon-info-circle fas icon-fw ml-05"
                            data-tip={getTipForField("structural_variant." + prefix + "_af")} />
                    </th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td className="text-600 text-left">gnomAD SV</td>
                    <td>{gnomad_ac || fallbackElem}</td>
                    <td>{gnomad_an || fallbackElem}</td>
                    <td className="text-left">{gnomad_af || fallbackElem}</td>
                </tr>
                { ancestryTableRows }
            </tbody>
        </table>
    );
});