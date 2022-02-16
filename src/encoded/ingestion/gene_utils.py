import gzip
import json
from tqdm import tqdm
from pyramid.httpexceptions import HTTPConflict
from .common import CGAP_CORE_PROJECT, CGAP_CORE_INSTITUTION
from ..util import resolve_file_path, load_json_file


class GeneIngestion(object):
    """ Class that encapsulates data/methods for ingesting genes.
        Note that this consists of nothing except a reference to the file containing
        JSON and some Python operators that make manipulation convenient.
    """
    GENE_ENDPOINT = '/gene'

    def __init__(self, location):
        """ Note that this load could potentially be very expensive. Should not be done
            ever as part of a request.
        """
        self.genes_to_ingest = json.load(open(location, 'r'))

    def __len__(self):
        return len(self.genes_to_ingest)

    def __iter__(self):
        for gene in self.genes_to_ingest:
            yield gene

    def __getitem__(self, item):
        return self.genes_to_ingest[item]

    def upload(self, vapp, project=CGAP_CORE_PROJECT, institution=CGAP_CORE_INSTITUTION, use_tqdm=False):
        """ Uploads all (or some if a failure occurs) of the genes

        :param vapp: VirtualApp from dcicutils to post to
        :param project: project to attach to these genes
        :param institution: institution to attach to these genes
        :param use_tqdm: boolean on whether or not to show a progress bar
        :raises: VirtualAppError if a post is unsuccessful
        """
        if use_tqdm:
            _iter = tqdm(self.genes_to_ingest, unit='genes')
        else:
            _iter = self.genes_to_ingest
        for gene in _iter:
            gene['status'] = 'shared'  # default gene status to shared, so visible to everyone
            if project:
                gene['project'] = project
            if institution:
                gene['institution'] = institution
            try:
                vapp.post_json(self.GENE_ENDPOINT, gene, status=201)
            except HTTPConflict:  # XXX: PATCH on conflict - Should use put instead - See C4-272
                vapp.patch_json('/'.join([self.GENE_ENDPOINT, gene['ensgid']]), gene)


class GeneAnnotationParserError(Exception):
    """Exception for GeneAnnotationParser"""
    pass


class GeneAnnotationParser:
    """Class for generating gene inserts from gene annotation file."""

    # Schema constants
    PROPERTIES = "properties"
    ANNOTATION_FIELD = "annotation_field"
    PROPERTIES = "properties"
    TYPE = "type"
    ARRAY = "array"
    STRING = "string"
    ITEMS = "items"
    NUMBER = "number"
    INTEGER = "integer"
    BOOLEAN = "boolean"
    SUB_EMBEDDING_GROUP = "sub_embedding_group"
    DEFAULT = "default"
    FIELD_SEPARATOR = "."
    STATUS = "status"
    SHARED_STATUS = "shared"
    PROJECT = "project"
    INSTITUTION = "institution"

    # Annotation file constants
    ANNOTATION = "annotation"

    # Class constants
    GENE_SCHEMA_PATH = resolve_file_path("schemas/gene.json")
    SUB_TYPE = "sub_type"
    GZIP_EXTENSION = ".gz"
    BOOLEAN_TRUE = ["1", "YES", "true", True]
    BOOLEAN_FALSE = ["0", "NO", "false", False]
    CGAP_CORE_PROJECT_UUID = "12a92962-8265-4fc0-b2f8-cf14f05db58b"
    CGAP_CORE_INSTITUTION_UUID = "828cd4fe-ebb0-4b36-a94a-d2e3a36cc989"

    def __init__(
        self,
        annotation_records_path,
        inserts_path,
        schema_path=GENE_SCHEMA_PATH,
        gzip_file=True,
    ):
        """Create class and set attributes.

        :param annotation_records_path: Path to annotations file
        :type annotation_records_path: str
        :param inserts_path: Path to gene inserts file to create
        :type inserts_path: str
        :param schema_path: Path to gene schema
        :type schema_path: str
        :param gzip_file: Whether to gzip output inserts file
        :type gzip_file: bool
        """
        self.schema = load_json_file(schema_path)
        self.annotation_records = self.load_annotation_records(annotation_records_path)
        self.annotation_properties = SchemaPropertiesParser(
            self.schema.get(self.PROPERTIES, {}), self.ANNOTATION_FIELD
        ).parse_schema_properties()
        self.inserts_path = inserts_path
        self.gzip_file = gzip_file

    def load_annotation_records(self, annotation_records_path):
        """Get annotations from annotation file."""
        contents = load_json_file(annotation_records_path)
        return contents.get(self.ANNOTATION, [])

    def write_inserts(self):
        """Write inserts to destination file."""
        inserts = []
        for insert in self.get_inserts():
            insert[self.STATUS] = self.SHARED_STATUS
            insert[self.PROJECT] = self.CGAP_CORE_PROJECT_UUID
            insert[self.INSTITUTION] = self.CGAP_CORE_INSTITUTION_UUID
            inserts.append(insert)
        if self.gzip_file:
            if not self.inserts_path.endswith(self.GZIP_EXTENSION):
                self.inserts_path += self.GZIP_EXTENSION
            with gzip.open(self.inserts_path, "wt") as handle:
                json.dump(inserts, handle, indent=4)
        else:
            with open(self.inserts_path, "w") as handle:
                json.dump(inserts, handle, indent=4)

    def get_inserts(self):
        """Generate inserts from annotations."""
        for record in self.annotation_records:
            gene_item = {}
            for schema_key, schema_properties in self.annotation_properties.items():
                annotation_field = schema_properties.get(self.ANNOTATION_FIELD)
                sub_embedded_group = schema_properties.get(self.SUB_EMBEDDING_GROUP)
                field_value = self.nested_getter(record, annotation_field)
                if sub_embedded_group:
                    if not isinstance(field_value, list):
                        if field_value:
                            field_value = [field_value]
                        else:
                            field_value = []
                    for idx, value in enumerate(field_value):
                        self.add_property_to_item(
                            gene_item, schema_key, schema_properties, value, index=idx
                        )
                else:
                    self.add_property_to_item(
                        gene_item, schema_key, schema_properties, field_value
                    )
            self.reformat_array_of_objects(gene_item)
            if gene_item:
                yield gene_item

    def reformat_array_of_objects(self, gene_item):
        """Reformat objects that should be list of dicts from dict of
        lists.

        E.g. {"0": {"foo": "bar"}, "1": {"fu": "bur"}} to
        [{"foo": "bar"}, {"fu": "bur"}].

        :param gene_item: Individual gene insert
        :type gene_item: dict
        """
        for key, value in gene_item.items():
            if isinstance(value, dict):
                new_value = []
                for _, item in value.items():
                    new_value.append(item)
                gene_item[key] = new_value

    def nested_getter(self, item, field_to_get):
        """Recursively retrieve (possibly nested) fields from a dict.

        :param item: Object from which to retrieve the field
        :type item: dict or list
        :param field_to_get: The field to retrieve
        :type field_to_get: str
        :returns: Retrieved field value(s)
        :rtype: list or str or None
        """
        result = None
        if item and isinstance(item, list):
            result = []
            for sub_item in item:
                sub_result = self.nested_getter(sub_item, field_to_get)
                if isinstance(sub_result, list):
                    result += sub_result
                elif sub_result:
                    result.append(sub_result)
            result = list(dict.fromkeys(result))  # Retain order
            if len(result) == 1:
                result = result[0]
            if not result:
                result = None
        elif isinstance(item, dict):
            result = item.get(field_to_get)
            if result:
                field_to_get = ""
            if result is None and self.FIELD_SEPARATOR in field_to_get:
                field_terms = field_to_get.split(self.FIELD_SEPARATOR)
                first_term = field_terms.pop(0)
                result = item.get(first_term)
                if result:
                    field_to_get = self.FIELD_SEPARATOR.join(field_terms)
            if result and field_to_get:
                result = self.nested_getter(result, field_to_get)
        return result

    def add_property_to_item(
        self, gene_item, schema_key, schema_properties, field_value, index=None
    ):
        """Set value for property if present on the annotation or
        default exists.

        :param gene_item: Individual gene insert
        :type gene_item: dict
        :param schema_key: Field name from schema
        :type schema_key: str
        :param schema_properties: Field properties from schema
        :type schema_properties: dict
        :param field_value: Value for field retrieved from annotation
        :type field_value: object
        :param index: Index of retrieved value for field (used for
            fields that are array of objects)
        :type index: int or None
        """
        default = schema_properties.get(self.DEFAULT)
        value_type = schema_properties.get(self.TYPE)
        sub_embedded_group = schema_properties.get(self.SUB_EMBEDDING_GROUP)
        sub_type = schema_properties.get(self.SUB_TYPE)
        if field_value is None and default is not None:
            field_value = default
        if field_value:
            value_to_add = self.cast_field_value(
                value_type, field_value, sub_type=sub_type
            )
            if sub_embedded_group:
                if sub_embedded_group not in gene_item:
                    gene_item[sub_embedded_group] = {}
                if index is not None:
                    if index not in gene_item[sub_embedded_group]:
                        gene_item[sub_embedded_group][index] = {}
                    gene_item[sub_embedded_group][index][schema_key] = value_to_add
                else:
                    gene_item[sub_embedded_group][schema_key] = value_to_add
            else:
                gene_item[schema_key] = value_to_add

    def cast_field_value(self, value_type, value, sub_type=None):
        """Convert value retrieved from annotation to value dictated
        by schema.

        :param value_type: Field type from schema
        :type value_type: str
        :param value: Field value retrieved from annotation
        :type value: object
        :param sub_type: Type to use for field values when field is a
            list
        :type sub_type: str or None
        :returns: Field value in requested type
        :rtype: object
        :raises GeneAnnotationParserError: Unable to convert field
            value to requested type
        """
        result = None
        if value_type == self.STRING:
            if isinstance(value, list):
                value = list(dict.fromkeys(value))
                if len(value) == 1:
                    value = value[0]
            if isinstance(value, str):
                result = value
            else:
                raise GeneAnnotationParserError(
                    "Could not convert value to string: %s" % value
                )
        elif value_type == self.INTEGER:
            try:
                result = int(float(value))
            except Exception:
                raise GeneAnnotationParserError(
                    "Could not convert value to integer: %s" % value
                )
        elif value_type == self.NUMBER:
            try:
                result = float(value)
            except Exception:
                raise GeneAnnotationParserError(
                    "Could not convert value to float: %s" % value
                )
        elif value_type == self.BOOLEAN:
            if value in self.BOOLEAN_TRUE:
                result = True
            elif value in self.BOOLEAN_FALSE:
                result = False
            else:
                raise GeneAnnotationParserError(
                    "Received an unexpected value for a boolean: %s" % value
                )
        elif value_type == self.ARRAY:
            if not isinstance(value, list):
                value = [value]
            if sub_type:
                result = []
                for item in value:
                    result.append(self.cast_field_value(sub_type, item))
            else:
                raise GeneAnnotationParserError(
                    "No sub-type given for an array for value: %s" % value
                )
        else:
            raise GeneAnnotationParserError(
                "Received an unexpected type: %s" % value_type
            )
        return result


class SchemaPropertiesParserError(Exception):
    """Error class for SchemaPropertiesParser"""
    pass


class SchemaPropertiesParser:

    # Schema constants
    PROPERTIES = "properties"
    TYPE = "type"
    OBJECT = "object"
    ARRAY = "array"
    STRING = "string"
    ITEMS = "items"
    NUMBER = "number"
    INTEGER = "integer"
    SUB_EMBEDDING_GROUP = "sub_embedding_group"
    DEFAULT = "default"

    # Class constants
    SUB_TYPE = "sub_type"

    def __init__(self, schema_properties, field_identifier):
        """Create class and set attributes.

        :param schema_properties: Properties from schema
        :type schema_properties: dict
        :param field_identifier: Identifying key of properties that
            implies property and accompanying information should be
            captured
        :type field_identifier: str
        """
        self.schema_properties = schema_properties
        self.field_identifier = field_identifier

    def parse_schema_properties(self):
        """Parse schema for properties that have the field identifier.

        :returns: Properties associated with class's field identifier
        :rtype: dict
        """
        result = {}
        for key, value in self.schema_properties.items():
            value_type = value.get(self.TYPE)
            if value_type not in (self.ARRAY, self.OBJECT):
                self.add_schema_property(key, value, result)
            elif value_type == self.ARRAY:
                items = value[self.ITEMS]
                item_properties = items.get(self.PROPERTIES)
                if item_properties:  # Array of objects
                    for item_key, item_value in item_properties.items():
                        item_type = item_value.get(self.TYPE)
                        if item_type != self.ARRAY:
                            self.add_schema_property(
                                item_key, item_value, result, parent=key
                            )
                        else:
                            item_value = item_value[self.ITEMS]
                            self.add_schema_property(
                                item_key, item_value, result, array=True, parent=key
                            )
                else:
                    self.add_schema_property(key, items, result, array=True)
            elif value_type == self.OBJECT:
                raise SchemaPropertiesParserError(
                    "Found a property of type \"object\": %s. Consider using array"
                    " of objects if required or utilize separate properties for all"
                    " embedded properties."
                    % key
                )
        return result

    def add_schema_property(self, key, value, identified_properties, array=False, parent=None):
        """Add schema property to identified properties if possesses
        field identifier.

        :param key: Property key (name)
        :type key: str
        :param value: Property information corresponding to key
        :type value: dict
        :param identified_properties: Properties containing class's
            field identifier
        :type identified_properties: dict
        :param array: Whether the property is an array
        :type array: bool
        :param parent: Parent property for the property (for arrays of
            objects)
        :type parent: str or None
        """
        value_type = value.get(self.TYPE)
        field_identifier = value.get(self.field_identifier)
        default = value.get(self.DEFAULT)
        if field_identifier:
            identified_properties[key] = {
                self.field_identifier: field_identifier, self.TYPE: value_type
            }
            if parent:
                identified_properties[key][self.SUB_EMBEDDING_GROUP] = parent
            if array:
                identified_properties[key][self.TYPE] = self.ARRAY
                identified_properties[key][self.SUB_TYPE] = value_type
            if default is not None:
                identified_properties[key][self.DEFAULT] = default
