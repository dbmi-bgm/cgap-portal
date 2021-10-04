'use strict';

import React from 'react';
import _ from 'underscore';
import { schemaTransforms } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';


export const SvSampleTabBody = (props) => {
    const { context = {}, schemas } = props;

    function getTipForField(field, itemType = "StructuralVariantSample", nestedField = ""){
        if (!schemas) return null;
        const schemaProperty = schemaTransforms.getSchemaProperty(field, schemas, itemType);

        if (!nestedField) {
            return (schemaProperty || {}).description || null;
        }

        const pathToDescription = nestedField.split(".");
        pathToDescription.push("description");

        return _.get(schemaProperty || {}, pathToDescription, null);
    }

    return (
        <div className="sample-tab-body card-body">
            <div className="row flex-column flex-lg-row">
                <div className="inner-card-section col pb-2 pb-lg-0">
                    <div className="info-header-title">
                        <h4>Breakpoint Confidence Intervals</h4>
                    </div>
                    <div className="info-body">
                        <SvQualityTable {...{ context, getTipForField }} />
                    </div>
                </div>
            </div>
            <div className="row flex-column flex-lg-row">
                <div className="inner-card-section col mt-2 pb-2 pb-lg-0">
                    <div className="info-header-title">
                        <h4>Genotype</h4>
                    </div>
                    <div className="info-body">
                        <GenotypeQualityTable {...{ context, getTipForField }} />
                    </div>
                </div>
            </div>
        </div>
    );
};


function SvQualityTable(props) {
    const {
        context: {
            confidence_interval_start = [],
            confidence_interval_end = [],
            imprecise = null
        } = {},
        getTipForField
    } = props;
    const fallbackElem = <em> - </em>;

    const startExists = confidence_interval_start.length > 0;
    const endExists = confidence_interval_end.length > 0;

    const impreciseDisplay = imprecise === false ? "Imprecise" : imprecise === true ? "Precise" : fallbackElem;
    return (
        <div className="table-responsive">
            <table className="w-100">
                <thead>
                    <tr>
                        <th className="text-left" style={{ width: "325px" }}>Quality</th>
                        <th className="text-left">Value</th>
                        <th className="text-left">Definition</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td className="text-600 text-left">Precise/Imprecise</td>
                        <td className="text-left">{impreciseDisplay}</td>
                        <td className="text-left">{ getTipForField("imprecise") }</td>
                    </tr>
                    <tr>
                        <td className="text-600 text-left">Confidence interval around left breakpoint</td>
                        <td className="text-left">{startExists ? confidence_interval_start.join(", "): fallbackElem}</td>
                        <td className="text-left">{ getTipForField("confidence_interval_start", "StructuralVariantSample", "items" ) }</td>
                    </tr>
                    <tr>
                        <td className="text-600 text-left">Confidence interval around right breakpoint</td>
                        <td className="text-left">{endExists ? confidence_interval_end.join(", "): fallbackElem}</td>
                        <td className="text-left">{ getTipForField("confidence_interval_end", "StructuralVariantSample", "items") }</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}


function GenotypeQualityTable(props) {
    const { context: { samplegeno = [] } = {}, getTipForField } = props;
    const fallbackElem = <em> - </em>;

    const rows = samplegeno.map((sg) => {
        const {
            samplegeno_role = fallbackElem,
            samplegeno_numgt = fallbackElem,
            samplegeno_sampleid = fallbackElem,
            samplegeno_quality = fallbackElem,
            samplegeno_likelihood = fallbackElem
        } = sg;

        return (
            <tr key={samplegeno_sampleid + samplegeno_role}>
                <td className="text-capitalize text-left text-truncate">{samplegeno_role}</td>
                <td className="text-left text-truncate">{samplegeno_sampleid}</td>
                <td className="text-left text-truncate">{samplegeno_numgt}</td>
                <td className="text-left text-truncate">{samplegeno_quality}</td>
                <td className="text-left text-truncate">{samplegeno_likelihood}</td>
            </tr>
        );
    });
    return (
        <div className="table-responsive">
            <table className="w-100">
                <thead>
                    <tr>
                        <th className="text-left">Relation</th>
                        <th className="text-left">ID</th>
                        <th className="text-left" data-tip={ getTipForField("samplegeno", "StructuralVariantSample", "items.properties.samplegeno_numgt" ) }>Genotype <i className="icon icon-info-circle fas" /></th>
                        <th className="text-left" data-tip={ getTipForField("samplegeno", "StructuralVariantSample", "items.properties.samplegeno_quality" ) }>Genotype Quality <i className="icon icon-info-circle fas" /></th>
                        <th className="text-left" data-tip={ getTipForField("samplegeno", "StructuralVariantSample", "items.properties.samplegeno_likelihood" ) }>Genotype Likelihoods <i className="icon icon-info-circle fas" /></th>
                    </tr>
                </thead>
                <tbody>
                    { rows }
                </tbody>
            </table>
        </div>);
}