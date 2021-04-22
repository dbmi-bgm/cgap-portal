import pytest

from ..schema_formats import is_uri


pytestmark = [pytest.mark.setone, pytest.mark.working, pytest.mark.schema, pytest.mark.unit]


def test_is_uri():

    # Scheme and host are required. We want absolute URIs.
    #
    # In the rfc3987 implementation, there are a couple of cases marked that used to return true because
    # most of these were only screened out for lack of a colon (:) and those occasional cases were let
    # through improperly. Really the colon check was supposed to be checking for a scheme, but colons can
    # happen in other places and that was a lousy check. -kmp 20-Apr-2021

    assert is_uri("foo") is False

    assert is_uri("/foo") is False
    assert is_uri("/foo.html") is False

    assert is_uri("/foo?alpha") is False
    assert is_uri("/foo?alpha=1") is False
    assert is_uri("/foo?alpha=1&beta=2") is False

    assert is_uri("//somehost") is False
    assert is_uri("//somehost.example.com") is False

    assert is_uri("//user@somehost") is False
    assert is_uri("//user:pass@somehost") is False  # Used to wrongly yield True due to ':' in URI

    assert is_uri("//somehost/") is False
    assert is_uri("//somehost.example.com/") is False

    assert is_uri("//somehost?alpha") is False
    assert is_uri("//somehost?alpha=1") is False
    assert is_uri("//somehost?alpha=1&beta=2") is False

    assert is_uri("//somehost/?alpha=1&beta=2") is False

    assert is_uri("//somehost/?alpha=1&beta=2&colon=:") is False  # Used to wrongly yield True due to ':' in URI

    # Scheme provided, but no host. We want absolute URIs.
    #
    # In the rfc3987 implementation we used to use, each of the next three examples used to return False.
    # -kmp 20-Apr-2021

    assert is_uri("http:/foo?alpha") is False  # Used to be True
    assert is_uri("http:/foo?alpha=1") is False  # Used to be True
    assert is_uri("http:/foo?alpha=1&beta=2") is False  # Used to be True

    # Scheme provided, but not the one we want.
    #
    # In the rfc3987 implementation, we allowed these through because we really just looked for a colon.
    # But we're not prepared to manage these other protocols, so we're now more careful. -kmp 20-Apr-2021

    assert is_uri("ftps://somehost") is False  # Used to be True
    assert is_uri("ftp://somehost") is False  # Used to be True

    # Finally we have a scheme and a host

    assert is_uri("https://somehost") is True

    assert is_uri("http://somehost") is True
    assert is_uri("http://somehost.example.com") is True

    assert is_uri("http://user@somehost") is True
    assert is_uri("http://user:pass@somehost") is True

    assert is_uri("http://somehost/") is True
    assert is_uri("http://somehost.example.com/") is True

    assert is_uri("http://somehost?alpha") is True
    assert is_uri("http://somehost?alpha=1") is True
    assert is_uri("http://somehost?alpha=1&beta=2") is True

    assert is_uri("http://somehost/?alpha=1&beta=2") is True

    assert is_uri("http://somehost/?alpha=1&beta=2&colon=:") is True

    # The given string still has to be syntactically valid, though.
    #
    # In the rfc3987 implementation we used to use, each of the next three examples used to raise ValueError
    # when parsing uri_reference to be validated. Now we trap that and quietly return False. -kmp 20-Apr-2021

    assert is_uri("http://what:is:this/foo") is False  # Used to raise ValueError
    assert is_uri("http://host:notanumber/foo") is False  # Used to raise ValueError
    assert is_uri("http://what@is@this/foo") is False  # Used to raise ValueError

    # TODO: In the rfc3987 implementation, we allowed tags, but do we really want that? -kmp 20-Apr-2021

    assert is_uri("foo#alpha") is False  # Used to be False, but only due to lack of ':' in URI, not because of tag
    assert is_uri("foo#alpha:beta") is False  # Used to wrongly be True due to ':' in URI

    assert is_uri("http://abc.def/foo#alpha") is True  # TODO: Reconsider tags
    assert is_uri("http://abc.def/foo#alpha:beta") is True  # TODO: Reconsider tags
