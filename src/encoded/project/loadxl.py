from snovault.project.loadxl import SnovaultProjectLoadxl

class CgapProjectLoadxl(SnovaultProjectLoadxl):

    def loadxl_order(self):
        return [
            'project',
            'institution',
            'user',
            'file_format',
            'workflow',
            'meta_workflow',
            'workflow_run',
            'meta_workflow_run',
            'variant',
            'structural_variant',
            'structural_variant_sample',
            'higlass_view_config'
        ]
