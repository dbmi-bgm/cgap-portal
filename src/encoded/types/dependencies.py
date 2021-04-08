""" Implements some convenience logic for specifying item embedding dependencies.
    In the context of invalidation scope, it is imperative that we embed all fields used in
    default embeds (display_title). The hope is DependencyEmbedder will make it easy to do so, allowing
    one to specify the dependencies in only one place and call the method in others.
"""


class DependencyEmbedderError(Exception):
    pass


class DependencyEmbedder:
    """ Utility class intended to be used to produce the embedded list necessary for a default embed
        of a given type. This class is intended to be used by calling the `embed_defaults_for_type` method.
        Note that the type mappings are specified in EMBED_MAPPER and that 'compound' embeds are
        specified verbosely ie: bio_feature embeds an ontology_term
    """

    # Note that these match item_type field in the type definition!
    FAMILY = 'Family'
    INDIVIDUAL = 'Individual'
    FILE = 'File'
    EMBED_MAPPER = {
        FAMILY: [
            'accession',
            'title',
            'family_id'
        ],
        INDIVIDUAL: [
            'accession',
        ],
        FILE: [
            'file_format.file_format',
            'accession',
        ]

    }

    @classmethod
    def embed_defaults_for_type(cls, *, base_path, t):
        """ Embeds the fields necessary for a default embed of the given type and base_path

        :param base_path: path to linkTo
        :param t: item type this embed is for
        :return: list of embeds
        """
        if t not in cls.EMBED_MAPPER:
            raise DependencyEmbedderError('Type %s is not mapped! Types mapped: %s' % (t, cls.EMBED_MAPPER.keys()))
        return ['.'.join([base_path, e]) for e in cls.EMBED_MAPPER[t]]

    @classmethod
    def embed_for_type(cls, *, base_path, t, additional_embeds: list):
        """ Embeds the defaults for the given type, plus any additional embeds.
            NOTE: additional_embeds are not validated against the schema!

        :param base_path: path to linkTo
        :param t: type to embed
        :param additional_embeds: fields other than those needed for default linkTo to be embedded.
        :return: list of embeds
        """
        if not isinstance(additional_embeds, list):
            raise DependencyEmbedderError('Invalid type for additional embeds! Gave: %s, of type %s' %
                                          (additional_embeds, type(additional_embeds)))
        return cls.embed_defaults_for_type(base_path=base_path, t=t) + ['.'.join([base_path, e])
                                                                        for e in additional_embeds]
