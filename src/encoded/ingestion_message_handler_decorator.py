from dcicutils.misc_utils import ignored, PRINT
from ingestion_message import IngestionMessage


_ingestion_message_handlers = []


def ingestion_message_handlers():
    """
    Resturns a list of all registered ingestion message handler functions.
    Example usage is like this:

        listener = get_reference_to_your_ingestion_listener()
        message = get_next_ingestion_message()
        for handler in ingestion_message_handlers():
            if handler(message, listener):
                ingestion_listener.discard_message()
    """
    return _ingestion_message_handlers


def ingestion_message_handler(f=None, *decorator_args, **decorator_kwargs):
    """
    Decorator for ingestion message handlers to be used for example like this:

        @ingestion_message_handler
        your_ingester_message_handler(message: IngestionMessage, listener: IngestionLister) -> bool:
            return handle_message_returning_true_if_interested_and_successful_otherwise_false()

    Although any function may be annotated with this decorator, at this time and
    for our purposes it is expected to have a signature as show in the example above;
    this is not enforced at this time but may well be in the future.

    In addition, you can pass an type argument to the decorator to limit the call of the
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

    Once registered the ingestion_message_handlers function in this module, above,
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


@ingestion_message_handler
def f(message, listener):
    print('helo/f')
    print(message.to_dict())

@ingestion_message_handler(ingestion_type="vcf")
def g(message, listener):
    print('helo/g')
    print(message.to_dict())

def xyzzy(message: IngestionMessage):
    return not message.is_type("vcf")

@ingestion_message_handler(type=lambda message: not message.is_type("vcf"))
def h(message, listener):
    print('helo/h')
    print(message.to_dict())

@ingestion_message_handler(lambda message: xyzzy(message))
def i(message, listener):
    print('helo/i')
    print(message.to_dict())

print()
print('calling with vcf message')
raw_message = {"Body": "{\"uuid\":\"someuuid\",\"ingestion_type\":\"vcf\"}"}
message = IngestionMessage(raw_message)
for handler in ingestion_message_handlers():
    handler(message, None)
print()
print('calling with non-vcf message')
raw_message = {"Body": "{\"uuid\":\"someuuid\",\"ingestion_type\":\"someothertype\"}"}
message = IngestionMessage(raw_message)
for handler in ingestion_message_handlers():
    handler(message, None)

