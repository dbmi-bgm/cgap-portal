def test_individual_1_2(app, disorder, female_individual):
    """"""
    upgrader = app.registry["upgrader"]
    disorder_uuid = disorder["uuid"]
    female_individual["disorders"] = [disorder_uuid]
    upgrader.upgrade(
        "individual", female_individual, current_version="1", target_version="2"
    )
    disorders = female_individual["disorders"]
    assert isinstance(disorders, list)
    assert len(disorders) == 1
    disorder_item = disorders[0]
    assert isinstance(disorder_item, dict)
    assert len(disorder_item) == 1
    assert disorder_item.get("disorder") == disorder_uuid
