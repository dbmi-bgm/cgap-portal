from dcicutils.project_utils import C4ProjectRegistry
from snovault.project_defs import SnovaultProject
from .project_env import APPLICATION_NAME, APPLICATION_PYPROJECT_NAME
from .project.authentication import CgapProjectAuthentication
from .project.authorization import CgapProjectAuthorization
from .project.ingestion import CgapProjectIngestion
from .project.loadxl import CgapProjectLoadxl

@C4ProjectRegistry.register(APPLICATION_PYPROJECT_NAME)
class CgapProject(CgapProjectAuthentication,
                  CgapProjectAuthorization,
                  CgapProjectIngestion,
                  CgapProjectLoadxl,
                  SnovaultProject):
    NAMES = {'NAME': APPLICATION_NAME, 'PYPI_NAME': APPLICATION_PYPROJECT_NAME}
    ACCESSION_PREFIX = "4DN"
