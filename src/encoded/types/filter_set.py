from snovault import collection, load_schema, calculated_property
from .base import Item


@collection(
    name='filter-sets',
    properties={
        'title': 'Filter Sets',
        'description': 'Filter Set for combining multiple queries'
    }
)
class FilterSet(Item):
    """The class to store information about 4DN file formats"""
    item_type = 'filter_set'
    schema = load_schema('encoded:schemas/filter_set.json')
    name_key = 'filter_set'
    embedded_list = []

    def execute(self):
        """ Invokes the execute action on this filter set, which effectively is:
            For each filter_block:
                AND with all other filter blocks (if applied)
            AND 'flags'

            The idea is to provide a button the filter set view to 'execute' a filter set.
        """
        pass  # XXX: invoke search.py


@calculated_property(context=FilterSet, category='action')
def execute(context, request):
    """ Declares a snovault action category called 'execute', allowing you to 'execute' an item,
        in this case a filter set, which will execute a search.
    """
    if request.has_permission('execute'):  # XXX: This permission requires configuration
        return {
            'name': 'execute',
            'title': 'Execute',
            'profile': '/profiles/{ti.name}.json'.format(ti=context.type_info),
            'href': '{item_uri}?currentAction=execute'.format(item_uri=request.resource_path(context)),
        }
