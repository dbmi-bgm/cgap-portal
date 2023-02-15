import pytest
from encoded.ingestion_message import IngestionMessage
from encoded.ingestion_listener_base import IngestionListenerBase
from encoded.ingestion_message_handler_decorator import (
    call_ingestion_message_handler,
    ingestion_message_handler,
    for_testing_clear_ingestion_message_handlers,
)


class IngestionListener(IngestionListenerBase):
    pass # dummy


SOME_UUID = "some-uuid-xyzzy"
INGESTION_LISTENER = IngestionListener()
INGESTION_TYPE_VCF = "vcf"
INGESTION_TYPE_NOVCF = "novcf"


def create_raw_message(ingestion_type: str, unprocessed: str = None) -> dict:
    return {"Body": f"{{\"uuid\":\"{SOME_UUID}\", \"ingestion_type\":\"{ingestion_type}\"}}"}


def test_ingestion_message_handler_decorator_bad_decorator_arguments():

    with pytest.raises(Exception):
        @ingestion_message_handler(123)  # wrong decorator arg type
        def bad_g(message, listener):
            pass

    with pytest.raises(Exception):
        @ingestion_message_handler("vcf", 123)  # too many decorator args
        def bad_g(message, listener):
            pass

    with pytest.raises(Exception):
        @ingestion_message_handler(xyzzy="vcf")  # unknown named decorator kwarg
        def bad_g(message, listener):
            pass

    with pytest.raises(Exception):
        @ingestion_message_handler("vcf", ingestion_type="vcf")  # too many decorator args
        def bad_g(message, listener):
            pass


def test_ingestion_message_handler_decorator_bad_decorated_function_signature():

    with pytest.raises(Exception):
        @ingestion_message_handler
        def bad_a():  # not enough args
            pass

    with pytest.raises(Exception):
        @ingestion_message_handler
        def bad_b(message):  # not enough args
            pass

    with pytest.raises(Exception):
        @ingestion_message_handler
        def bad_c(message, listener, extraneous_arg):  # too many args
            pass

    with pytest.raises(Exception):
        @ingestion_message_handler
        def bad_d(message: IngestionMessage, listener: str):  # wrong type arg
            pass

    with pytest.raises(Exception):
        @ingestion_message_handler
        def bad_e(message: str, listener):  # wrong type arg
            pass

    with pytest.raises(Exception):
        @ingestion_message_handler
        def bad_f(message: str, listener: str):  # wrong type args
            pass


def test_ingestion_message_handler_decorator_bad_duplicate_default_handlers():

    with pytest.raises(Exception):
        @ingestion_message_handler
        def a(message, listener):
            pass
        @ingestion_message_handler  # same as above (i.e. default)
        def duplicate_a(message, listener):
            pass


def test_ingestion_message_handler_decorator_bad_duplicate_type_handlers():

    with pytest.raises(Exception):
        @ingestion_message_handler("some-message-type")
        def a(message, listener):
            pass
        @ingestion_message_handler("some-message-type")  # same as above
        def duplicate_a(message, listener):
            pass


def test_ingestion_message_handler_decorator_one():

    for_testing_clear_ingestion_message_handlers()

    handler_calls = None

    @ingestion_message_handler
    def a(message: IngestionMessage, listener: IngestionListener):
        this_function_name = "a"
        result = f"{this_function_name}/{message.type}"
        handler_calls.add(result)
        assert message.is_type(INGESTION_TYPE_VCF) or message.is_type(INGESTION_TYPE_NOVCF)
        assert message.uuid == SOME_UUID
        assert listener is INGESTION_LISTENER
        return result

    @ingestion_message_handler(ingestion_type=INGESTION_TYPE_VCF)
    def b(message: IngestionMessage, listener: IngestionListener):
        this_function_name = "b"
        result = f"{this_function_name}/{message.type}"
        handler_calls.add(result)
        assert message.is_type(INGESTION_TYPE_VCF)
        assert message.uuid == SOME_UUID
        assert listener is INGESTION_LISTENER
        return result

    handler_calls = set()
    ingestion_message = create_raw_message(ingestion_type=INGESTION_TYPE_NOVCF)
    result = call_ingestion_message_handler(ingestion_message, INGESTION_LISTENER)
    assert result == f"a/{IngestionMessage(ingestion_message).type}"
    assert handler_calls == {f"a/{IngestionMessage(ingestion_message).type}"}

    handler_calls = set()
    ingestion_message = create_raw_message(ingestion_type=INGESTION_TYPE_VCF)
    result = call_ingestion_message_handler(ingestion_message, INGESTION_LISTENER)
    assert result == f"b/{IngestionMessage(ingestion_message).type}"
    assert handler_calls == {f"b/{IngestionMessage(ingestion_message).type}"}
