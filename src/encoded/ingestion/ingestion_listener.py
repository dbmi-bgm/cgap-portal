from snovault.ingestion import ingestion_listener as snovault_ingestion_listener
from snovault.ingestion.ingestion_listener import IngestionListener, IngestionQueueManager, run  # noqa: F401 (imported but unused)
from . import ingestion_processors  # noqa: F401 (imported but unused)


def main():
    return snovault_ingestion_listener.main()
