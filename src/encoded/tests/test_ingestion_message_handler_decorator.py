import pytest
from encoded.ingestion_message import IngestionMessage
from encoded.ingestion_listener_base import IngestionListenerBase
from encoded.ingestion_message_handler_decorator import (
    call_ingestion_message_handler,
    clear_ingestion_message_handlers,
    get_ingestion_message_handlers,
    ingestion_message_handler,
)


class IngestionListener(IngestionListenerBase):
    pass # dummy


SOME_UUID = "some-uuid-xyzzy"
INGESTION_LISTENER = IngestionListener()
INGESTION_TYPE_VCF = "vcf"
INGESTION_TYPE_NOVCF = "novcf"


def create_raw_message(ingestion_type: str, unprocessed: str = None) -> dict:
    if unprocessed:
        # For testing this is a comma-separated list of handler function names
        # indicating the handler function should return False rather than True;
        # this False will indicate, to call_ingestion_message_handler, that the message
        # was not processed and the ingestion message handler call loop should continue.
        return {"Body": f"{{\"uuid\":\"{SOME_UUID}\", \"ingestion_type\":\"{ingestion_type}\",\"unprocessed\":\"{unprocessed}\"}}"}
    else:
        return {"Body": f"{{\"uuid\":\"{SOME_UUID}\", \"ingestion_type\":\"{ingestion_type}\"}}"}


def message_processed(message: IngestionMessage, function: str) -> bool:
    return not message_unprocessed(message, function)


def message_unprocessed(message: IngestionMessage, function: str) -> bool:
    return isinstance(message.body.get("unprocessed"), str) and function in message.body["unprocessed"]


def test_ingestion_message_handler_decorator_bad_signature():

    with pytest.raises(Exception):
        @ingestion_message_handler
        def bad_a():
            pass

    with pytest.raises(Exception):
        @ingestion_message_handler
        def bad_b(message):
            pass

    with pytest.raises(Exception):
        @ingestion_message_handler
        def bad_c(message, listener, foo):
            pass

    with pytest.raises(Exception):
        @ingestion_message_handler
        def bad_d(message: IngestionMessage, listener: str):
            pass

    with pytest.raises(Exception):
        @ingestion_message_handler
        def bad_e(message: str, listener):
            pass

    with pytest.raises(Exception):
        @ingestion_message_handler
        def bad_f(message, listener) -> None:
            pass

    with pytest.raises(Exception):
        @ingestion_message_handler
        def bad_g(message, listener) -> str:
            pass


def test_ingestion_message_handler_decorator():

    handler_calls = set()

    @ingestion_message_handler
    def a(message: IngestionMessage, listener: IngestionListener) -> bool:
        this_function_name = "a"
        handler_calls.add(f"{this_function_name}/{message.type}")
        assert message.is_type(INGESTION_TYPE_VCF) or message.is_type("novcf")
        assert message.uuid == SOME_UUID
        assert listener is INGESTION_LISTENER
        return message_processed(message, this_function_name)

    @ingestion_message_handler
    def b(message: IngestionMessage, listener: IngestionListener):
        this_function_name = "b"
        handler_calls.add(f"{this_function_name}/{message.type}")
        assert message.is_type(INGESTION_TYPE_VCF) or message.is_type("novcf")
        assert message.uuid == SOME_UUID
        assert listener is INGESTION_LISTENER
        return message_processed(message, this_function_name)

    @ingestion_message_handler
    def c(message: IngestionMessage, listener):
        this_function_name = "c"
        handler_calls.add(f"{this_function_name}/{message.type}")
        assert message.is_type(INGESTION_TYPE_VCF) or message.is_type("novcf")
        assert message.uuid == SOME_UUID
        assert listener is INGESTION_LISTENER
        return message_processed(message, this_function_name)

    @ingestion_message_handler
    def d(message, listener: IngestionListener):
        this_function_name = "d"
        handler_calls.add(f"{this_function_name}/{message.type}")
        assert message.is_type(INGESTION_TYPE_VCF) or message.is_type("novcf")
        assert message.uuid == SOME_UUID
        assert listener is INGESTION_LISTENER
        return message_processed(message, this_function_name)

    @ingestion_message_handler
    def e(message, listener):
        this_function_name = "e"
        handler_calls.add(f"{this_function_name}/{message.type}")
        assert message.is_type(INGESTION_TYPE_VCF) or message.is_type("novcf")
        assert message.uuid == SOME_UUID
        assert listener is INGESTION_LISTENER
        return message_processed(message, this_function_name)

    @ingestion_message_handler(INGESTION_TYPE_VCF)
    def f(message, listener):
        this_function_name = "f"
        handler_calls.add(f"{this_function_name}/{message.type}")
        assert message.is_type(INGESTION_TYPE_VCF)
        assert message.uuid == SOME_UUID
        assert listener is INGESTION_LISTENER
        return message_processed(message, this_function_name)

    @ingestion_message_handler(ingestion_type=INGESTION_TYPE_VCF)
    def g(message, listener):
        this_function_name = "g"
        handler_calls.add(f"{this_function_name}/{message.type}")
        assert message.is_type(INGESTION_TYPE_VCF)
        assert message.uuid == SOME_UUID
        assert listener is INGESTION_LISTENER
        return message_processed(message, this_function_name)

    @ingestion_message_handler(type=INGESTION_TYPE_VCF)
    def h(message, listener):
        this_function_name = "h"
        handler_calls.add(f"{this_function_name}/{message.type}")
        assert message.is_type(INGESTION_TYPE_VCF)
        assert message.uuid == SOME_UUID
        assert listener is INGESTION_LISTENER
        return message_processed(message, this_function_name)

    @ingestion_message_handler(ingestion_type=lambda message: not message.is_type(INGESTION_TYPE_VCF))
    def i(message, listener):
        this_function_name = "i"
        handler_calls.add(f"{this_function_name}/{message.type}")
        assert not message.is_type(INGESTION_TYPE_VCF)
        assert message.uuid == SOME_UUID
        assert listener is INGESTION_LISTENER
        return message_processed(message, this_function_name)

    @ingestion_message_handler(ingestion_type=lambda message: not message.is_type(INGESTION_TYPE_VCF))
    def j(message, listener):
        this_function_name = "j"
        handler_calls.add(f"{this_function_name}/{message.type}")
        assert not message.is_type(INGESTION_TYPE_VCF)
        assert message.uuid == SOME_UUID
        assert listener is INGESTION_LISTENER
        return message_processed(message, this_function_name)

    assert len(get_ingestion_message_handlers()) == 10

    # Note we rely on handlers being called in order of definition just for testing;
    # in real life such ordering should not be relied upon; though actually in
    # real life we may not even use this functionality of multiple handlers being
    # called for a message via the return of a non-True value from the handler,
    # i.e.  the stuff that this "unprocessed" feature supports in these tests.

    handler_calls = set()
    ingestion_message = create_raw_message(ingestion_type=INGESTION_TYPE_VCF)
    result = call_ingestion_message_handler(ingestion_message, INGESTION_LISTENER)
    assert result is True
    assert handler_calls == {"a/vcf"}

    handler_calls = set()
    ingestion_message = create_raw_message(ingestion_type=INGESTION_TYPE_VCF, unprocessed="a")
    result = call_ingestion_message_handler(ingestion_message, INGESTION_LISTENER)
    assert result is True
    assert handler_calls == {"a/vcf", "b/vcf"}

    handler_calls = set()
    ingestion_message = create_raw_message(ingestion_type=INGESTION_TYPE_VCF, unprocessed="a,b")
    result = call_ingestion_message_handler(ingestion_message, INGESTION_LISTENER)
    assert result is True
    assert handler_calls == {"a/vcf", "b/vcf", "c/vcf"}

    handler_calls = set()
    ingestion_message = create_raw_message(ingestion_type=INGESTION_TYPE_VCF, unprocessed="a,b,c")
    result = call_ingestion_message_handler(ingestion_message, INGESTION_LISTENER)
    assert result is True
    assert handler_calls == {"a/vcf", "b/vcf", "c/vcf", "d/vcf"}

    handler_calls = set()
    ingestion_message = create_raw_message(ingestion_type=INGESTION_TYPE_VCF, unprocessed="a,b,c,d")
    result = call_ingestion_message_handler(ingestion_message, INGESTION_LISTENER)
    assert result is True
    assert handler_calls == {"a/vcf", "b/vcf", "c/vcf", "d/vcf", "e/vcf"}

    handler_calls = set()
    ingestion_message = create_raw_message(ingestion_type=INGESTION_TYPE_VCF, unprocessed="a,b,c,d,e")
    result = call_ingestion_message_handler(ingestion_message, INGESTION_LISTENER)
    assert result is True
    assert handler_calls == {"a/vcf", "b/vcf", "c/vcf", "d/vcf", "e/vcf", "f/vcf"}

    handler_calls = set()
    ingestion_message = create_raw_message(ingestion_type=INGESTION_TYPE_VCF, unprocessed="a,b,c,d,e,f")
    result = call_ingestion_message_handler(ingestion_message, INGESTION_LISTENER)
    assert result is True
    assert handler_calls == {"a/vcf", "b/vcf", "c/vcf", "d/vcf", "e/vcf", "f/vcf", "g/vcf"}

    handler_calls = set()
    ingestion_message = create_raw_message(ingestion_type=INGESTION_TYPE_VCF, unprocessed="a,b,c,d,e,f,g")
    result = call_ingestion_message_handler(ingestion_message, INGESTION_LISTENER)
    assert result is True
    assert handler_calls == {"a/vcf", "b/vcf", "c/vcf", "d/vcf", "e/vcf", "f/vcf", "g/vcf", "h/vcf"}

    handler_calls = set()
    ingestion_message = create_raw_message(ingestion_type=INGESTION_TYPE_VCF, unprocessed="a,b,c,d,e,f,g,h")
    result = call_ingestion_message_handler(ingestion_message, INGESTION_LISTENER)
    assert result is False
    assert handler_calls == {"a/vcf", "b/vcf", "c/vcf", "d/vcf", "e/vcf", "f/vcf", "g/vcf", "h/vcf"}

    handler_calls = set()
    ingestion_message = create_raw_message(ingestion_type=INGESTION_TYPE_NOVCF, unprocessed="a,b,c,d,e")
    result = call_ingestion_message_handler(ingestion_message, INGESTION_LISTENER)
    assert result is True
    assert handler_calls == {"a/novcf", "b/novcf", "c/novcf", "d/novcf", "e/novcf", "i/novcf"}

    handler_calls = set()
    ingestion_message = create_raw_message(ingestion_type=INGESTION_TYPE_NOVCF, unprocessed="a,b,c,d,e,i")
    result = call_ingestion_message_handler(ingestion_message, INGESTION_LISTENER)
    assert result is True
    assert handler_calls == {"a/novcf", "b/novcf", "c/novcf", "d/novcf", "e/novcf", "i/novcf", "j/novcf"}
