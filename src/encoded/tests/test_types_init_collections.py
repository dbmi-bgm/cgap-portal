import pytest

from datetime import datetime
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
    del(protocol_data['protocol_type'])
    res = testapp.post_json('/document', protocol_data).json['@graph'][0]
    assert res.get('display_title') == 'red-dot.png'


def test_document_display_title_wo_attachment(testapp, protocol_data):
    del(protocol_data['protocol_type'])
    res = testapp.post_json('/document', protocol_data).json['@graph'][0]
    assert res.get('display_title') == 'Document from ' + str(datetime.utcnow())[:10]


@pytest.fixture
def google_analytics_tracking_data():
    return {
        "status": "released",
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
        "status": "released",
        "tracking_type": "download_tracking",
        "download_tracking": {
            "geo_country": "NL",
            "geo_city": "Utrecht, Provincie Utrecht",
            "request_path": "/files-processed/4DNFI6BTR1IC/@@download/4DNFI6BTR1IC.pairs.gz.px2",
            "user_uuid": "anonymous",
            "user_agent": "Wget/1.17.1 (linux-gnu)",
            "remote_ip": "192.87.138.11",
            "file_format": "pairs_px2",
            "filename": "4DNFI6BTR1IC.pairs.gz.px2",
            "experiment_type": "in situ Hi-C"
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
    assert download_tracking.get('display_title') == 'Download Tracking Item from ' + str(datetime.utcnow())[:10]


def test_image_unique_key(registry, image_data):
    uuid = "0afb6080-1c08-11e4-8c21-0800200c9a44"
    image = Image.create(registry, uuid, image_data)
    keys = image.unique_keys(image.properties)
    assert 'red-dot.png' in keys['image:filename']
