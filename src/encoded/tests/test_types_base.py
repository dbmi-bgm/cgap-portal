class TestPipelineDisplay:

    PIPELINE_DISPLAY_VIEW = "@@pipelines"

    def assert_pipeline_display_status(self, testapp, item_to_get, status):
        item_pipeline_url = self.get_item_pipeline_display_url(item_to_get)
        testapp.get(item_pipeline_url, status=status)

    def get_item_pipeline_display_url(self, item_to_get):
        item_atid = item_to_get["@id"]
        return item_atid + self.PIPELINE_DISPLAY_VIEW

    def test_pipeline_display_success(self, testapp, sample_proc_fam):
        self.assert_pipeline_display_status(testapp, sample_proc_fam, 200)

    def test_pipeline_display_failure(self, testapp, project):
        self.assert_pipeline_display_status(testapp, project, 405)
