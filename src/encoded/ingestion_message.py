import json


class IngestionMessage:

    TYPE_VCF = "vcf"

    def __init__(self, raw_message: dict) -> None:
        self.body = json.loads(raw_message["Body"]) or {}
        self.uuid = self.body["uuid"] or ""
        self.type = self.body.get("ingestion_type", "vcf").strip().lower()

    def is_type(self, value: str) -> bool:
        return isinstance(value, str) and self.type == value.lower()

    def is_vcf(self) -> bool:
        return self.is_type(self.TYPE_VCF)
