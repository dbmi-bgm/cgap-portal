"""
Exception definitions for ingestion
"""


class SubmissionFailure(Exception):
    pass


class UndefinedIngestionProcessorType(Exception):

    def __init__(self, processor_type):
        self.ingestion_type_name = processor_type
        super().__init__("No ingestion processor type %r is defined." % processor_type)


class MissingParameter(Exception):

    def __init__(self, parameter_name):
        self.parameter_name = parameter_name
        super().__init__("Missing parameter: %s" % parameter_name)
