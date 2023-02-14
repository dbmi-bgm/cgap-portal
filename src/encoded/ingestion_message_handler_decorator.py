# Module containing the definition of the @ingestion_message_handler decorator used
# to globally register ingestion message handler functions, as well as functions to
# get the list of registered handler functions and to call them for a given message.

import inspect
from typing import Union
from dcicutils.misc_utils import ignored, PRINT
from .ingestion_listener_base import IngestionListenerBase
from .ingestion_message import IngestionMessage


_ingestion_message_handlers = []


def ingestion_message_handler(f=None, *decorator_args, **decorator_kwargs):
    """
    Decorator to globally register ingestion message handlers, to be used for example like this:

      @ingestion_message_handler
      your_ingester_message_handler(message: IngestionMessage, listener: IngestionListener) -> bool:
          return handle_message_returning_true_if_processed_otherwise_false()

    Once registered the get_ingestion_message_handlers function in this module (below)
    can be used to get a list of all registered ingestion message handler functions.
    And/or the call_ingestion_message_handler function (below) can be used to iterate
    thru and call (at most one, nominally) registered message handler for a given message.

    Although any function may be annotated with this decorator, at this time and for our purposes
    it is expected to have a signature as show in the example above; this IS enforced to some extent.

    In addition, you can pass an ingestion_type argument to the decorator to LIMIT the call of the
    decorated handler function to messages with an ingestion type which matches the specified value,
    if it is a string, or if it is a function/lambda, then iff a call to that function, with the
    message passed as an argument, returns True. For example, to define a message handler to be
    called ONLY for message types which are "vcf":

      @ingestion_message_handler(ingestion_type="vcf")
      your_ingester_message_handler(message: IngestionMessage, listener: IngestionListener) -> bool:
          return handle_message_returning_true_if_processed_otherwise_false()

    or an example using a lambda instead looks like this:

      @ingestion_message_handler(ingestion_type=lambda message: not message.is_type("vcf"))
      your_ingester_message_handler(message: IngestionMessage, listener: IngestionListener) -> bool:
          return handle_message_returning_true_if_processed_otherwise_false()

    In this example, the handler would ONLY be called for message types which are NOT "vcf".
    Note that ingestion type names are in both cases treated as case-insenstive.
    """
    ignored(decorator_args)
    has_decorator_args = True if not callable(f) or f.__name__ == "<lambda>" else False
    ingestion_type = None

    if has_decorator_args:
        if isinstance(f, str):
            ingestion_type = f
        elif callable(f):
            ingestion_type = f
        if decorator_kwargs:
            ingestion_type = decorator_kwargs.get("ingestion_type", decorator_kwargs.get("type"))
        if not (isinstance(ingestion_type, str) or callable(ingestion_type)):
            ingestion_type = None

    def ingestion_message_handler_wrapper(wrapped_function):

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
            message = args[0] if args and isinstance(args[0], IngestionMessage) else None
            if not message:
                raise ValueError(f"Argument passed to message handler not of type IngestionMessage!")
            PRINT(f"Checking message ({message.uuid}) type ({message.type}) for handler: {wrapped_function.__name__}")
            if ingestion_type and message:
                # Here the decorator specified an ingestion type;
                # check it and only call the wrapped function if they match.
                if callable(ingestion_type):
                    if not ingestion_type(message):
                        # Since the ingestion_type specified for the handler decorator
                        # is a lambda which returned falsity, then this message is NOT
                        # intended to be processed by this handler, it will not be called.
                        PRINT(f"Message ({message.uuid}) type ({message.type}) "
                              f"NOT intended for handler: {wrapped_function.__name__}")
                        return False
                elif not message.is_type(ingestion_type):
                    # Since the ingestion_type specified for the handler decorator is string
                    # which does not match the type of the message, then this message is NOT
                    # intended to be processed by this handler, it will not be called.
                    PRINT(f"Message ({message.uuid}) type ({message.type}) "
                          f"NOT intended for handler: {wrapped_function.__name__}")
                    return False
            # Here the handler decorator has no ingestion_type specifier or if it does
            # it indicates that this message IS intended to be processed by this handler
            # and we will call it here, returning its value, which, if True, indicates that
            # the message was actually processed, or if False, that it was not processed.
            # TODO MAYBE: Should we check that arguments are IngestionMessage and IngestionListener
            # types/subclasses respectively, and that the return value from this call is True or False?
            # TODO MAYBE: Should we allow a raw message here (like in call_ingestion_message_handler)?
            PRINT(f"Calling message ({message.uuid}) type ({message.type}) "
                  f"handler: {wrapped_function.__name__}")
            result = wrapped_function(*args, **kwargs)
            PRINT(f"Called message ({message.uuid}) type ({message.type}) "
                  f"handler: {wrapped_function.__name__} -> {result}")
            return True if result else False

        _ingestion_message_handlers.append(lambda args, kwargs: ingestion_message_handler_function(args, kwargs))
        return ingestion_message_handler_function

    return ingestion_message_handler_wrapper(f) if not has_decorator_args else ingestion_message_handler_wrapper


def get_ingestion_message_handlers():
    """
    Resturns a list of all ingestion message handler functions which were globally registered
    via the @ingestion_message_handler decorator. Example usage is like this:

      listener: IngestionListener = get_reference_to_your_ingestion_listener()
      message: IngestionMessage = IngestionMessage(get_next_raw_ingestion_message())
      for handler in get_ingestion_message_handlers():
          handler(message, listener)

    Note that in this example we will invoke ALL handlers which are targeted for the given
    message type as controlled by any ingestion_type which might have been specified for
    the @ingestion_message_handler decorator for the handler function; this is in CONTRAST
    to the behavior of the call_ingestion_message_handler function (below) which STOPS
    calling any handlers once ONE of them return True (indicating that that message
    has indeed been successfully processed, and no further processing is desired).
    """
    return _ingestion_message_handlers


def call_ingestion_message_handler(message: Union[IngestionMessage, dict], listener) -> bool:
    """
    Calls AT MOST one (NOMINALLY - see below) of the ingestion message handler functions
    globally registered via the @ingestion_message_handler decorator, for the given message,
    and listener. If at least ONE handler was called then returns True, otherwise returns False.

    NOTE however that this "at most" is controlled by the handler function ITSELF; if a handler
    function returns True (the expected/typical case) it conveys that the message WAS processed,
    and that NO more handlers should be called (and presumably that it should be discarded by
    the caller from any future processing); otherwise it is assumed that the message was NOT
    processed, and further handlers WOULD be called for the message, until ONE returns True.

    Also NOTE that the order in which the registered ingestion message handlers are called is
    the same the order in which they were defined, but this ordering should NOT be relied upon.
    """
    if not isinstance(message, IngestionMessage):
        # Allow passing a message which is NOT of type IngestionMessage, which we will
        # ASSUME in this case is a RAW (dict) message from which we create an IngestionMessage.
        message = IngestionMessage(message)
    for handler in get_ingestion_message_handlers():
        if handler(message, listener) is True:
            return True
    return False


def clear_ingestion_message_handlers():
    """
    Clears all globally registered ingestion message handlers.
    This is for TESTING purposes ONLY!
    """
    global _ingestion_message_handlers
    _ingestion_message_handlers = []
