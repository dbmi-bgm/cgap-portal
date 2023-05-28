from snovault.ingestion import ingestion_listener as snovault_ingestion_listener
from snovault.ingestion.ingestion_listener import IngestionListener, IngestionQueueManager, run
from . import ingestion_processors


def main():
    return snovault_ingestion_listener.main()
