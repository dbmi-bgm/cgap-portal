# Module containing the definition of the @ingestion_message_handler decorator used
# to globally register ingestion message handler functions, as well as functions to
# get the list of registered handler functions and to call them for a given message.

import inspect
from typing import Union
from dcicutils.misc_utils import ignored, PRINT
from encoded.ingestion_listener_base import IngestionListenerBase
from encoded.ingestion_message import IngestionMessage


# Dictionary (by ingestion type) of globally registered ingestion message handlers.
_ingestion_message_handlers = {}

_DEFAULT_INGESTION_MESSAGE_HANDLER_NAME = "<default>"


def ingestion_message_handler(f=None, *decorator_args, **decorator_kwargs):
    """
    Decorator to globally register ingestion message handlers, to be used for example like this:

      @ingestion_message_handler
      def your_ingester_message_handler(message: IngestionMessage, listener: IngestionListener) -> bool:
          return handle_message_returning_true_if_processed_otherwise_false()

    Although any function may be annotated with this decorator, at this time and for our purposes
    it is expected to have a signature as show in the example above; this IS enforced to some extent.

    In addition, you can pass an ingestion_type argument to the decorator to LIMIT the call of the
    decorated handler function to messages with an ingestion type which matches the specified string value.
    For example, to define a message handler to be called ONLY for message types which are "vcf":

      @ingestion_message_handler(ingestion_type="vcf")
      def your_ingester_message_handler(message: IngestionMessage, listener: IngestionListener) -> bool:
          return handle_message_returning_true_if_processed_otherwise_false()

    Note that ingestion type names are treated as case-insenstive.
    """
    ignored(decorator_args)
    has_decorator_args = True if not callable(f) or f.__name__ == "<lambda>" else False
    ingestion_type = None

    if has_decorator_args:
        if f is not None:
            decorator_args = (f, *decorator_args)
        if len(decorator_args) + len(decorator_kwargs) > 1:
            raise ValueError(f"Invalid @ingestion_message_handler decorator usage (takes at most one argument).")
        if len(decorator_args) == 1:
            ingestion_type = decorator_args[0]
        else:
            ingestion_type = decorator_kwargs.get("ingestion_type", decorator_kwargs.get("type"))
        if not (ingestion_type is None or isinstance(ingestion_type, str)):
            raise ValueError(f"Invalid @ingestion_message_handler decorator usage (argument must be ingestion type string).")
        ingestion_type = ingestion_type.strip().lower()
    if not ingestion_type or ingestion_type == "default":
        ingestion_type = _DEFAULT_INGESTION_MESSAGE_HANDLER_NAME

    def ingestion_message_handler_wrapper(wrapped_function):

        if ingestion_type in _ingestion_message_handlers:
            raise ValueError(f"Ingestion message handler already defined for ingestion type: {ingestion_type}")

        # Sanity check the signature of the decorated ingestion message handler function.
        # It should contain two arguments with either no type annotations or if present
        # then they should be for IngestionMessage and IngestionListener, respectively;
        # and if it contains a return value annotation, it should be of type bool.
        wrapped_function_signature = inspect.signature(wrapped_function)
        if len(wrapped_function_signature.parameters) < 2:
            raise ValueError(f"Too few arguments (need two) "
                             f"for ingestion handler function: {wrapped_function.__name__}")
        if len(wrapped_function_signature.parameters) > 2:
            raise ValueError(f"Too many arguments (need two) "
                             f"for ingestion handler function: {wrapped_function.__name__}")
        return_annotation = wrapped_function_signature.return_annotation
        if not return_annotation or (return_annotation.__name__ != "_empty" and
                                     return_annotation != bool):
            raise ValueError(f"Wrong return value type (need unspecified or bool) "
                             f"for ingestion handler function: {wrapped_function.__name__}")
        parameters = iter(wrapped_function_signature.parameters.items())
        first_parameter = next(parameters)
        if first_parameter and len(first_parameter) >= 2:
            first_parameter_annotation = first_parameter[1].annotation
            if not first_parameter_annotation or (first_parameter_annotation.__name__ != "_empty" and
                                                  not issubclass(first_parameter_annotation, IngestionMessage)):
                raise ValueError(f"Wrong first argument type (need unspecified or IngestionMessage) "
                                 f"for ingestion handler function: {wrapped_function.__name__}")
        second_parameter = next(parameters)
        if second_parameter and len(second_parameter) >= 2:
            second_parameter_annotation = second_parameter[1].annotation
            if not second_parameter_annotation or (second_parameter_annotation.__name__ != "_empty" and
                                                   not issubclass(second_parameter_annotation, IngestionListenerBase)):
                raise ValueError(f"Wrong second argument type (need unspecified or IngestionListener) "
                                 f"for ingestion handler function: {wrapped_function.__name__}")
        if ingestion_type:
            PRINT(f"Registering ingestion message handler: "
                  f"{wrapped_function.__name__} (type: {ingestion_type})")
        else:
            PRINT(f"Registering ingestion message handler: "
                  f"{wrapped_function.__name__} (type: {_DEFAULT_INGESTION_MESSAGE_HANDLER_NAME})")

        def ingestion_message_handler_function(*args, **kwargs):
            """
            This is the function called on each actual ingestion message handler call.
            """
            # Make sure the first argument is an IngestionMessage.
            message = args[0] if args and isinstance(args[0], IngestionMessage) else None
            if not message:
                raise ValueError(f"Argument passed to message handler not of type IngestionMessage!")
            # See if we should call this handler based on any ingestion_type specified in the decorator.
            PRINT(f"Checking message ({message.uuid}) type ({message.type}) for handler: {wrapped_function.__name__}")
            if ingestion_type and ingestion_type != _DEFAULT_INGESTION_MESSAGE_HANDLER_NAME:
                # Here the decorator specified an ingestion type;
                # check it and only call the wrapped function if they match.
                if not message.is_type(ingestion_type):
                    # Since the ingestion_type specified for the handler decorator is string
                    # which does not match the type of the message, then this message is NOT
                    # intended to be processed by this handler, it will not be called.
                    PRINT(f"Message ({message.uuid}) type ({message.type}) "
                          f"NOT intended for handler: {wrapped_function.__name__}")
                    return False
            # Here the handler decorator has no ingestion_type specifier or if it does
            # it indicates that this message IS intended to be processed by this handler
            # and we will call it here, returning its value, which, if truthy, indicates
            # that the message was actually processed, or if falsy, that it was not processed.
            # TODO MAYBE: Should we check that the second argument IngestionListenerBase?
            # TODO MAYBE: Should we allow a raw message here (like in call_ingestion_message_handler)?
            PRINT(f"Calling message ({message.uuid}) type ({message.type}) "
                  f"handler: {wrapped_function.__name__}")
            handler_result = wrapped_function(*args, **kwargs)
            PRINT(f"Called message ({message.uuid}) type ({message.type}) "
                  f"handler: {wrapped_function.__name__} -> {handler_result}")
            return handler_result

        # Register this handler for the ingestion type in our global dictionary.
        _ingestion_message_handlers[ingestion_type] = ingestion_message_handler_function

        return ingestion_message_handler_function

    return ingestion_message_handler_wrapper(f) if not has_decorator_args else ingestion_message_handler_wrapper


def call_ingestion_message_handler(message: Union[IngestionMessage, dict], listener) -> bool:
    """
    Calls the ingestion message handler function globally registered via the
    @ingestion_message_handler decorator which corresponding to the TYPE of the given
    IngestionMessage, passing it the given IngestionMessage and IngestionListenerBase
    as arguments; returns the value returned by the message handler.

    If a message handler has NOT been registered for the given message type AND of NO default
    message handler has been registered, then throws and exception. I.e. a specific message handler
    MUST be defined for each expected message type OR a DEFAULT message handler must be defined
    to handle messages with types which does NOT correspond to any specifically registered handlers.
    """
    if not isinstance(message, IngestionMessage):
        # We allow passing a message which is NOT of type IngestionMessage, which we will
        # ASSUME in this case is a RAW (dict) message from which we create an IngestionMessage.
        message = IngestionMessage(message)
    handler = (_ingestion_message_handlers.get(message.type) or
               _ingestion_message_handlers.get(_DEFAULT_INGESTION_MESSAGE_HANDLER_NAME))
    if handler:
        return handler(message, listener)
    else:
        raise Exception(f"No ingestion message handler defined for ingestion type: {message.type}")
    return False


def for_testing_clear_ingestion_message_handlers():
    """
    Clears all globally registered ingestion message handlers.
    This is for TESTING purposes ONLY!
    """
    global _ingestion_message_handlers
    _ingestion_message_handlers = {}
