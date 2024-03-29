import pytest

# from datetime import datetime
from dcicutils.misc_utils import utc_today_str
from ..types.image import Image


pytestmark = [pytest.mark.setone, pytest.mark.working, pytest.mark.schema]


@pytest.fixture
def genomic_region_w_onlyendloc(testapp, institution, project):
    item = {
        "genome_assembly": "dm6",
        "end_coordinate": 3,
        'project': project['@id'],
        'institution': institution['@id']
    }
    return testapp.post_json('/genomic_region', item).json['@graph'][0]


@pytest.fixture
def protocol_data(institution, project):
    return {
        'institution': institution['@id'],
        'project': project['@id'],
        'protocol_type': 'Experimental protocol',
        'description': 'Test Protocol'
    }


@pytest.fixture
def protocol_w_attach(testapp, protocol_data, attachment):
    protocol_data['attachment'] = attachment
    return testapp.post_json('/protocol', protocol_data).json['@graph'][0]


def test_document_display_title_w_attachment(testapp, protocol_data, attachment):
    protocol_data['attachment'] = attachment
    del protocol_data['protocol_type']
    res = testapp.post_json('/document', protocol_data).json['@graph'][0]
    assert res.get('display_title') == 'red-dot.png'


def test_document_display_title_wo_attachment(testapp, protocol_data):
    del protocol_data['protocol_type']
    res = testapp.post_json('/document', protocol_data).json['@graph'][0]
    assert res.get('display_title') == 'Document from ' + utc_today_str()


@pytest.fixture
def google_analytics_tracking_data():
    return {
        "status": "shared",
        "tracking_type": "google_analytics",
        "google_analytics": {
            "reports": {
                "views_by_experiment_set": [
                    {
                        "ga:productCategoryLevel2": "ExperimentSetReplicate",
                        "ga:productName": "4DNESKSPBI9A",
                        "ga:productListClicks": 1,
                        "ga:productListViews": 21,
                        "ga:productSku": "4DNESKSPBI9A",
                        "ga:productDetailViews": 4,
                        "ga:productBrand": "Chuck Murry, UW"
                    }
                ],
                "fields_faceted": [
                    {
                        "ga:users": 12,
                        "ga:totalEvents": 19,
                        "ga:sessions": 13,
                        "ga:dimension3": "experiments_in_set.experiment_type.display_title"
                    },
                    {
                        "ga:users": 13,
                        "ga:totalEvents": 16,
                        "ga:sessions": 15,
                        "ga:dimension3": "experiments_in_set.biosample.biosource.individual.organism.name"
                    }
                ],
                "views_by_file": [
                    {
                        "ga:productCategoryLevel2": "FileProcessed",
                        "ga:productName": "4DNFIC2XS1Y3.mcool",
                        "ga:productListClicks": 0,
                        "ga:productListViews": 0,
                        "ga:productSku": "4DNFIC2XS1Y3",
                        "ga:productDetailViews": 1,
                        "ga:productBrand": "Erez Lieberman Aiden, BCM"
                    }
                ]
            },
            "for_date": "2019-05-09",
            "date_increment": "daily"}
    }


@pytest.fixture
def google_analytics(testapp, google_analytics_tracking_data):
    return testapp.post_json('/tracking_item', google_analytics_tracking_data).json['@graph'][0]


@pytest.fixture
def download_tracking_item_data():
    return {
        "status": "shared",
        "tracking_type": "download_tracking",
        "download_tracking": {
            "geo_country": "NL",
            "geo_city": "Utrecht, Provincie Utrecht",
            "request_path": "/files-processed/GAPFI6BTR1IC/@@download/4DNFI6BTR1IC.bam.bai",
            "user_uuid": "anonymous",
            "user_agent": "Wget/1.17.1 (linux-gnu)",
            "remote_ip": "192.87.138.11",
            "file_format": "bai",
            "filename": "4DNFI6BTR1IC.bam.bai"
        }
    }


@pytest.fixture
def download_tracking(testapp, download_tracking_item_data):
    return testapp.post_json('/tracking_item', download_tracking_item_data).json['@graph'][0]


@pytest.fixture
def jupyterhub_session_tracking_data():
    return {
        "status": "in review",
        "tracking_type": "jupyterhub_session",
        "jupyterhub_session": {
            "date_initialized": "2019-05-09T05:11:56.389876+00:00",
            "date_culled": "2019-05-09T06:21:54.726782+00:00",
            "user_uuid": "e0beacd7-225f-4fa8-81fb-a1856603e204"
        },
        "uuid": "ff4575d4-67b4-458f-8b1c-b3fcb3690ce9",
    }


@pytest.fixture
def jupyterhub_session(testapp, jupyterhub_session_tracking_data):
    return testapp.post_json('/tracking_item', jupyterhub_session_tracking_data).json['@graph'][0]


def test_tracking_item_display_title_google_analytic(google_analytics):
    assert google_analytics.get('display_title') == 'Google Analytics for 2019-05-09'


def test_tracking_item_display_title_download(download_tracking):
    assert download_tracking.get('display_title') == 'Download Tracking Item from ' + utc_today_str()


def test_image_unique_key(registry, image_data):
    uuid = "0afb6080-1c08-11e4-8c21-0800200c9a44"
    image = Image.create(registry, uuid, image_data)
    keys = image.unique_keys(image.properties)
    assert 'red-dot.png' in keys['image:filename']


def test_sample_processing_case(testapp, sample_proc, a_case):
    case = testapp.post_json('/case', a_case, status=201).json['@graph'][0]
    result = testapp.get(sample_proc['@id']).json
    assert len(result.get('cases', [])) == 1
    assert result['cases'][0]['@id'] == case['@id']


@pytest.fixture
def a_report(testapp, project, institution):
    data = {
        "project": project['@id'],
        "institution": institution['@id'],
        "description": "This is a report for a case."
    }
    return testapp.post_json('/report', data, status=201).json['@graph'][0]


def test_report_case(testapp, a_report, a_case):
    assert not a_report.get('case')
    a_case['report'] = a_report['@id']
    case = testapp.post_json('/case', a_case, status=201).json['@graph'][0]
    report = testapp.get(a_report['@id']).json
    assert report.get('case', {}).get('@id') == case['@id']


def test_report_display_title(testapp, a_report, a_case):
    a_case['report'] = a_report['@id']
    case = testapp.post_json('/case', a_case, status=201).json['@graph'][0]
    report = testapp.get(a_report['@id']).json
    assert report.get('display_title') == report.get('accession')
    patch = testapp.patch_json(case['@id'], {'case_id': '12345'}, status=200).json['@graph'][0]
    report = testapp.get(a_report['@id']).json
    assert report.get('display_title') == patch.get('case_id') + ' Case Report'
