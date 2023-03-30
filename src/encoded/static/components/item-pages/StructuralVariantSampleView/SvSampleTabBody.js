'use strict';

import React from 'react';
import _ from 'underscore';
import { schemaTransforms } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { shortenToSignificantDigits } from '../VariantSampleView/AnnotationSections';
import { falsyZeroCheck } from '../VariantSampleView/AnnotationSections';

export const SvSampleTabBody = (props) => {
    const { context = {}, schemas } = props;

    function getTipForField(field, itemType = "StructuralVariantSample", nestedField = ""){
        if (!schemas) return null;
        const schemaProperty = schemaTransforms.getSchemaProperty(field, schemas, itemType);

        console.log("schemaProperty", schemaProperty);
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
                        <h4>
                            Structural Variant - Caller Properties (Manta)
                            <a href="https://cgap-pipeline-main.readthedocs.io/en/latest/Pipelines/Downstream/SV_germline/overview-SV_germline.html" rel="noopener noreferrer" target="_blank"
                                className="px-1" data-tip="View Manta Documentation">
                                <i className="icon icon-external-link-alt fas ml-07 text-small"/>
                            </a>
                        </h4>
                    </div>
                    <div className="info-body">
                        <SvMantaTable {...{ context, getTipForField }} />
                    </div>
                </div>
            </div>
            <div className="row flex-column flex-lg-row">
                <div className="inner-card-section col mt-2 pb-2 pb-lg-0">
                    <div className="info-header-title">
                        <h4>
                            Copy Number Variant - Caller Properties (BicSeq2)
                            <a href="https://cgap-pipeline-main.readthedocs.io/en/latest/Pipelines/Downstream/CNV_germline/overview-CNV_germline.html" rel="noopener noreferrer" target="_blank"
                                className="px-1" data-tip="View BIC-seq2 Documentation">
                                <i className="icon icon-external-link-alt fas ml-07 text-small"/>
                            </a>
                        </h4>
                    </div>
                    <div className="info-body">
                        <SvBicSeqTable {...{ context, getTipForField }} />
                    </div>
                </div>
            </div>
            <div className="row flex-column flex-lg-row">
                <div className="inner-card-section col mt-2 pb-2 pb-lg-0">
                    <div className="info-header-title">
                        <h4>Genotype Information</h4>
                    </div>
                    <div className="info-body">
                        <GenotypeQualityTable {...{ context, getTipForField }} />
                    </div>
                </div>
            </div>
        </div>
    );
};


function SvMantaTable(props) {
    const {
        context: {
            callers = [],
            confidence_interval_start = [],
            confidence_interval_end = [],
            imprecise = null,
            quality_score: qualityScore = null,
            reference_split_reads,
            alternate_split_reads,
            reference_paired_reads,
            alternate_paired_reads
        } = {},
        getTipForField
    } = props;
    const fallbackElem = <em> - </em>;

    if (!callers.length || !callers.includes("Manta")) {
        return <div class="font-italic text-larger text-center py-4">Variant not detected by Manta</div>;
    }

    const startExists = confidence_interval_start.length > 0;
    const endExists = confidence_interval_end.length > 0;

    const impreciseDisplay = imprecise === false ? "Precise" : imprecise === true ? "Imprecise": fallbackElem;
    return (
        <div className="table-responsive">
            <table className="w-100">
                <thead>
                    <tr>
                        <th className="text-left" style={{ width: "385px" }}>Quality</th>
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
                    <tr>
                        <td className="text-600 text-left">Number of split reads supporting the alternative allele</td>
                        <td className="text-left">{ falsyZeroCheck(alternate_split_reads, fallbackElem)}</td>
                        <td className="text-left">{ getTipForField("alternate_split_reads", "StructuralVariantSample") }</td>
                    </tr>
                    <tr>
                        <td className="text-600 text-left">Number of split reads supporting the reference allele</td>
                        <td className="text-left">{ falsyZeroCheck(reference_split_reads, fallbackElem)}</td>
                        <td className="text-left">{ getTipForField("reference_split_reads", "StructuralVariantSample") }</td>
                    </tr>
                    <tr>
                        <td className="text-600 text-left">Number of spanning reads supporting the alternative allele</td>
                        <td className="text-left">{ falsyZeroCheck(alternate_paired_reads, fallbackElem)}</td>
                        <td className="text-left">{ getTipForField("alternate_paired_reads", "StructuralVariantSample") }</td>
                    </tr>
                    <tr>
                        <td className="text-600 text-left">Number of spanning reads supporting the reference allele</td>
                        <td className="text-left">{ falsyZeroCheck(reference_paired_reads, fallbackElem)}</td>
                        <td className="text-left">{ getTipForField("reference_paired_reads", "StructuralVariantSample") }</td>
                    </tr>
                    <tr>
                        <td className="text-600 text-left">Manta Quality Score</td>
                        <td className="text-left">{ falsyZeroCheck(qualityScore, fallbackElem)}</td>
                        <td className="text-left">{ getTipForField("quality_score", "StructuralVariantSample") }</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}

function SvBicSeqTable(props) {
    const {
        context: {
            callers = [],
            bicseq2_observed_reads = "",
            bicseq2_expected_reads,
            bicseq2_log2_copy_ratio,
            bicseq2_pvalue
        } = {},
        getTipForField
    } = props;

    if (!callers.length || !callers.includes("BIC-seq2")) {
        return <div class="font-italic text-larger text-center py-4">Variant not detected by BIC-seq2</div>;
    }
    
    const fallbackElem = <em> - </em>;

    return (
        <div className="table-responsive">
            <table className="w-100">
                <thead>
                    <tr>
                        <th className="text-left" style={{ width: "200px" }}>Quality</th>
                        <th className="text-left">Value</th>
                        <th className="text-left">Definition</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td className="text-600 text-left">Number of Observed Reads</td>
                        <td className="text-left">{bicseq2_observed_reads || fallbackElem}</td>
                        <td className="text-left">{getTipForField("bicseq2_observed_reads")}</td>
                    </tr>
                    <tr>
                        <td className="text-600 text-left">Number of Expected Reads</td>
                        <td className="text-left">{bicseq2_expected_reads || fallbackElem}</td>
                        <td className="text-left">{getTipForField("bicseq2_expected_reads")}</td>
                    </tr>
                    <tr>
                        <td className="text-600 text-left">Copy Ratio [log2]</td>
                        <td className="text-left">
                            <div className="text-nowrap mr-1">
                                {shortenToSignificantDigits(bicseq2_log2_copy_ratio) || fallbackElem}
                                <i className="ml-02 font-xs icon icon-info-circle fas" data-html 
                                    data-tip={`
                                    <div class="mb-05"><u>Positive Value</u>: Indicates an excess of reads,</br>
                                    suggesting a possible duplication.</div>
                                    <div><u>Negative Value</u>: Indicates a depletion of reads,</br>
                                    suggesting a possible deletion.</div>`}
                                />
                            </div>
                        </td>
                        <td className="text-left">{getTipForField("bicseq2_log2_copy_ratio")}</td>
                    </tr>
                    <tr>
                        <td className="text-600 text-left">P-value</td>
                        <td className="text-left">{shortenToSignificantDigits(bicseq2_pvalue, 2) || fallbackElem}</td>
                        <td className="text-left">{getTipForField("bicseq2_pvalue")}</td>
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
                        <th className="text-left">Genotype <i className="icon icon-info-circle fas" data-tip={ getTipForField("samplegeno", "StructuralVariantSample", "items.properties.samplegeno_numgt" ) }/></th>
                        <th className="text-left">Genotype Quality <i className="icon icon-info-circle fas" data-tip={ getTipForField("samplegeno", "StructuralVariantSample", "items.properties.samplegeno_quality" ) }/></th>
                        <th className="text-left">Genotype Likelihoods <i className="icon icon-info-circle fas" data-tip={ getTipForField("samplegeno", "StructuralVariantSample", "items.properties.samplegeno_likelihood" ) }/></th>
                    </tr>
                </thead>
                <tbody>
                    { rows }
                </tbody>
            </table>
        </div>);
}