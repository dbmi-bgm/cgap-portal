from snovault import (
    upgrade_step,
)


@upgrade_step('variant', '1', '2')
def variant_1_2(value, system):
    """ Upgrades variant from schema version 1 to 2, deleting the 4 relevant fields. """

    if 'csq_rs_dbsnp151' in value:
        del value['csq_rs_dbsnp151']

    if 'csq_hg19_chr' in value:
        del value['csq_hg19_chr']

    if 'csq_hg19_pos' in value:
        del value['csq_hg19_pos']

    if 'csq_clinvar_clnhgvs' in value:
        del value['csq_clinvar_clnhgvs']



@upgrade_step('variant_sample_list', '1', '2')
def variant_sample_list_1_2(value, system):
    """
    Update `variant_samples.userid` to `variant_samples.selected_by`.
    We now can embed the user as linkto so simply calling it userid makes less sense.
    We by default don't have `selected_by` in elasticsearch embedded_list, but can get
    it when needed through the `/embed` API.
    """

    for vs_object in value.get("variant_samples", []):
        if "userid" in vs_object:
            vs_object["selected_by"] = vs_object["userid"]
            del vs_object["userid"]
