from snovault import collection, load_schema

from .quality_metric import QualityMetric


@collection(
    name="quality-metrics-generic",
    properties={
        "title": "Generic Quality Metrics",
        "description": "Listing of Generic Quality Metrics",
    },
)
class QualityMetricGeneric(QualityMetric):

    item_type = "quality_metric_generic"
    schema = load_schema("encoded:schemas/quality_metric_generic.json")
    embedded_list = QualityMetric.embedded_list
