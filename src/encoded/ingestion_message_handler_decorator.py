from dcicutils.misc_utils import ignored, PRINT


_ingestion_message_handlers = []


def ingestion_message_handlers():
    return _ingestion_message_handlers


def ingestion_message_handler(f=None, *default_args, **default_kwargs):
    """
    Decorator for ingestion message handlers to be used like this:

        @ingestion_message_handler
        your_ingester_message_handler(message, ingestion_listener: IngestionLister) -> bool:
            return handle_message_returning_true_if_interested_and_successful_otherwise_false()

    Once registered the function local to this function called handlers() can be used
    to get a list of all registered ingestion message handler functions, like this:.

        for handler in ingestion_message_handlers():
            if handler(message, ingestion_listener):
                ingestion_listener.discard_message()
    """
    ignored(default_args, default_kwargs)
    has_decorator_args = True if not callable(f) else False

    def ingestion_message_handler_wrapper(wrapped_function):
        """
        This function is called once for each ingestion message handler (at startup)
        annotated with the @ingestion_message_handler decorator.
        """
        def ingestion_message_handler_function(*args, **kwargs):
            """
            This is the function called on each actual ingestion message handler call.
            """
            return wrapped_function(*args, **kwargs)
        PRINT(f"Registering message handler: {wrapped_function.__name__}")
        _ingestion_message_handlers.append(lambda args, kwargs: ingestion_message_handler_function(args, kwargs))
        return ingestion_message_handler_function
    return ingestion_message_handler_wrapper(f) if not has_decorator_args else ingestion_message_handler_wrapper
