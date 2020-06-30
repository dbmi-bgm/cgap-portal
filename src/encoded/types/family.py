from snovault import (
    calculated_property,
    collection,
    load_schema,
    CONNECTION,
    COLLECTIONS,
    display_title_schema
)
from snovault.util import debug_log
from .base import (
    Item,
    get_item_or_none
)
from pyramid.httpexceptions import HTTPUnprocessableEntity
from pyramid.view import view_config
from datetime import datetime
from dateutil.relativedelta import relativedelta
import structlog


log = structlog.getLogger(__name__)


@collection(
    name='families',
    unique_key='accession',
    properties={
        'title': 'Families',
        'description': 'Listing of Families',
    })
class Family(Item):
    item_type = 'family'
    name_key = 'accession'
    schema = load_schema('encoded:schemas/family.json')
    rev = {'sample_procs': ('SampleProcessing', 'families'),
           'case': ('Case', 'family')}

    embedded_list = [
        "members.accession",
        "members.father",
        "members.mother",
        "members.status",
        "members.sex",
        "members.is_deceased",
        "members.is_pregnancy",
        "members.is_termination_of_pregnancy",
        "members.is_spontaneous_abortion",
        "members.is_still_birth",
        "members.cause_of_death",
        "members.age",
        "members.age_units",
        "members.age_at_death",
        "members.age_at_death_units",
        "members.is_no_children_by_choice",
        "members.is_infertile",
        "members.cause_of_infertility",
        "members.ancestry",
        "members.clinic_notes",
        "members.phenotypic_features.phenotypic_feature",
        "members.phenotypic_features.onset_age",
        "members.phenotypic_features.onset_age_units",
        "members.samples.status",
        "members.samples.specimen_type",
        "members.samples.specimen_notes",
        "members.samples.specimen_collection_date",
        "members.samples.workup_type",
        "members.samples.processed_files",
        "members.samples.processed_files.workflow_run_outputs",
        "members.samples.processed_files.quality_metric",
        "members.samples.processed_files.quality_metric.qc_list.qc_type",
        "members.samples.processed_files.quality_metric.qc_list.value.overall_quality_status",
        "members.samples.processed_files.quality_metric.qc_list.value.url",
        "members.samples.processed_files.quality_metric.qc_list.value.status",
        "members.samples.processed_files.quality_metric.overall_quality_status",
        "members.samples.processed_files.quality_metric.url",
        "members.samples.processed_files.quality_metric.status",
        "members.samples.files.quality_metric",
        "members.samples.files.quality_metric.qc_list.qc_type",
        "members.samples.files.quality_metric.qc_list.value.overall_quality_status",
        "members.samples.files.quality_metric.qc_list.value.url",
        "members.samples.files.quality_metric.qc_list.value.status",
        "members.samples.files.quality_metric.overall_quality_status",
        "members.samples.files.quality_metric.url",
        "members.samples.files.quality_metric.status",
        "members.samples.completed_processes",
        "analysis_groups.samples.accession",
        "analysis_groups.processed_files",
        "analysis_groups.processed_files.quality_metric",
        "analysis_groups.processed_files.quality_metric.qc_list.qc_type",
        "analysis_groups.processed_files.quality_metric.qc_list.value.overall_quality_status",
        "analysis_groups.processed_files.quality_metric.qc_list.value.url",
        "analysis_groups.processed_files.quality_metric.qc_list.value.status",
        "analysis_groups.processed_files.quality_metric.overall_quality_status",
        "analysis_groups.processed_files.quality_metric.url",
        "analysis_groups.processed_files.quality_metric.status",
        "analysis_groups.sample_processed_files",
        "analysis_groups.sample_processed_files.sample.accession",
        "analysis_groups.sample_processed_files.processed_files.quality_metric",
        "analysis_groups.sample_processed_files.processed_files.quality_metric.qc_list.qc_type",
        "analysis_groups.sample_processed_files.processed_files.quality_metric.qc_list.value.overall_quality_status",
        "analysis_groups.sample_processed_files.processed_files.quality_metric.qc_list.value.url",
        "analysis_groups.sample_processed_files.processed_files.quality_metric.qc_list.value.status",
        "analysis_groups.sample_processed_files.processed_files.quality_metric.overall_quality_status",
        "analysis_groups.sample_processed_files.processed_files.quality_metric.url",
        "analysis_groups.sample_processed_files.processed_files.quality_metric.status",
        "analysis_groups.completed_processes",
    ]

    @calculated_property(schema={
        "title": "Cases",
        "description": "Cases for this family",
        "type": "array",
        "items": {
            "title": "Case",
            "type": "string",
            "linkTo": "Case"
        }
    })
    def case(self, request):
        rs = self.rev_link_atids(request, "case")
        if rs:
            return rs

    @staticmethod
    def generate_ped(all_props, proband, family_id):
        """Format family information into ped file
        https://gatk.broadinstitute.org/hc/en-us/articles/360035531972
        This might be useful in the future for compatibility
        Ped file columns are
        *Family ID
        *Individual ID
        *Paternal ID
        *Maternal ID
        *Sex (1=male; 2=female; U=unknown)
        *Phenotype (-9 missing 0 missing 1 unaffected 2 affected)
        (at the moment only on proband has 2 on phenotype)
        """
        ped_content = """"""
        gender_map = {'M': '1', 'F': '2', 'U': '3'}
        for props in all_props:
            # all members have unknown phenotype by default
            phenotype = '0'
            member_id = props['accession']

            def parent_id(properties, field):
                'extract parent accession from member info'
                id = properties.get(field)
                if id:
                    return id.split('/')[2]
                else:
                    return ''
            paternal_id = parent_id(props, 'father')
            maternal_id = parent_id(props, 'mother')
            sex = props.get('sex', 'U')
            ped_sex = gender_map.get(sex, 'U')
            # if member is proband, add phenotupe
            if props['@id'] == proband:
                phenotype = '2'
            line_ele = [family_id, member_id, paternal_id, maternal_id, ped_sex, phenotype]
            ped_content += '\t'.join(line_ele) + '\n'
        return ped_content

    @staticmethod
    def extract_vectors(ped_content):
        """given a ped file content, extract all primary relationship pairs
        keys are listed in primary_vectors"""
        fathers = []
        mothers = []
        daughters = []
        sons = []
        children = []  # when the gender of the kid is not known
        for a_line in ped_content.split('\n'):
            if not a_line:
                continue
            fam, ind, father, mother, sex, ph = a_line.split('\t')
            if father:
                fathers.append([father, ind])
                if sex == '1':
                    sons.append([ind, father])
                elif sex == '2':
                    daughters.append([ind, father])
                else:
                    children.append([ind, father])
            if mother:
                mothers.append([mother, ind])
                if sex == '1':
                    sons.append([ind, mother])
                elif sex == '2':
                    daughters.append([ind, mother])
                else:
                    children.append([ind, mother])
        primary_vectors = {
            'fathers': fathers,
            'mothers': mothers,
            'daughters': daughters,
            'sons': sons,
            'children': children  # when the gender of the kid is not known
        }
        return primary_vectors

    @staticmethod
    def construct_links(primary_vectors, seed):
        """Given the primary vectors, constructs linkages for each individual
        and filters for the shortest link
        Use first letter of primary vector keys to construct these links
        This linkages are calcualted from the seed, often starts with proband,
        seed should be accession"""
        # starting pack
        needs_analysis = [[seed, 'p'], ]
        analyzed = []
        all_links = {seed: ['p', ]}
        # loop overy every set of new collected individuals
        while needs_analysis:
            collect_connected = []
            for an_ind, starting_tag in needs_analysis:
                if an_ind in analyzed:
                    continue
                analyzed.append(an_ind)
                if an_ind not in all_links:
                    print('should not happen')
                for a_key in primary_vectors:
                    # extend the link list with this letter
                    extend_tag = a_key[0]
                    my_links = [i for i in primary_vectors[a_key] if i[1] == an_ind]
                    for a_link in my_links:
                        linked_ind = a_link[0]
                        new_tag = starting_tag + '-' + extend_tag
                        if linked_ind not in all_links:
                            all_links[linked_ind] = [new_tag, ]
                        else:
                            all_links[linked_ind].append(new_tag)
                        if linked_ind not in analyzed:
                            collect_connected.append([linked_ind, new_tag])
                needs_analysis = collect_connected
        filtered_links = {}
        for individual in all_links:
            # Return shorts links
            a_list = list(set(all_links[individual]))
            minimum = min(map(len, a_list))
            a_list = [i for i in a_list if len(i) == minimum]
            filtered_links[individual] = a_list
        return filtered_links

    @staticmethod
    def relationships_vocabulary(links):
        """Convert links to relationships.
        Nomenclature guided by
        https://www.devonfhs.org.uk/pdfs/tools/eichhorn-rlationship-chart.pdf"""
        # return a nested list of  [acc, calculated_relation, association]
        Converter = {
            "p": "proband",
            "p-f": "father", "p-m": "mother", "p-d": "daughter", "p-s": "son", "p-c": "child",
            "p-f-s": "brother", "p-m-s": "brother",
            "p-f-d": "sister", "p-m-d": "sister",
            "p-f-c": "sibling", "p-m-c": "sibling",
            "p-d-m": "wife", "p-s-m": "wife", "p-c-m": "wife",
            "p-d-f": "husband", "p-s-f": "husband", "p-c-f": "husband",
        }
        # add grandchildren
        all_children = [i for i in Converter if Converter[i] in ['daughter', 'son', 'child']]
        for child in all_children:
            Converter[child + '-s'] = 'grandson'
            Converter[child + '-d'] = 'granddaughter'
            Converter[child + '-c'] = 'grandchild'
        # add niece nephew nibling (we can also add sister brother in law here but will skip non blood relatives)
        all_siblings = [i for i in Converter if Converter[i] in ['brother', 'sister', 'sibling']]
        for sib in all_siblings:
            Converter[sib + '-s'] = 'nephew'
            Converter[sib + '-d'] = 'niece'
            Converter[sib + '-c'] = 'nibling'
        # add grand niece nephew nibling
        all_niblings = [i for i in Converter if Converter[i] in ['nephew', 'niece', 'nibling']]
        for nib in all_niblings:
            Converter[nib + '-s'] = 'grandnephew'
            Converter[nib + '-d'] = 'grandniece'
            Converter[nib + '-c'] = 'grandnibling'
        # add Grandparents
        all_parents = [i for i in Converter if Converter[i] in ['mother', 'father']]
        for parent in all_parents:
            Converter[parent + '-m'] = 'grandmother'
            Converter[parent + '-f'] = 'grandfather'
        # add Great-grandparents Uncle Aunt Auncle
        all_g_parents = [i for i in Converter if Converter[i] in ['grandmother', 'grandfather']]
        for g_parent in all_g_parents:
            Converter[g_parent + '-m'] = 'great-grandmother'
            Converter[g_parent + '-f'] = 'great-grandfather'
            Converter[g_parent + '-s'] = 'uncle'
            Converter[g_parent + '-d'] = 'aunt'
            Converter[g_parent + '-c'] = 'auncle'
        # add Great-great-grandparents granduncle grandaunt grandauncle
        all_gg_parents = [i for i in Converter if Converter[i] in ['great-grandmother', 'great-grandfather']]
        for gg_parent in all_gg_parents:
            Converter[gg_parent + '-m'] = 'great-great-grandmother'
            Converter[gg_parent + '-f'] = 'great-great-grandfather'
            Converter[gg_parent + '-s'] = 'granduncle'
            Converter[gg_parent + '-d'] = 'grandaunt'
            Converter[gg_parent + '-c'] = 'grandauncle'
        # add Cousin
        all_auncle = [i for i in Converter if Converter[i] in ['uncle', 'aunt', 'auncle']]
        for auncle in all_auncle:
            Converter[auncle + '-s'] = 'cousin'
            Converter[auncle + '-d'] = 'cousin'
            Converter[auncle + '-c'] = 'cousin'
        # add Cousin once removed (descendant)
        all_cousins = [i for i in Converter if Converter[i] in ['cousin']]
        for cousin in all_cousins:
            Converter[cousin + '-s'] = 'cousin once removed (descendant)'
            Converter[cousin + '-d'] = 'cousin once removed (descendant)'
            Converter[cousin + '-c'] = 'cousin once removed (descendant)'
        # add Cousin twice removed (descendant)
        all_cousins_o_r = [i for i in Converter if Converter[i] in ['cousin once removed (descendant)']]
        for cousin in all_cousins_o_r:
            Converter[cousin + '-s'] = 'cousin twice removed (descendant)'
            Converter[cousin + '-d'] = 'cousin twice removed (descendant)'
            Converter[cousin + '-c'] = 'cousin twice removed (descendant)'
        # add First cousin once removed (ascendant)
        all_g_auncle = [i for i in Converter if Converter[i] in ['granduncle', 'grandaunt', 'grandauncle']]
        for g_auncle in all_g_auncle:
            Converter[g_auncle + '-s'] = 'cousin once removed (ascendant)'
            Converter[g_auncle + '-d'] = 'cousin once removed (ascendant)'
            Converter[g_auncle + '-c'] = 'cousin once removed (ascendant)'
        # add Second Cousin
        all_cora = [i for i in Converter if Converter[i] in ['cousin once removed (ascendant)']]
        for cora in all_cora:
            Converter[cora + '-s'] = 'second cousin'
            Converter[cora + '-d'] = 'second cousin'
            Converter[cora + '-c'] = 'second cousin'
        # add Second Cousin once removed
        all_s_cousins = [i for i in Converter if Converter[i] in ['second cousin']]
        for s_cousin in all_s_cousins:
            Converter[s_cousin + '-s'] = 'second cousin once removed (descendant)'
            Converter[s_cousin + '-d'] = 'second cousin once removed (descendant)'
            Converter[s_cousin + '-c'] = 'second cousin once removed (descendant)'
        # add Second Cousin twice removed
        all_s_cousins_o_r = [i for i in Converter if Converter[i] in ['second cousin once removed (descendant)']]
        for s_cousin_o_r in all_s_cousins_o_r:
            Converter[s_cousin_o_r + '-s'] = 'second cousin twice removed (descendant)'
            Converter[s_cousin_o_r + '-d'] = 'second cousin twice removed (descendant)'
            Converter[s_cousin_o_r + '-c'] = 'second cousin twice removed (descendant)'

        # calculate direction change (if more then 2, not blood relative)
        def count_direction_change(relation_tag):
            """If you are going down from proband, you need to keep going down
            If you are going up from proband, you can change direction once
            If you are out of these cases, you are not blood relative
            We make an exception for the Husband and Wife"""
            up = ['f', 'm']
            down = ['d', 's', 'c']
            state = 1
            changes = 0
            for a_letter in relation_tag.split('-'):
                if a_letter in up:
                    new_state = 1
                elif a_letter in down:
                    new_state = -1
                else:  # p
                    continue
                if state == new_state:
                    continue
                else:
                    state = new_state
                    changes += 1
            return changes

        relations = []
        for i in links:
            association = ''
            val = links[i][0]
            if val in Converter:
                relation = Converter[val]
                # calculate half relation for siblings
                if relation in ['sister', 'brother', 'sibling']:
                    # if they are full siblings, they should carry two link of same size
                    # if not, they are half
                    if len(links[i]) == 1:
                        relation = 'half-' + relation
                # for extended family calculate paternal/maternal
                if len(val) > 4:
                    # calculate for family that starts by going above 2 levels
                    if val[2:5] in ['m-m', 'm-f', 'f-f', 'f-m']:
                        association_pointer = val[2]
                        if association_pointer == 'f':
                            association = 'paternal'
                        elif association_pointer == 'm':
                            association = 'maternal'
            else:
                dir_change = count_direction_change(val)
                if dir_change > 1:
                    relation = 'family-in-law'
                else:
                    relation = 'extended-family'
            relations.append([i, relation, association])
        return relations

    @calculated_property(schema={
        "title": "Relationships",
        "description": "Relationships to proband.",
        "type": "array",
        "items": {
            "title": "Relation",
            "type": "object",
            "properties": {
                "individual": {
                    "title": "Individual",
                    "type": "string"
                },
                "association": {
                    "title": "Individual",
                    "type": "string",
                    "enum": [
                        "paternal",
                        "maternal"
                    ]
                },
                "sex": {
                    "title": "Sex",
                    "type": "string",
                    "enum": [
                        "F",
                        "M",
                        "U"
                    ]
                },
                "relationship": {
                    "title": "Relationship",
                    "type": "string",
                    "enum": ['proband',
                             'father',
                             'mother',
                             'brother',
                             'sister',
                             'sibling',
                             'half-brother',
                             'half-sister',
                             'half-sibling',
                             'wife',
                             'husband',
                             'grandson',
                             'granddaughter',
                             'grandchild',
                             'grandmother',
                             'grandfather',
                             'great-grandmother',
                             'great-grandfather',
                             'great-great-grandmother',
                             'great-great-grandfather',
                             'nephew',
                             'niece',
                             'nibling',
                             'grandnephew',
                             'grandniece',
                             'grandnibling',
                             'uncle',
                             'aunt',
                             'auncle',
                             'granduncle',
                             'grandaunt',
                             'grandauncle',
                             'cousin',
                             'cousin once removed (descendant)',
                             'cousin twice removed (descendant)',
                             'cousin once removed (ascendant)',
                             'second cousin',
                             'second cousin once removed (descendant)',
                             'second cousin twice removed (descendant)',
                             'family-in-law',
                             'extended-family',
                             'not linked'
                             ]
                    }
                }
            }
        })
    def relationships(self, request, proband=None, members=None):
        """Calculate relationships"""
        # Start of the function
        # empty list to accumulate results
        relations = []
        # we need both the proband and the members to calculate
        if not proband or not members:
            return relations
        family_id = self.properties['accession']
        # collect members properties
        all_props = []
        for a_member in members:
            # This might be a step to optimize if families get larger
            # TODO: make sure all mother fathers are in member list, if not fetch them too
            #  for complete connection tracing
            props = get_item_or_none(request, a_member, 'individuals')
            all_props.append(props)
        # convert to ped_file format
        ped_text = self.generate_ped(all_props, proband, family_id)
        primary_vectors = self.extract_vectors(ped_text)
        proband_acc = proband.split('/')[2]
        links = self.construct_links(primary_vectors, proband_acc)
        relations = self.relationships_vocabulary(links)
        results = []
        for a_member in members:
            a_member_resp = [i for i in all_props if i['@id'] == a_member][0]
            temp = {"individual": '',
                    "sex": '',
                    "relationship": '',
                    "association": ''}
            mem_acc = a_member_resp['accession']
            temp['individual'] = mem_acc
            sex = a_member_resp.get('sex', 'U')
            temp['sex'] = sex
            relation_dic = [i for i in relations if i[0] == mem_acc]
            if not relation_dic:
                temp['relationship'] = 'not linked'
                # the individual is not linked to proband through individuals listed in members
                results.append(temp)
                continue
            relation = relation_dic[0]
            temp['relationship'] = relation[1]
            if relation[2]:
                temp['association'] = relation[2]
            results.append(temp)
        return results

    @calculated_property(schema={
        "title": "Display Title",
        "description": "A calculated title for every object in 4DN",
        "type": "string"
    })
    def display_title(self, accession, title=None, family_id=None):
        if title:
            return '{} ({})'.format(title, accession)
        elif family_id:
            return '{} ({})'.format(family_id, accession)
        else:
            return accession

    @calculated_property(schema={
        "title": "Analysis Groups",
        "description": "Analysis groups (sample_processing items) this family is in",
        "type": "array",
        "items": {
            "title": "Analysis Group",
            "type": "string",
            "linkTo": "SampleProcessing"
        }
    })
    def analysis_groups(self, request):
        result = self.rev_link_atids(request, "sample_procs")
        if result:
            return result

    @calculated_property(schema={
        "title": "Mother",
        "description": "Mother of proband",
        "type": "string",
        "linkTo": "Individual"
    })
    def mother(self, request, proband=None, members=[]):
        if proband and members:
            props = get_item_or_none(request, proband, 'individuals')
            if props and props.get('mother'):
                return props['mother']

    @calculated_property(schema={
        "title": "Father",
        "description": "Father of proband",
        "type": "string",
        "linkTo": "Individual"
    })
    def father(self, request, proband=None, members=[]):
        if proband and members:
            props = get_item_or_none(request, proband, 'individuals')
            if props and props.get('father') and props['father'] in members:
                return props['father']


@view_config(name='process-pedigree', context=Family, request_method='PATCH',
             permission='edit')
@debug_log
def process_pedigree(context, request):
    """
    Endpoint to handle creation of a family of individuals provided a pedigree
    file. Uses a webtest TestApp to handle POSTing and PATCHing items.
    The request.json contains attachment information and file content.

    Currently, only handles XML input formatted from the Proband app.
    This endpoint takes the following options, provided through request params:
    - config_uri: should be 'development.ini' for dev, else 'production.ini'

    Response dict contains the newly created family.

    Args:
        request (Request): the current request. Attachment data should be
            given in the request JSON.

    Returns:
        dict: reponse, including 'status', and 'family' on success

    Raises:
        HTTPUnprocessableEntity: on an error. Extra information may be logged
    """
    import mimetypes
    from pyramid.paster import get_app
    from webtest import TestApp
    from base64 import b64encode
    from xml.etree.ElementTree import fromstring

    family_item = str(context.uuid)  # used in logging

    # verify that attachment data in request.json has type and href
    if not {'download', 'type', 'href'} <= set(request.json.keys()):
        raise HTTPUnprocessableEntity('Family %s: Request JSON must include following'
                                      ' keys: download, type, href. Found: %s'
                                      % (family_item, request.json.keys()))
    # verification on the attachment. Currently only handle .pbxml
    # pbxml uploads don't get `type` attribute from <input> element
    if request.json['type'] != '' or not request.json['download'].endswith('.pbxml'):
        raise HTTPUnprocessableEntity('Family %s: Bad pedigree file upload. Use .pbxml'
                                      ' file. Found: %s (file type), %s (file name)'
                                      % (family_item, request.json['type'], request.json['download']))

    config_uri = request.params.get('config_uri', 'production.ini')
    # TODO: get pedigree timestamp dynamically, maybe from query_params
    # ped_timestamp = request.params.get('timestamp')
    ped_datetime = datetime.utcnow()
    ped_timestamp = ped_datetime.isoformat() + '+00:00'
    app = get_app(config_uri, 'app')
    # get user email for TestApp authentication
    email = getattr(request, '_auth0_authenticated', None)
    if not email:
        user_uuid = None
        for principal in request.effective_principals:
            if principal.startswith('userid.'):
                user_uuid = principal[7:]
                break
        if not user_uuid:
            raise HTTPUnprocessableEntity('Family %s: Must provide authentication' % family_item)
        user_props = get_item_or_none(request, user_uuid)
        email = user_props['email']
    environ = {'HTTP_ACCEPT': 'application/json', 'REMOTE_USER': email}
    testapp = TestApp(app, environ)

    # parse XML and create family by two rounds of POSTing/PATCHing individuals
    response = {'title': 'Pedigree Processing'}
    refs = {}
    try:
        xml_data = etree_to_dict(fromstring(request.json['href']), refs, 'managedObjectID')
    except Exception as exc:
        response['status'] = 'failure'
        response['detail'] = 'Error parsing pedigree XML: %s' % str(exc)
        return response

    # add "affected" metadata to refs for easy access
    family_pheno_feats = []
    for meta_key, meta_val in xml_data.get('meta', {}).items():
        if meta_key.startswith('affected'):
            refs[meta_key] = meta_val
            if meta_val.get('id') and meta_val.get('ontology') == 'HPO':
                family_pheno_feats.append(meta_val['id'])

    # extra values that are used when creating the pedigree
    fam_props = context.upgrade_properties()
    post_extra = {'project': fam_props['project'],
                  'institution': fam_props['institution']}
    xml_extra = {'ped_datetime': ped_datetime}

    family_uuids = create_family_proband(testapp, xml_data, refs, 'managedObjectID',
                                         family_item, post_extra, xml_extra)

    # create Document for input pedigree file
    # pbxml files are not handled by default. Do some mimetype processing
    mimetypes.add_type('application/proband+xml', '.pbxml')
    use_type = 'application/proband+xml'
    data_href = 'data:%s;base64,%s' % (use_type, b64encode(request.json['href'].encode()).decode('ascii'))
    attach = {'attachment': {'download': request.json['download'],
                             'type': use_type, 'href': data_href}}
    attach.update(post_extra)
    try:
        attach_res = testapp.post_json('/Document', attach)
        assert attach_res.status_code == 201
    except Exception as exc:
        log.error('Failure to POST Document in process-pedigree! Exception: %s' % exc)
        error_msg = ('Family %s: Error encountered on POST in process-pedigree.'
                     ' Check logs. These items were already created: %s'
                     % (family_item, family_uuids['members']))
        raise HTTPUnprocessableEntity(error_msg)

    # add extra fields to the family object
    attach_uuid = attach_res.json['@graph'][0]['uuid']
    family_uuids['original_pedigree'] = attach_uuid
    family_uuids['timestamp'] = ped_timestamp
    if xml_data.get('meta', {}).get('notes'):
        family_uuids['clinic_notes'] = xml_data['meta']['notes']
    ped_src = 'Proband app'
    if xml_data.get('meta', {}).get('version'):
        ped_src += (' ' + xml_data['meta']['version'])
    family_uuids['pedigree_source'] = ped_src
    family_uuids['family_phenotypic_features'] = []
    for hpo_id in family_pheno_feats:
        try:
            pheno_res = testapp.get('/phenotypes/' + hpo_id, status=200).json
        except Exception as exc:
            error_msg = ('Family %s: Cannot GET family feature %s. Error: %s'
                         % (family_item, hpo_id, str(exc)))
            log.error(error_msg)
            # HACKY. Skip raising this error if local
            if config_uri == 'production.ini':
                raise HTTPUnprocessableEntity(error_msg)
        else:
            family_uuids['family_phenotypic_features'].append(pheno_res['uuid'])

    # PATCH the Cohort with new family
    # cohort_families = cohort_props.get('families', []) + [family_uuids]
    # cohort_patch = {'families': cohort_families}
    try:
        fam_res = testapp.patch_json('/' + family_item, family_uuids)
        assert fam_res.status_code == 200
    except Exception as exc:
        log.error('Failure to PATCH Family %s in process-pedigree with '
                  'data %s! Exception: %s' % (family_item, family_uuids, exc))
        error_msg = ('Family %s: Error encountered on PATCH in process-pedigree.'
                     ' Check logs. These items were already created: %s'
                     % (family_item, family_uuids['members'] + [attach_uuid]))
        raise HTTPUnprocessableEntity(error_msg)

    # get the fully embedded cohort to put in response for front-end
    response['context'] = testapp.get('/families/' + family_item + '?frame=page&datastore=database', status=200).json
    response['status'] = 'success'
    return response


#####################################
# ## Pedigree processing functions ###
#####################################


def convert_age_units(age_unit):
    """
    Simple function to convert proband age units to cgap standard

    Args:
        age_unit (str): proband age unit

    Return:
        str: cgap age unit
    """
    convert_dict = {
        "d": "day",
        "w": "week",
        "m": "month",
        "y": "year"
    }
    return convert_dict[age_unit.lower()]


def age_to_birth_year(xml_obj):
    """
    Simple conversion function that takes an individual from the xml and
    converts age to birth year, taking age units into account

    Args:
        xml_obj (dict): xml data for the individual

    Returns:
        int: year of birth
    """
    if xml_obj.get('age') is None or xml_obj.get('ageUnits') is None:
        return None
    delta_kwargs = {convert_age_units(xml_obj['ageUnits']) + 's': int(xml_obj['age'])}
    rel_delta = relativedelta(**delta_kwargs)
    birth_datetime = xml_obj['ped_datetime'] - rel_delta
    return birth_datetime.year


def alive_and_well(xml_obj):
    """
    Simple conversion function that uses 'deceased' and 'aw' fields from the
    xml person object to determine Individual 'life_status'

    Args:
        xml_obj (dict): xml data for the individual

    Returns:
        str: life_status
    """
    if xml_obj['deceased'] == '1':
        return 'deceased'
    elif xml_obj['aw'] == '1':
        return 'alive and well'
    else:
        return 'alive'


def convert_to_list(xml_value):
    """
    An expected list of references is None for zero values, a dict for
    one value, and a list for two or more values. Use this function to
    standardize to a list. If individual items contain an "@ref" field, use
    that in the returned list, otherwise return the whole item

    Args:
        xml_value (dict or list): value to transform to a list

    Returns:
        list: processed list of values from original xml_value
    """
    if not xml_value:
        return []
    elif isinstance(xml_value, dict):
        return [xml_value.get('@ref', xml_value)]

    else:
        return [val.get('@ref', val) for val in xml_value]


def descendancy_xml_ref_to_parents(testapp, ref_id, refs, data, family_item, uuids_by_ref):
    """
    This is a `xml_ref_fxn`, so it must take the correpsonding args in the
    standardized way and return a dictionary that is used to update the
    object to be POSTed/PATCHed.

    Helper function to use specifically with `descendacy` object reference
    in input XML. Uses the string reference id and input dictionary of refs
    to find the object, look up parents based off of gender, and return
    them in a standardized way.

    Args:
        testapp (webtest.TestApp): test application for posting/patching
        ref_id (str): value for the reference field of the relevant xml obj
        refs: (dict): reference-based parsed XML data
        data (dict): metadata to POST/PATCH
        family_item (str): identifier of the family
        uuids_by_ref (dict): mapping of Fourfront uuids by xml ref

    Returns:
        None
    """
    result = {'mother': None, 'father': None}
    error_msg = None
    relationship = refs[ref_id]
    parents = relationship.get('members', [])
    if len(parents) != 2:
        error_msg = ('Family %s: Failure to parse two parents from relationship '
                     'ref %s in process-pedigree. Contents: %s'
                     % (family_item, ref_id, relationship))
    for parent in parents:
        parent_obj = refs[parent['@ref']]
        if parent_obj['sex'].lower() == 'm':
            result['father'] = uuids_by_ref[parent['@ref']]
        elif parent_obj['sex'].lower() == 'f':
            result['mother'] = uuids_by_ref[parent['@ref']]
    if error_msg is None and (not result['mother'] or not result['father']):
        error_msg = ('Family %s: Failure to get valid mother and father from XML'
                     'for relationship ref %s in process-pedigree. Parent refs: %s'
                     % (family_item, ref_id, parents))
    if error_msg:
        log.error(error_msg)
        raise HTTPUnprocessableEntity(error_msg)
    data.update(result)


def add_to_clinic_notes(testapp, notes, refs, data, family_item, uuids_by_ref):
    """
    This is a `xml_ref_fxn`, so it must take the corresponding args in the
    standardized way and update the `data` dictionary, which is used to PATCH
    the Individual item.

    Helper function to add `notes` from the object in way compatible with the
    other functions that change `clinic_notes`

    Args:
        testapp (webtest.TestApp): test application for posting/patching
        notes (str): notes value for the object
        refs: (dict): reference-based parsed XML data
        data (dict): metadata to POST/PATCH
        family_item (str): identifier of the family
        uuids_by_ref (dict): mapping of Fourfront uuids by xml ref

    Returns:
        None
    """
    if data.get('clinic_notes'):
        clinic_notes = '\n'.join([data['clinic_notes'], notes])
    else:
        clinic_notes = notes
    data['clinic_notes'] = clinic_notes


def annotations_xml_ref_to_clinic_notes(testapp, ref_ids, refs, data, family_item, uuids_by_ref):
    """
    This is a `xml_ref_fxn`, so it must take the corresponding args in the
    standardized way and update the `data` dictionary, which is used to PATCH
    the Individual item.

    Helper function to use specifically with `annotations` object reference
    in input XML. Uses the string reference id and input dictionary of refs
    to find the annotations used as note .

    Args:
        testapp (webtest.TestApp): test application for posting/patching
        ref_ids (list): value for the reference field of the relevant xml obj
        refs: (dict): reference-based parsed XML data
        data (dict): metadata to POST/PATCH
        family_item (str): identifier of the family
        uuids_by_ref (dict): mapping of Fourfront uuids by xml ref

    Returns:
        None
    """
    clinic_notes = []
    for annotation_ref in ref_ids:
        annotation_obj = refs[annotation_ref]
        if annotation_obj.get('text'):
            clinic_notes.append(annotation_obj['text'])
    if clinic_notes:
        if data.get('clinic_notes'):
            clinic_notes.insert(0, data['clinic_notes'])
        data['clinic_notes'] = '\n'.join(clinic_notes)


def diagnoses_xml_to_phenotypic_features(testapp, ref_vals, refs, data, family_item, uuids_by_ref):
    """
    This is a `xml_ref_fxn`, so it must take the corresponding args in the
    standardized way and update the `data` dictionary, which is used to PATCH
    the Individual item.

    Helper function to use specifically with `diagnoses` object values
    in input XML. Uses a list of dict ref_vals and converts to
    `phenotypic_features` or `clinic_notes` in the family metadata.

    Args:
        testapp (webtest.TestApp): test application for posting/patching
        ref_vals (list): list of dict diagnoses values
        refs: (dict): reference-based parsed XML data
        data (dict): metadata to POST/PATCH
        family_item (str): identifier of the family
        uuids_by_ref (dict): mapping of Fourfront uuids by xml ref

    Returns:
        None
    """
    # need Phenotype, onset_age, and onset_age_units
    pheno_feats = data.get('phenotypic_features', [])
    clinic_notes = []
    for diagnosis in ref_vals:
        found_term = False
        # only use HPO terms for now
        if diagnosis.get('id') and diagnosis.get('ontology') == 'HPO':
            pheno_feat_data = {}
            if diagnosis.get('ageAtDx'):
                pheno_feat_data['onset_age'] = int(diagnosis['ageAtDx'])
            if diagnosis.get('ageAtDx') and diagnosis.get('ageAtDxUnits'):
                pheno_feat_data['onset_age_units'] = convert_age_units(diagnosis['ageAtDxUnits'])
            if diagnosis:
                # look up HPO term. If not found, use a clinical note
                try:
                    pheno_res = testapp.get('/phenotypes/' + diagnosis['id'] + '/', status=200).json
                except Exception as exc:
                    log.error('Family %s: Cannot GET term %s. Error: %s'
                              % (family_item, diagnosis['id'], str(exc)))
                else:
                    found_term = True
                    if pheno_res['uuid'] not in [item['phenotypic_feature'] for item in pheno_feats]:
                        pheno_feat_data['phenotypic_feature'] = pheno_res['uuid']
                        pheno_feats.append(pheno_feat_data)

        # if we cannot find the term, update the clinical notes
        if diagnosis.get('name') and not found_term:
            dx_note = 'Diagnosis: ' + diagnosis['name']
            if diagnosis.get('ageAtDx') and diagnosis.get('ageAtDxUnits'):
                dx_note += (' at ' + diagnosis['ageAtDx'] + ' ' +
                            convert_age_units(diagnosis['ageAtDxUnits']) + 's')
            if diagnosis['id']:
                dx_note += ' (HPO term %s not found)' % diagnosis['id']
            clinic_notes.append(dx_note)

    if pheno_feats:
        data['phenotypic_features'] = pheno_feats
    if clinic_notes:
        if data.get('clinic_notes'):
            clinic_notes.insert(0, data['clinic_notes'])
        data['clinic_notes'] = '\n'.join(clinic_notes)


def affected_xml_to_phenotypic_features(testapp, ref_vals, refs, data, family_item, uuids_by_ref):
    """
    This is a `xml_ref_fxn`, so it must take the corresponding args in the
    standardized way and update the `data` dictionary, which is used to PATCH
    the Individual item.

    Helper function to use specifically with `affected` object references
    in input XML. Uses a list of dict ref_vals and converts to
    `phenotypic_features` or `clinic_notes` in the family metadata.

    Args:
        testapp (webtest.TestApp): test application for posting/patching
        ref_vals (list): list of dict affected values (should only have 1 item)
        refs: (dict): reference-based parsed XML data
        data (dict): metadata to POST/PATCH
        family_item (str): identifier of the family
        uuids_by_ref (dict): mapping of Fourfront uuids by xml ref

    Returns:
        None
    """
    if ref_vals[0]['affected'] != '1':
        return
    found_aff_val = refs[ref_vals[0]['meta']].copy()
    # make sure these are consistently set from the `person` xml data
    found_aff_val.update(ref_vals[0])
    diagnoses_xml_to_phenotypic_features(testapp, [found_aff_val], refs, data,
                                         family_item, uuids_by_ref)


def cause_of_death_xml_to_phenotype(testapp, ref_vals, refs, data, family_item, uuids_by_ref):
    """
    This is a `xml_ref_fxn`, so it must take the corresponding args in the
    standardized way and update the `data` dictionary, which is used to PATCH
    the Individual item.

    Helper function to use specifically with `causeOfDeath` object references
    in input XML. Uses a list of dict ref_vals and converts to
    `cause_of_death` or `clinic_notes` in the family metadata.

    Args:
        testapp (webtest.TestApp): test application for posting/patching
        ref_vals (list): list of dict containg cause of death info (should be length 1)
        refs: (dict): reference-based parsed XML data
        data (dict): metadata to POST/PATCH
        family_item (str): identifier of the family
        uuids_by_ref (dict): mapping of Fourfront uuids by xml ref

    Returns:
        None
    """
    clinic_notes = []
    for xml_obj in ref_vals:
        found_term = False
        # only use HPO terms for now
        if xml_obj.get('causeOfDeathOntologyId') and xml_obj.get('causeOfDeathOntology') == 'HPO':
            # look up HPO term. If not found, use a clinical note
            try:
                pheno_res = testapp.get('/phenotypes/' + xml_obj['causeOfDeathOntologyId'] + '/', status=200).json
            except Exception as exc:
                log.error('Family %s: Cannot GET term %s. Error: %s'
                          % (family_item, xml_obj['causeOfDeathOntologyId'], str(exc)))
            else:
                found_term = True
                data['cause_of_death'] = pheno_res['uuid']

        # if we cannot find the term, update the clinical notes
        if xml_obj.get('causeOfDeath') and not found_term:
            dx_note = 'Cause of death: ' + xml_obj['causeOfDeath']
            if xml_obj['causeOfDeathOntologyId']:
                dx_note += ' (HPO term %s not found)' % xml_obj['causeOfDeathOntologyId']
            clinic_notes.append(dx_note)

    if clinic_notes:
        if data.get('clinic_notes'):
            clinic_notes.insert(0, data['clinic_notes'])
        data['clinic_notes'] = '\n'.join(clinic_notes)


def etree_to_dict(ele, ref_container=None, ref_field=''):
    """
    Helper function to recursively parse ElementTree (XML) to Python objects.
    Follows the following rules:
    - Creates a dictionary for the element if it has children or attributes
    - If an element has children and no other attributes/text, it will be used
        as a wrapper object and collapsed to contain its children directly
    - If multiple children share the same tag, they will be a list
    - If only one child uses a tag, it will not be a list
    - If an element is a dict, text will be added as a key named the same
    - If an element has no children or attributes, text will be returned as
        as string. If no text, return None

    Additionally, if a ref_container is provided, will add elements with a
    `managedObjectID` value

    Args:
        ele (xml.etree.ElementTree): root Element in the ElementTree
        ref_container (dict): keep referenced items found in tree. Keyed
            by reference value. Must also set `ref_field` to work. Default None
        ref_field (str): if provided, add elements containing this reference
            field to `ref_container`. Default is empty string (i.e. not used)

    Returns:
        dict: representation of the XML
    """
    ret = None

    # represent the element with a dict if there are children or attributes
    children = ele.getchildren()
    if children or ele.attrib:
        ret = {}
        # add child elements and attributes from this element
        for child in children:
            # make into a list if the element is found multiple times
            if child.tag in ret:
                if not isinstance(ret[child.tag], list):
                    ret[child.tag] = [ret[child.tag]]
                ret[child.tag].append(etree_to_dict(child, ref_container, ref_field))
            else:
                ret[child.tag] = etree_to_dict(child, ref_container, ref_field)
        ret.update(('@' + k, v) for k, v in ele.attrib.items())

        # handle reference storage
        if ref_field and ref_container is not None and ref_field in ret:
            ref_container[ret[ref_field]] = ret

    # text is either added to the dictionary or used as terminal element
    if ele.text:
        if ret:
            ret['text'] = ele.text
        else:
            return ele.text

    # if children are the only contents of this level, collapse
    if children and len(ret) == 1:
        return ret[list(ret)[0]]

    return ret


def create_family_proband(testapp, xml_data, refs, ref_field, family_item,
                          post_extra=None, xml_extra=None):
    """
    Proband-specific object creation protocol. We can expand later on

    General process (in development):
    - POST individuals with required fields and attribution (`post_extra` kwarg)
    - PATCH non-required fields

    Can be easily extended by adding tuples to `to_convert` dict

    Args:
        testapp (webtest.TestApp): test application for posting/patching
        xml_data (dict): parsed XMl data, probably from `etree_to_dict`
        refs: (dict): reference-based parsed XML data
        ref_field (str): name of reference field from the XML data
        family_item (str): identifier of the family
        post_extra (dict): keys/values given here are added to POST
        xml_extra (dict): key/values given here are added to each XML object
            processed using the PROBAND_MAPPING

    Returns:
        dict: family created, including members and proband with full context
    """
    # key family members by uuid
    family_members = {}
    uuids_by_ref = {}
    proband = None
    errors = []
    xml_type = 'people'
    item_type = 'Individual'
    for round in ['first', 'second']:
        for xml_obj in xml_data.get(xml_type, []):
            ref = xml_obj.get(ref_field)
            if not ref:  # element does not have a managed ID
                continue
            data = {}
            if round == 'first' and post_extra is not None:
                data.update(post_extra)
            if xml_extra is not None:
                xml_obj.update(xml_extra)
            for xml_key in xml_obj:
                converted = PROBAND_MAPPING[item_type].get(xml_key)
                if converted is None:
                    log.info('Unknown field %s for %s in process-pedigree!' % (xml_key, item_type))
                    continue
                # convert all conversions to lists, since some xml fields map
                # to multiple metadata fields and this makes it simpler
                if not isinstance(converted, list):
                    converted = [converted]
                for converted_dict in converted:
                    if round == 'first':
                        if converted_dict.get('linked', False) is True:
                            continue
                        ref_val = converted_dict['value'](xml_obj)
                        if ref_val is not None:
                            data[converted_dict['corresponds_to']] = ref_val
                    elif round == 'second':
                        if converted_dict.get('linked', False) is False:
                            continue
                        ref_val = converted_dict['value'](xml_obj)
                        # more complex function based on xml refs needed
                        if ref_val is not None and 'xml_ref_fxn' in converted_dict:
                            # will update data in place
                            converted_dict['xml_ref_fxn'](testapp, ref_val, refs, data,
                                                          family_item, uuids_by_ref)
                        elif ref_val is not None:
                            data[converted_dict['corresponds_to']] = uuids_by_ref[ref_val]

            # POST if first round
            if round == 'first':
                try:
                    post_res = testapp.post_json('/' + item_type, data)
                    assert post_res.status_code == 201
                except Exception as exc:
                    log.error('Failure to POST %s in process-pedigree with '
                              'data %s! Exception: %s' % (item_type, data, exc))
                    error_msg = ('Family %s: Error encountered on POST in process-pedigree.'
                                 ' Check logs. These items were already created: %s'
                                 % (family_item, list(uuids_by_ref.values())))
                    raise HTTPUnprocessableEntity(error_msg)
                else:
                    idv_props = post_res.json['@graph'][0]
                    uuids_by_ref[ref] = idv_props['uuid']

            # PATCH if second round, with adding uuid to the data
            if round == 'second' and data:
                try:
                    patch_res = testapp.patch_json('/' + uuids_by_ref[ref], data)
                    assert patch_res.status_code == 200
                except Exception as exc:
                    log.error('Failure to PATCH %s in process-pedigree with '
                              'data %s! Exception: %s' % (uuids_by_ref[ref], data, exc))
                    error_msg = ('Family %s: Error encountered on PATCH in process-pedigree.'
                                 ' Check logs. These items were already created: %s'
                                 % (family_item, list(uuids_by_ref.values())))
                    raise HTTPUnprocessableEntity(error_msg)
                else:
                    idv_props = patch_res.json['@graph'][0]

            # update members info on POST or PATCH
            family_members[idv_props['uuid']] = idv_props
            # update proband only on first round (not all items hit in second)
            if round == 'first' and xml_obj.get('proband') == '1':
                if proband and idv_props['uuid'] != proband:
                    log.error('Family %s: Multiple probands found! %s conflicts with %s'
                              % (family_item, idv_props['uuid'], proband))
                else:
                    proband = idv_props['uuid']

    # process into family structure, keeping only uuids of items
    # invert uuids_by_ref to sort family members by managedObjectID (xml ref)
    refs_by_uuid = {v: k for k, v in uuids_by_ref.items()}
    family = {'members': sorted([m['uuid'] for m in family_members.values()],
                                key=lambda v: int(refs_by_uuid[v]))}
    if proband and proband in family_members:
        family['proband'] = family_members[proband]['uuid']
    else:
        log.error('Family %s: No proband found' % family_item)
    return family


PROBAND_MAPPING = {
    'Individual': {
        'sex': {
            'corresponds_to': 'sex',
            'value': lambda v: v['sex'].upper()
        },
        'deceased': {
            'corresponds_to': 'is_deceased',
            'value': lambda v: v['deceased'] == '1'
        },
        'aw': {
            'corresponds_to': 'life_status',
            'value': lambda v: alive_and_well(v)
        },
        'age': [
            {
                'corresponds_to': 'birth_year',
                'value': lambda v: age_to_birth_year(v)
            },
            {
                'corresponds_to': 'age',
                'value': lambda v: int(v['age']) if v['age'] is not None else None
            }
        ],
        'ageUnits': {
            'corresponds_to': 'age_units',
            'value': lambda v: convert_age_units(v['ageUnits']) if (v['age'] and v['ageUnits']) else None
        },
        'ageAtDeath': {
            'corresponds_to': 'age_at_death',
            'value': lambda v: int(v['ageAtDeath']) if v['ageAtDeath'] is not None else None
        },
        'ageAtDeathUnits': {
            'corresponds_to': 'age_at_death_units',
            'value': lambda v: convert_age_units(v['ageAtDeathUnits']) if (v['ageAtDeath'] and v['ageAtDeathUnits']) else None
        },
        'quantity': {
            'corresponds_to': 'quantity',
            'value': lambda v: int(v['quantity']) if v['quantity'] is not None else None
        },
        'p': {
            'corresponds_to': 'is_pregnancy',
            'value': lambda v: v['p'] == '1'
        },
        'gestAge': {
            'corresponds_to': 'gestational_age',
            'value': lambda v: int(v['gestAge']) if v['gestAge'] is not None else None
        },
        'sab': {
            'corresponds_to': 'is_spontaneous_abortion',
            'value': lambda v: v['sab'] == '1'
        },
        'top': {
            'corresponds_to': 'is_termination_of_pregnancy',
            'value': lambda v: v['top'] == '1'
        },
        'stillBirth': {
            'corresponds_to': 'is_still_birth',
            'value': lambda v: v['stillBirth'] == '1'
        },
        'noChildrenByChoice': {
            'corresponds_to': 'is_no_children_by_choice',
            'value': lambda v: v['noChildrenByChoice'] == '1'
        },
        'noChildrenInfertility': {
            'corresponds_to': 'is_infertile',
            'value': lambda v: v['noChildrenInfertility'] == '1'
        },
        'infertilityReason': {
            'corresponds_to': 'cause_of_infertility',
            'value': lambda v: v['infertilityReason']
        },
        'explicitlySetBiologicalFather': {
            'corresponds_to': 'father',
            'value': lambda v: v['explicitlySetBiologicalFather']['@ref'] if v['explicitlySetBiologicalFather'] else None,
            'linked': True
        },
        'explicitlySetBiologicalMother': {
            'corresponds_to': 'mother',
            'value': lambda v: v['explicitlySetBiologicalMother']['@ref'] if v['explicitlySetBiologicalMother'] else None,
            'linked': True
        },
        'note': {
            'xml_ref_fxn': add_to_clinic_notes,
            'value': lambda v: v['note'],
            'linked': True
        },
        'descendancy': {
            'xml_ref_fxn': descendancy_xml_ref_to_parents,
            'value': lambda v: v['descendancy']['@ref'] if v['descendancy'] else None,
            'linked': True
        },
        'annotations': {
            'xml_ref_fxn': annotations_xml_ref_to_clinic_notes,
            'value': lambda v: convert_to_list(v['annotations']),
            'linked': True
        },
        'diagnoses': {
            'xml_ref_fxn': diagnoses_xml_to_phenotypic_features,
            'value': lambda v: convert_to_list(v['diagnoses']),
            'linked': True
        },
        'causeOfDeath': {
            'xml_ref_fxn': cause_of_death_xml_to_phenotype,
            'value': lambda v: convert_to_list(v),
            'linked': True
        },
        'affected1': {
            'xml_ref_fxn': affected_xml_to_phenotypic_features,
            'value': lambda v: [{'meta': 'affected1', 'affected': v['affected1'], 'ageAtDx': v['affected1DxAge'], 'ageAtDxUnits': v['affected1DxAgeUnits']}],
            'linked': True
        },
        'affected2': {
            'xml_ref_fxn': affected_xml_to_phenotypic_features,
            'value': lambda v: [{'meta': 'affected2', 'affected': v['affected2'], 'ageAtDx': v['affected2DxAge'], 'ageAtDxUnits': v['affected2DxAgeUnits']}],
            'linked': True
        },
        'affected3': {
            'xml_ref_fxn': affected_xml_to_phenotypic_features,
            'value': lambda v: [{'meta': 'affected3', 'affected': v['affected3'], 'ageAtDx': v['affected3DxAge'], 'ageAtDxUnits': v['affected3DxAgeUnits']}],
            'linked': True
        },
        'affected4': {
            'xml_ref_fxn': affected_xml_to_phenotypic_features,
            'value': lambda v: [{'meta': 'affected4', 'affected': v['affected4'], 'ageAtDx': v['affected4DxAge'], 'ageAtDxUnits': v['affected4DxAgeUnits']}],
            'linked': True
        }
    }
}
