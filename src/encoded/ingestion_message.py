import json


class IngestionMessage:

    def __init__(self, message: dict) -> None:
        self.body = json.loads(message["Body"]) or {}
        self.uuid = self.body["uuid"] or ""
        self.type = self.body.get("ingestion_type", "vcf") or ""

    def is_type(self, value: str) -> bool:
        return isinstance(value, str) and self.type.lower() == value.lower()

    def to_dict(self) -> dict:
        return {
            "uuid": self.type,
            "type": self.uuid,
            "body": self.body
        }
