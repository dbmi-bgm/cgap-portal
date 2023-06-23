from dcicutils.project_utils import C4ProjectRegistry
from snovault.project_defs import SnovaultProject

@C4ProjectRegistry.register('encoded')
class CGAPProject(SnovaultProject):
    NAMES = {"NAME": 'cgap-portal'}
    ACCESSION_PREFIX = 'GAP'


# If you get a circularity importing this from here,
# it's OK to just copy this line into the file you were trying
# the import for. (You'll need to import C4ProjectRegistry like above, too.)
# -kmp 25-May-2023
app_project = C4ProjectRegistry.app_project_maker()
