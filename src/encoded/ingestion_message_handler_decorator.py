from dcicutils.misc_utils import ignored, PRINT
from ingestion_message import IngestionMessage
import inspect

_ingestion_message_handlers = []


def get_ingestion_message_handlers():
    """
    Resturns a list of all registered ingestion message handler functions.
    Example usage is like this:

        listener: IngestionListener = get_reference_to_your_ingestion_listener()
        message: IngestionMessage = IngestionMessage(get_next_raw_ingestion_message())
        for handler in get_ingestion_message_handlers():
            handler(message, listener)
    """
    return _ingestion_message_handlers


def ingestion_message_handler(f=None, *decorator_args, **decorator_kwargs):
    """
    Decorator for ingestion message handlers to be used for example like this:

        @ingestion_message_handler
        your_ingester_message_handler(message: IngestionMessage, listener: IngestionLister) -> bool:
            return handle_message_returning_true_if_interested_and_successful_otherwise_false()

    Although any function may be annotated with this decorator, at this time and for our purposes
    it is expected to have a signature as show in the example above; this IS enforced to some extent.

    In addition, you can pass an type argument to the decorator to LIMIT the call of the
    decorated function to messages with an ingestion type which matches the given value
    if it is a string, or if it is a function/lambda then iff a call to that function,
    with the message as an argument, returns True. For example:

        @ingestion_message_handler(type="VCF")
        your_ingester_message_handler(message: IngestionMessage, listener: IngestionLister) -> bool:
            return handle_message_returning_true_if_interested_and_successful_otherwise_false()

    or with a lambda:

        @ingestion_message_handler(type=lambda message: not message.is_type("vcf"))
        your_ingester_message_handler(message: IngestionMessage, listener: IngestionLister) -> bool:
            return handle_message_returning_true_if_interested_and_successful_otherwise_false()

    Once registered the get_ingestion_message_handlers function in this module, above,
    can be used to get a list of all registered ingestion message handler functions.
    """
    ignored(decorator_args)
    has_decorator_args = True if not callable(f) or f.__name__ == "<lambda>" else False
    ingestion_type = None

    if has_decorator_args:
        if isinstance(f, str):
            ingestion_type = f
        if decorator_kwargs:
            ingestion_type = decorator_kwargs.get("ingestion_type", decorator_kwargs.get("type"))
        if not (isinstance(ingestion_type, str) or callable(ingestion_type)):
            ingestion_type = None

    def ingestion_message_handler_wrapper(wrapped_function):

        # Check the signature of the ingestion message handler function.
        # it should contain two arguments with either no type hints/annotations or if
        # present then they should be for IngestionMessage and IngestionListener, respectively.
        wrapped_function_signature = inspect.signature(wrapped_function)
        if len(wrapped_function_signature.parameters) < 2:
            raise Exception(f"Too few arguments (need two) for ingestion handler function: {wrapped_function.__name__}")
        if len(wrapped_function_signature.parameters) > 2:
            raise Exception(f"Too many arguments (need two) for ingestion handler function: {wrapped_function.__name__}")
        return_annotation = wrapped_function_signature.return_annotation
        if not return_annotation or (return_annotation.__name__ != "_empty" and return_annotation.__name__ != "bool"):
            raise Exception(f"Wrong return value type (need unspecified or bool) "
                            f"for ingestion handler function: {wrapped_function.__name__}")
        parameters = iter(wrapped_function_signature.parameters.items())
        first_parameter = next(parameters)
        if first_parameter and len(first_parameter) >= 2:
            first_parameter_annotation = first_parameter[1].annotation
            if not first_parameter_annotation or (first_parameter_annotation.__name__ != "_empty" and
                                                  first_parameter_annotation != IngestionMessage):
                raise Exception(f"Wrong first argument type (need unspecified or IngestionMessage) "
                                f"for ingestion handler function: {wrapped_function.__name__}")
        second_parameter = next(parameters)
        if second_parameter and len(second_parameter) >= 2:
            second_parameter_annotation = second_parameter[1].annotation
            if not second_parameter_annotation or (second_parameter_annotation.__name__ != "_empty" and
                                                   second_parameter_annotation.__name__ != "IngestionListener"):
                # We only check the for type name of the type of the second IngestionListener argument;
                # we cannot import the IngestionListener because would be a recursive import.
                raise Exception(f"Wrong second argument type (need unspecified or IngestionListener) "
                                f"for ingestion handler function: {wrapped_function.__name__}")
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
                        return False
                elif not message.is_type(ingestion_type):
                    return False
            return wrapped_function(*args, **kwargs)

        _ingestion_message_handlers.append(lambda args, kwargs: ingestion_message_handler_function(args, kwargs))
        return ingestion_message_handler_function

    return ingestion_message_handler_wrapper(f) if not has_decorator_args else ingestion_message_handler_wrapper


def call_ingestion_message_handler(message: IngestionMessage, listener) -> bool:
    """
    Calls at most one of the ingestion message handler functions registered via
    the @ingestion_message_handler decorator, for the given message, and listener.
    If a handler is called then returns True, otherwise False.

    Though NOTE that this "at most" is controlled by the handler function itself;
    if a handler function returns True it conveys that the message was handled,
    and that no more handlers should be called, and that it should be discarded
    from future processing; otherwise it is assumed the message was not handled,
    and further handlers should be called for the message, until one returns True.
    """
    if not isinstance(message, IngestionMessage):
        message = IngestionMessage(message)
    for handler in get_ingestion_message_handlers():
        if handler(message, listener) is True:
            return True
    return False
