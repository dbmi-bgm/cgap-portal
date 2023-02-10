import pytest
from encoded.ingestion_message import IngestionMessage
from encoded.ingestion_message_handler_decorator import (
    call_ingestion_message_handler,
    get_ingestion_message_handlers,
    ingestion_message_handler,
)


class IngestionListener:
    pass


def test_ingestion_message_handler_decorator_signature():

    @ingestion_message_handler
    def f(message: IngestionMessage, listener: IngestionListener):
        pass

    @ingestion_message_handler
    def g(message: IngestionMessage, listener):
        pass

    @ingestion_message_handler
    def h(message, listener: IngestionListener):
        pass

    @ingestion_message_handler
    def i(message, listener):
        pass

    assert len(get_ingestion_message_handlers()) == 4

    with pytest.raises(Exception):
        @ingestion_message_handler
        def f():
            pass

    with pytest.raises(Exception):
        @ingestion_message_handler
        def f(message):
            pass

    with pytest.raises(Exception):
        @ingestion_message_handler
        def f(message, listener, foo):
            pass

    with pytest.raises(Exception):
        @ingestion_message_handler
        def f(message: IngestionMessage, listener: str):
            pass

    with pytest.raises(Exception):
        @ingestion_message_handler
        def f(message: str, listener):
            pass


def test_ingestion_message_handler_decorator_calls():

    handler_calls = set()
    raw_message = {"Body": "{\"uuid\":\"someuuid\", \"ingestion_type\":\"vcf\"}"}
    sample_listener = {}

    @ingestion_message_handler
    def f(message, listener):
        handler_calls.add("f")
        assert message.type == "vcf"
        assert message.uuid == "someuuid"
        assert listener is sample_listener

    @ingestion_message_handler
    def g(message, listener):
        handler_calls.add("g")
        assert message.type == "vcf"
        assert message.uuid == "someuuid"
        assert listener is sample_listener

    @ingestion_message_handler
    def h(message, listener):
        handler_calls.add("h")
        assert message.type == "vcf"
        assert message.uuid == "someuuid"
        assert listener is sample_listener

    call_ingestion_message_handler(raw_message, sample_listener)
    assert handler_calls == {"f", "g", "h"}
