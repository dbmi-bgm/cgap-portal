from dcicutils.project_utils import C4ProjectRegistry
from snovault.project_defs import SnovaultProject

@C4ProjectRegistry.register('encoded')
class CGAPProject(SnovaultProject):
    NAMES = {"NAME": 'cgap-portal'}
    ACCESSION_PREFIX = 'GAP'


app_project = CGAPProject.app_project_maker()
