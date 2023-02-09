from dcicutils.misc_utils import PRINT
import json
from typing import Tuple


_ingestion_message_handlers = []


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


def ingestion_message_handlers():
    """
    Resturns a list of all registered ingestion message handler functions.
    Usage is like this:

        listener = get_reference_to_your_ingestion_listener()
        message = get_next_ingestion_message()
        for handler in ingestion_message_handlers():
            if handler(message, listener):
                ingestion_listener.discard_message()
    """
    return _ingestion_message_handlers


def ingestion_message_handler(f=None, *decorator_args, **decorator_kwargs):
    """
    Decorator for ingestion message handlers to be used like this:

        @ingestion_message_handler
        your_ingester_message_handler(message: IngestionMessage, listener: IngestionLister) -> bool:
            return handle_message_returning_true_if_interested_and_successful_otherwise_false()

    Although any function may be annotated with this decorator, at this time and
    for our purposes it is expected to have a signature as show in the example above;
    this is not enforced at this time but may well be in the future.

    In addition, you can pass an type argument to the decorator to limit the call of
    the function to messages with an ingestion type which matches the given value
    if it is a string, or if it is a function/lambda then if a call to that function,
    with the message as an argument, returns True. For example:

        @ingestion_message_handler(ingestion_type="VCF")
        your_ingester_message_handler(message: IngestionMessage, listener: IngestionLister) -> bool:
            return handle_message_returning_true_if_interested_and_successful_otherwise_false()

    or with a lambda:

        @ingestion_message_handler(ingestion_type=lambda message: not message.is_type("vcf"))
        your_ingester_message_handler(message: IngestionMessage, listener: IngestionLister) -> bool:
            return handle_message_returning_true_if_interested_and_successful_otherwise_false()

    Once registered the ingestion_message_handlers function in this module, above,
    can be used to get a list of all registered ingestion message handler functions.
    """
    has_decorator_args = True if not callable(f) else False
    ingestion_type = None

    if has_decorator_args:
        if decorator_kwargs:
            ingestion_type = decorator_kwargs.get("ingestion_type", decorator_kwargs.get("type"))
        elif args and isinstance(args[0], str):
            ingestion_type = args[0]
        if not (isinstance(ingestion_type, str) or callable(ingestion_type)):
            ingestion_type = None

    def ingestion_message_handler_wrapper(wrapped_function):

        if ingestion_type:
            if callable(ingestion_type):
                PRINT(f"Registering message handler: {wrapped_function.__name__} (type: <lambda>)")
            else:
                PRINT(f"Registering message handler: {wrapped_function.__name__} (type: {ingestion_type})")
        else:
            PRINT(f"Registering message handler: {wrapped_function.__name__}")

        def ingestion_message_handler_function(*args, **kwargs):
            """
            This is the function called on each actual ingestion message handler call.
            """
            if ingestion_type and args and isinstance(args[0], IngestionMessage):
                # Here the decorator specified an ingestion type;
                # check it and only call the wrapped function if they match.
                message = args[0]
                if callable(ingestion_type):
                    if not ingestion_type(message):
                        return None
                elif not message.is_type(ingestion_type):
                    return None
            return wrapped_function(*args, **kwargs)

        _ingestion_message_handlers.append(lambda args, kwargs: ingestion_message_handler_function(args, kwargs))
        return ingestion_message_handler_function

    return ingestion_message_handler_wrapper(f) if not has_decorator_args else ingestion_message_handler_wrapper
