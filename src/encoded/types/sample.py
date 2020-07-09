from snovault import (
    calculated_property,
    collection,
    load_schema,
)
from .base import (
    Item,
    get_item_or_none
)


@collection(
    name='samples',
    unique_key='accession',
    properties={
        'title': 'Samples',
        'description': 'Listing of Samples',
    })
class Sample(Item):
    item_type = 'sample'
    name_key = 'accession'
    schema = load_schema('encoded:schemas/sample.json')
    rev = {'indiv': ('Individual', 'samples')}
    embedded_list = [
        "processed_files.workflow_run_outputs"
    ]

    @calculated_property(schema={
        "title": "Individual",
        "description": "Individual the sample belongs to",
        "type": "string",
        "linkTo": "Individual"
    })
    def individual(self, request):
        indivs = self.rev_link_atids(request, "indiv")
        if indivs:
            return indivs[0]

    @calculated_property(schema={
        "title": "Requisition Completed",
        "description": "True when Requisition Acceptance fields are completed",
        "type": "boolean"
    })
    def requisition_completed(self, request):
        props = self.properties
        req = props.get('requisition_acceptance', {})
        if req:
            if req.get('accepted_rejected') == 'Accepted':
                return True
            elif req.get('accepted_rejected') == 'Rejected' and req.get('date_completed'):
                return True
            else:
                return False
        elif any(props.get(item) for item in [
            'specimen_accession_date', 'specimen_accession',
            'date_requisition_received', 'accessioned_by'
        ]):
            return False


@collection(
    name='sample-processings',
    properties={
        'title': 'SampleProcessings',
        'description': 'Listing of Sample Processings',
    })
class SampleProcessing(Item):
    item_type = 'sample_processing'
    schema = load_schema('encoded:schemas/sample_processing.json')
    embedded_list = []
    rev = {'case': ('Case', 'sample_processing')}

    @calculated_property(schema={
        "title": "Cases",
        "description": "The case(s) this sample processing is for",
        "type": "array",
        "items": {
            "title": "Case",
            "type": "string",
            "linkTo": "Case"
        }
    })
    def cases(self, request):
        rs = self.rev_link_atids(request, "case")
        if rs:
            return rs

    @calculated_property(schema={
        "title": "Samples Pedigree",
        "description": "Relationships to proband for samples.",
        "type": "array",
        "items": {
            "title": "Sample Pedigree",
            "type": "object",
            "properties": {
                "individual": {
                    "title": "Individual",
                    "type": "string"
                },
                "sample_accession": {
                    "title": "Individual",
                    "type": "string"
                },
                "sample_name": {
                    "title": "Individual",
                    "type": "string"
                },
                "parents": {
                    "title": "Parents",
                    "type": "array",
                    "items": {
                        "title": "Parent",
                        "type": "string"
                    }
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
                    "type": "string"
                    }
                }
            }
        })
    def samples_pedigree(self, request, families=None, samples=None):
        """Filter Family Pedigree for samples to be used in QCs"""
        # If there are multiple families this will be problematic, return empty
        # We will need to know the context
        samples_pedigree = []
        if not families or not samples:
            return samples_pedigree
        # this part will need word (ie disregard relations and just return parents)
        if len(families) != 1:
            return samples_pedigree
        family = families[0]
        fam_data = get_item_or_none(request, family, 'families', frame='embedded')
        if not fam_data:
            return samples_pedigree
        members = fam_data.get('members', [])
        relations = fam_data.get('relationships', [])
        if not members:
            return samples_pedigree
        for a_sample in samples:
            temp = {
                "individual": "",
                "sample_accession": "",
                "sample_name": "",
                "parents": [],
                "relationship": "",
                "sex": "",
                # "association": ""  optional, add if exists
            }
            mem_infos = [i for i in members if a_sample in [x['@id'] for x in i.get('samples', [])]]
            if not mem_infos:
                continue
            mem_info = mem_infos[0]
            sample_info = [i for i in mem_info['samples'] if i['@id'] == a_sample][0]
            # fetch the calculated relation info
            relation_infos = [i for i in relations if i['individual'] == mem_info['accession']]
            # fill in temp dict
            temp['individual'] = mem_info['accession']
            temp['sex'] = mem_info.get('sex', 'U')
            parents = []
            for a_parent in ['mother', 'father']:
                if mem_info.get(a_parent):
                    parents.append(mem_info[a_parent]['display_title'])
            temp['parents'] = parents
            temp['sample_accession'] = sample_info['display_title']
            temp['sample_name'] = sample_info.get('bam_sample_id', '')
            if relation_infos:
                relation_info = relation_infos[0]
                temp['relationship'] = relation_info.get('relationship', '')
                if relation_info.get('association', ''):
                    temp['association'] = relation_info.get('association', '')
            samples_pedigree.append(temp)
        return samples_pedigree
