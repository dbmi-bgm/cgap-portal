'use strict';

import React, { useMemo, useState, useCallback } from 'react';
import _ from "underscore";
import DropdownButton from 'react-bootstrap/esm/DropdownButton';
import DropdownItem from 'react-bootstrap/esm/DropdownItem';

import { console, schemaTransforms } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { ClinVarSection, getClinvarInfo, standardizeGnomadValue } from '../VariantSampleView/AnnotationSections';


export const SvVariantTabBody = React.memo(function SvVariantTabBody({ context, schemas }) {
    const { structural_variant } = context;
    const { csq_clinvar: variationID, annotation_id: annotationID, hg19_chr, hg19_pos, ALT, REF, transcript } = structural_variant;

    const [ showingTable, setShowingTable ] = useState("SV"); // Currently only "SV" allowed; more will be added in future

    const onSelectShowingTable = useCallback(function(evtKey, e){
        e.stopPropagation();
        setShowingTable(evtKey);
        return;
    });

    const { getTipForField, clinvarExternalHref } = useMemo(function(){ // TODO: consider moving to AnnotationSections & sharing between SV & SNV
        const ret = {
            getTipForField: function(){ return null; },
            clinvarIDSchemaProperty: null,
            clinvarExternalHref: null
        };

        if (schemas){
            // Helper func to basically just shorten `schemaTransforms.getSchemaProperty(field, schemas, itemType);`.
            ret.getTipForField = function(field, itemType = "StructuralVariant"){
                // Func is scoped within GeneTabBody (uses its 'schemas')
                const schemaProperty = schemaTransforms.getSchemaProperty(field, schemas, itemType);
                return (schemaProperty || {}).description || null;
            };
            if (variationID) {
                const clinvarIDSchemaProperty = schemaTransforms.getSchemaProperty("csq_clinvar", schemas, "StructuralVariant");
                ret.clinvarExternalHref = clinvarIDSchemaProperty.link.replace("<ID>", variationID);
            }
        }

        return ret;
    }, [ schemas, variationID ]);

    const titleDict = useMemo(function(){
        return {
            "SV": <React.Fragment>gnomAD <span className="text-400">SV</span></React.Fragment>,
        };
    });

    let gnomadExternalLink = null;
    const isDeletion = !ALT || ALT === "-"; // Can't link to deletions in gnomAD at moment.

    return (
        <div className="variant-tab-body card-body">
            <div className="row flex-column flex-lg-row">
                <div className="inner-card-section col pb-2 pb-lg-0">
                    {/* <div className="row">
                        <div className="col-12 d-flex flex-column">
                            <div className="inner-card-section flex-grow-1 pb-2 pb-xl-1">
                                <div className="info-header-title">
                                    <h4>
                                        ClinVar
                                        { clinvarExternalHref ?
                                            <a href={clinvarExternalHref} rel="noopener noreferrer" target="_blank"
                                                className="px-1" data-tip="View this variant in ClinVar">
                                                <i className="icon icon-external-link-alt fas ml-07 text-small"/>
                                            </a>
                                            : null }
                                    </h4>
                                </div>
                                <div className="info-body clinvar-info-body">
                                    <ClinVarSection {...{ getTipForField, context, schemas, clinvarExternalHref }} />
                                </div>
                            </div>
                        </div>
                    </div> */}
                    <div className="row">
                        <div className="col-12 d-flex flex-column">
                            <div className="inner-card-section flex-grow-0 pb-2 pb-xl-0">
                                <div className="info-header-title justify-content-start">
                                    <h4>{titleDict[showingTable]}</h4>
                                    { gnomadExternalLink ?
                                        <h4>
                                            <a href={gnomadExternalLink} target="_blank" rel="noopener noreferrer"
                                                className="text-small px-1" data-tip={"View this variant in gnomAD " + showingTable}>
                                                <i className="icon icon-external-link-alt fas"/>
                                            </a>
                                        </h4>
                                        : null }
                                </div>
                                <div className="info-body overflow-auto">
                                    <SVGnomADTable {...{ context, schemas, getTipForField }} />
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
    const { context, getTipForField, prefix = "gnomadg" } = props;
    const { structural_variant } = context;

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

    return (
        <table className="w-100">
            <thead>
                <tr>
                    <th className="text-left">Population</th>
                    <th data-tip={getTipForField(prefix + "_ac")}>Allele Count</th>
                    <th data-tip={getTipForField(prefix + "_an")}>Allele Number</th>
                    <th className="text-left" data-tip={getTipForField(prefix + "_af")}>Allele Frequency</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td className="text-600 text-left">gnomAD SV</td>
                    <td>{gnomad_ac}</td>
                    <td>{gnomad_an}</td>
                    <td className="text-left">{gnomad_af}</td>
                </tr>
                { ancestryTableRows }
            </tbody>
        </table>
    );
});