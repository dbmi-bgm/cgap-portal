import pytest
from encoded.ingestion_message import IngestionMessage
from encoded.ingestion_message_handler_decorator import (
    call_ingestion_message_handler,
    get_ingestion_message_handlers,
    ingestion_message_handler,
)


class IngestionListener:
    pass # dummy


some_uuid = "some-uuid-xyzzy"
ingestion_listener = IngestionListener()


def create_raw_message(ingestion_type: str, unprocessed: str = None) -> dict:
    if unprocessed:
        # For testing this is a comma-separted list of handler function names
        # indicating the handler function should return False rather than True.
        return {"Body": f"{{\"uuid\":\"{some_uuid}\", \"ingestion_type\":\"{ingestion_type}\",\"unprocessed\":\"{unprocessed}\"}}"}
    else:
        return {"Body": f"{{\"uuid\":\"{some_uuid}\", \"ingestion_type\":\"{ingestion_type}\"}}"}


def message_processed(message: IngestionMessage, function: str) -> bool:
    return not message_unprocessed(message, function)


def message_unprocessed(message: IngestionMessage, function: str) -> bool:
    return isinstance(message.body.get("unprocessed"), str) and function in message.body["unprocessed"]


def test_ingestion_message_handler_decorator_bad_signature():

    with pytest.raises(Exception):
        @ingestion_message_handler
        def bad_f():
            pass

    with pytest.raises(Exception):
        @ingestion_message_handler
        def bad_g(message):
            pass

    with pytest.raises(Exception):
        @ingestion_message_handler
        def bad_h(message, listener, foo):
            pass

    with pytest.raises(Exception):
        @ingestion_message_handler
        def bad_i(message: IngestionMessage, listener: str):
            pass

    with pytest.raises(Exception):
        @ingestion_message_handler
        def bad_j(message: str, listener):
            pass

    with pytest.raises(Exception):
        @ingestion_message_handler
        def bad_k(message, listener) -> None:
            pass

    with pytest.raises(Exception):
        @ingestion_message_handler
        def bad_k(message, listener) -> str:
            pass


def test_ingestion_message_handler_decorator():

    handler_calls = set()

    @ingestion_message_handler
    def a(message: IngestionMessage, listener: IngestionListener) -> bool:
        this_function_name = "a"
        handler_calls.add(f"{this_function_name}/{message.type}")
        assert message.is_type("vcf") or message.is_type("xyz")
        assert message.uuid == some_uuid
        assert listener is ingestion_listener
        return message_processed(message, this_function_name)

    @ingestion_message_handler
    def b(message: IngestionMessage, listener: IngestionListener):
        this_function_name = "b"
        handler_calls.add(f"{this_function_name}/{message.type}")
        assert message.is_type("vcf") or message.is_type("xyz")
        assert message.uuid == some_uuid
        assert listener is ingestion_listener
        return message_processed(message, this_function_name)

    @ingestion_message_handler
    def c(message: IngestionMessage, listener):
        this_function_name = "c"
        handler_calls.add(f"{this_function_name}/{message.type}")
        assert message.is_type("vcf") or message.is_type("xyz")
        assert message.uuid == some_uuid
        assert listener is ingestion_listener
        return message_processed(message, this_function_name)

    @ingestion_message_handler
    def d(message, listener: IngestionListener):
        this_function_name = "d"
        handler_calls.add(f"{this_function_name}/{message.type}")
        assert message.is_type("vcf") or message.is_type("xyz")
        assert message.uuid == some_uuid
        assert listener is ingestion_listener
        return message_processed(message, this_function_name)

    @ingestion_message_handler
    def e(message, listener):
        this_function_name = "d"
        handler_calls.add(f"{this_function_name}/{message.type}")
        assert message.is_type("vcf") or message.is_type("xyz")
        assert message.uuid == some_uuid
        assert listener is ingestion_listener
        return message_processed(message, this_function_name)

    @ingestion_message_handler("VCF")
    def f(message, listener):
        this_function_name = "f"
        handler_calls.add(f"{this_function_name}/{message.type}")
        assert message.is_type("vcf")
        assert message.uuid == some_uuid
        assert listener is ingestion_listener
        return message_processed(message, this_function_name)

    @ingestion_message_handler(ingestion_type="vcf")
    def g(message, listener):
        this_function_name = "g"
        handler_calls.add(f"{this_function_name}/{message.type}")
        assert message.is_type("VCF")
        assert message.uuid == some_uuid
        assert listener is ingestion_listener
        return message_processed(message, this_function_name)

    @ingestion_message_handler(type="vcf")
    def h(message, listener):
        this_function_name = "h"
        handler_calls.add(f"{this_function_name}/{message.type}")
        assert message.is_type("vcf")
        assert message.uuid == some_uuid
        assert listener is ingestion_listener
        return message_processed(message, this_function_name)

    @ingestion_message_handler(ingestion_type=lambda message: not message.is_type("vcf"))
    def i(message, listener):
        this_function_name = "i"
        handler_calls.add(f"{this_function_name}/{message.type}")
        assert not message.is_type("vcf")
        assert message.uuid == some_uuid
        assert listener is ingestion_listener
        return message_processed(message, this_function_name)

    assert len(get_ingestion_message_handlers()) == 9

    handler_calls = set()
    raw_message = create_raw_message(ingestion_type="vcf", unprocessed="a")
    print(raw_message)
    message = IngestionMessage(raw_message)
    print(message)
    print(message.body)
    print(message.body.get("unprocessed"))
    call_ingestion_message_handler(message, ingestion_listener)
    print(handler_calls)
    #print('xyzzy')
    #print(handler_calls)
    #assert handler_calls == {"a/vcf", "b/vcf", "c/vcf", "d/vcf", "e/vcf", "f/vcf", "g/vcf", "h/vcf"}

    #handler_calls = set()
    #call_ingestion_message_handler(raw_message_novcf, ingestion_listener)
    #assert handler_calls == {"a/xyz", "b/xyz", "c/xyz", "d/xyz", "i/xyz"}
