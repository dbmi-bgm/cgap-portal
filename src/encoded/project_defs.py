from snovault.project import (
    ProjectRegistry,
    Project as _Project  # renamed to avoid confusing programmers using discovery into thinking this is an export
)


@ProjectRegistry.register('encoded')
class CGAPProject(_Project):
    NAME = 'cgap-portal'
    ACCESSION_PREFIX = 'GAP'
