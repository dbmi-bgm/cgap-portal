import pytest
import mimetypes
import os
import magic
pytestmark = [pytest.mark.working, pytest.mark.schema]


def test_process_genelist_txt(testapp, project, institution):
    test_file = '/src/encoded/tests/data/documents/gene_lists/test1.txt'
    size = os.stat(test_file).st_size
    content = open(test_file).read()
    guessed_mime = mimetypes.guess_type(path)[0]
    detected_mime = magic.from_file(path, mime=True)
    print(content[:10])
    payload = {'size': size,
               'href': content,
               'download': test_file,
               'type': ""}
    item = {
        "accession": "GAPSAFATHER1",
        'project': project['@id'],
        'institution': institution['@id'],
        "bam_sample_id": "ext_id_004",
        "status": "released"
    }
    return testapp.post_json('/sample', item).json['@graph'][0]
