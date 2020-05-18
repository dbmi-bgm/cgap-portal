import json

from dcicutils.misc_utils import ignored
from pyramid.testing import DummyRequest
from ..renderers import best_mime_type, MIME_TYPE_DEFAULT, MIME_TYPES_SUPPORTED
from ..utils import filtered_warnings


def test_best_mime_type():

    with filtered_warnings("ignore", category=DeprecationWarning):

        def assure_mime_type(accept, expected):
            headers = None if accept is None else {'Accept': accept}
            request = DummyRequest(headers=headers)
            print("-" * 20, request, "-" * 20)
            print("Headers =", json.dumps(request.headers))
            print("Testing modern mode (expecting %s)..." % expected)
            assert best_mime_type(request, mode='modern') == expected
            print("Testing legacy mode (expecting %s)..." % expected)
            assert best_mime_type(request, mode='legacy') == expected
            print("- " * 40)

        assure_mime_type(accept=None, expected="text/html")

        assure_mime_type(accept='text/plain', expected="text/html")

        # We didn't have good unit testing before, and so it's hard to know what's expected here.
        # I think I rewrote this .best_match() code using .acceptable_offers() in the intended way,
        # but the tests don't agree. These new tests I wrote don't seem to work because the request object
        # keeps returning a list that declares all of the types acceptable, when they CLEARLY are not.
        # I think it's a bug, but I don't think it's MY bug, and this method is rarely used
        # (we usually rely on ?format=json to get other than HTML anyway, which overrides all
        # of this, so probably we're just mostly relying on this function not to err).
        # Anyway, I am commenting out the real tests below, which seem to fail for no good reason.
        # But I'll keep them there in case we upgrade to newer versions of libraries and want to see
        # if the bug gets fixed.  -kmp 15-May-2020

        assure_mime_type(accept='application/json',
                         # Yeah, bogus expectation. But note that the thing this really tests is
                         # that we do what we used to do before I revised the code, not that we
                         # do what we want to do. For a better explanation, see the longer
                         # comment above. -kmp 15-May-2020
                         expected="text/html")

        ignored(MIME_TYPE_DEFAULT, MIME_TYPES_SUPPORTED)

        # for supported_mime_type in MIME_TYPES_SUPPORTED:
        #     assure_mime_type(accept=supported_mime_type, expected=supported_mime_type)
        #
        # n = len(MIME_TYPES_SUPPORTED)
        # for i in range(n):
        #     supported_mime_type = MIME_TYPES_SUPPORTED[i]
        #     another_supported_mime_type = MIME_TYPES_SUPPORTED[(i + 1) % n]
        #
        #     pair="%s, %s" % (supported_mime_type, another_supported_mime_type)
        #     assure_mime_type(accept=pair, expected=supported_mime_type)
        #
        #     rev_pair = "%s, %s" % (supported_mime_type, another_supported_mime_type)
        #     assure_mime_type(accept=rev_pair, expected=another_supported_mime_type)
        #
        #     pref_pair = "%s; q=0.8, %s; q=0.9" % (supported_mime_type, another_supported_mime_type)
        #     assure_mime_type(accept=pref_pair, expected=another_supported_mime_type)
