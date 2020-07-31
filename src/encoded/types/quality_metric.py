"""The type file for the collection Quality Metric."""
from snovault.calculated import calculate_properties
from snovault import (
    abstract_collection,
    calculated_property,
    collection,
    load_schema,
)
# from pyramid.security import Authenticated
from .base import (
    Item,
    ALLOW_SUBMITTER_ADD,
    # lab_award_attribution_embed_list
)

"""Schema for QCs' quality_metric_summary calculated property"""
QC_SUMMARY_SCHEMA = {
    "type": "array",
    "title": "Quality Metric Summary",
    "description": "Selected Quality Metrics for Summary",
    "exclude_from": ["submit4dn", "FFedit-create"],
    "items": {
            "title": "Selected Quality Metric",
            "type": "object",
            "required": ["title", "value", "numberType"],
            "additionalProperties": False,
            "properties": {
                "title": {
                    "type": "string",
                    "title": "Title",
                    "description": "Title of the Quality Metric",
                },
                "title_tooltip": {
                    "type": "string",
                    "title": "Tooltip Title",
                    "description": "tooltip for the quality metric title to be displayed upon mouseover"
                },
                "sample": {
                    "type": "string",
                    "title": "Sample",
                    "description": "sample for which the quality metric was calculated"
                },
                "value": {
                    "type": "string",
                    "title": "Value",
                    "description": "value of the quality metric as a string"
                },
                "tooltip": {
                    "type": "string",
                    "title": "Tooltip",
                    "description": "tooltip for the quality metric to be displayed upon mouseover"
                },
                "numberType": {
                    "type": "string",
                    "title": "Type",
                    "description": "type of the quality metric",
                    "enum": ["string", "integer", "float", "percent"]
                }
            }
    }
}


"""OVERALL QAULITY SCORE INFO
All QC objects come with a field 'overall_quality_status', which is by default set to 'PASS'
For some qc object we don't have a current protocol to judge the overall quality based on the
fields in the qc item.
When there is a way to make this assesment, add this algorithm as a function to the corresponding
qc class, and update the value. If you implement it for a class with existing items, you will need
to trigger the update with empty patches."""


@abstract_collection(
    name='quality-metrics',
    acl=ALLOW_SUBMITTER_ADD,
    properties={
        'title': 'Quality Metrics',
        'description': 'Listing of quality metrics',
    })
class QualityMetric(Item):
    """Quality metrics class."""
    item_type = 'quality_metric'
    base_types = ['QualityMetric'] + Item.base_types
    schema = load_schema('encoded:schemas/quality_metric.json')
    embedded_list = Item.embedded_list  # + lab_award_attribution_embed_list


@collection(
    name='quality-metrics-fastqc',
    properties={
        'title': 'FastQC Quality Metrics',
        'description': 'Listing of FastQC Quality Metrics',
    })
class QualityMetricFastqc(QualityMetric):
    """Subclass of quality matrics for fastq files."""

    item_type = 'quality_metric_fastqc'
    schema = load_schema('encoded:schemas/quality_metric_fastqc.json')
    embedded_list = QualityMetric.embedded_list


@collection(
    name='quality-metrics-bamcheck',
    properties={
        'title': 'Bam Check Quality Metrics',
        'description': 'Listing of Bam Check Quality Metrics'
    })
class QualityMetricBamcheck(QualityMetric):
    """Subclass of quality matrics for bam files."""

    item_type = 'quality_metric_bamcheck'
    schema = load_schema('encoded:schemas/quality_metric_bamcheck.json')
    embedded_list = QualityMetric.embedded_list

    def _update(self, properties, sheets=None):
        qc_val = properties.get('quickcheck', '')
        overall = ''
        if not properties.get('overall_quality_status'):
            overall = 'WARN'
        elif qc_val == 'OK':
            overall = 'PASS'
        else:
            overall = 'FAIL'
        # set name based on what is entered into title
        properties['overall_quality_status'] = overall
        super(QualityMetricBamcheck, self)._update(properties, sheets)


@collection(
    name='quality-metrics-vcfcheck',
    properties={
        'title': 'Vcf Check Quality Metrics',
        'description': 'Listing of Vcf Check Quality Metrics'
    })
class QualityMetricVcfcheck(QualityMetric):
    """Subclass of quality matrics for vcf files."""

    item_type = 'quality_metric_vcfcheck'
    schema = load_schema('encoded:schemas/quality_metric_vcfcheck.json')
    embedded_list = QualityMetric.embedded_list

    def _update(self, properties, sheets=None):
        qc_val = properties.get('quickcheck', '')
        overall = ''
        if not properties.get('overall_quality_status'):
            overall = 'WARN'
        elif qc_val == 'OK':
            overall = 'PASS'
        else:
            overall = 'FAIL'
        # set name based on what is entered into title
        properties['overall_quality_status'] = overall
        super(QualityMetricVcfcheck, self)._update(properties, sheets)


@collection(
    name='quality-metrics-workflowrun',
    properties={
        'title': 'QC Quality metrics for Workflow Run',
        'description': 'Listing of QC Quality Metrics for Workflow Run.',
    })
class QualityMetricWorkflowrun(QualityMetric):
    """Subclass of quality matrics for Workflow run"""
    item_type = 'quality_metric_workflowrun'
    schema = load_schema('encoded:schemas/quality_metric_workflowrun.json')
    embedded_list = QualityMetric.embedded_list


@collection(
    name='quality-metrics-wgs-bamqc',
    properties={
        'title': 'QC Quality metrics for WGS Bam QC',
        'description': 'Listing of QC Quality Metrics for WGS Bam QC.',
    })
class QualityMetricWgsBamqc(QualityMetric):
    """Subclass of quality matrics for WGS bam files."""

    item_type = 'quality_metric_wgs_bamqc'
    schema = load_schema('encoded:schemas/quality_metric_wgs_bamqc.json')
    embedded_list = QualityMetric.embedded_list


@collection(
    name='quality-metrics-qclist',
    properties={
        'title': 'QC Quality metrics for QC List',
        'description': 'Listing of QC Quality Metrics for QC List.',
    })
class QualityMetricQclist(QualityMetric):
    """Subclass of quality matrics for QCList"""
    item_type = 'quality_metric_qclist'
    schema = load_schema('encoded:schemas/quality_metric_qclist.json')
    embedded_list = QualityMetric.embedded_list


@collection(
    name='quality-metrics-cmphet',
    properties={
        'title': 'Compound Het Quality Metrics',
        'description': 'Listing of Compound Het Quality Metrics'
    })
class QualityMetricCmphet(QualityMetric):
    """Subclass of quality matrics for compound hets"""

    item_type = 'quality_metric_cmphet'
    schema = load_schema('encoded:schemas/quality_metric_cmphet.json')
    embedded_list = QualityMetric.embedded_list


@collection(
    name='quality-metrics-vcfqc',
    properties={
        'title': 'QC Quality Metrics for VCF files',
        'description': 'Listing of QC Quality Metrics for VCF files'
    })
class QualityMetricVcfqc(QualityMetric):
    """Subclass of quality matrics for VCF files"""

    item_type = 'quality_metric_vcfqc'
    schema = load_schema('encoded:schemas/quality_metric_vcfqc.json')
    embedded_list = QualityMetric.embedded_list

    @calculated_property(schema=QC_SUMMARY_SCHEMA)
    def quality_metric_summary(self, request):
        qc = self.properties
        qc_summary = []
        
        def denovo_fraction(total, de_novo):
            '''calculate percentage of de_novo in total'''
            if total < 0:
                return -1
            return round((int(de_novo) / int(total)) * 100 * 1000) / 1000

        if 'transition-transversion ratio' in qc:
            # full set
            for tv in qc.get("total variants"):
                qc_summary.append({"title": "Total Variants Called",
                                   "sample": tv.get("name"),
                                   "value": str(tv.get("total")),
                                   "numberType": "integer"})

            for ttr in qc.get("transition-transversion ratio"):
                qc_summary.append({"title": "Transition-Transversion Ratio",
                                   "sample": ttr.get("name"),
                                   "value": str(ttr.get("ratio")),
                                   "numberType": "float"})

            for hr in qc.get("heterozygosity ratio"):
                qc_summary.append({"title": "Heterozygosity Ratio",
                                   "sample": hr.get("name"),
                                   "value": str(hr.get("ratio")),
                                   "tooltip": "Het/Homo ratio",
                                   "numberType": "float"})
 
            for me in qc.get("mendelian errors in trio", {}).get("SNV"):
                total = me.get("counts", {}).get("het", {}).get("total")
                de_novo = me.get("counts", {}).get("het", {}).get("de_novo")
                qc_summary.append({"title": "De Novo Fraction",
                                   "sample": me.get("name"),
                                   "value": str(denovo_fraction(total, de_novo)),
                                   "tooltip": "Fraction of GATK-based de novo mutations among heterozygous SNVs",
                                   "numberType": "percent"})
        else:
        # filtered set
            for tv in qc.get("total variants"):
                qc_summary.append({"title": "Filtered Variants",
                                   "sample": tv.get("name"),
                                   "value": str(tv.get("total")),
                                   "tooltip": "Exonic and splice variants, clinvar pathogenic" +
                                              "/Likely Pathogenic or conflicting submissions, spliceAI>0.2," +
                                              "not seen in 2 individuals among a set of 20 unrelated samples",
                                   "numberType": "integer"})

        return qc_summary

