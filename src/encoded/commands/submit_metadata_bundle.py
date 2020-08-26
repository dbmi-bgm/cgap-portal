import argparse
import datetime
import io
import json
import os
import re
import requests
import subprocess
import sys
import time


EPILOG = __doc__

ACCESS_KEY_FILENAME = ".cgap-access"

def get_cgap_auth():
    key_id = os.environ.get("CGAP_ACCESS_KEY_ID", "")
    secret = os.environ.get("CGAP_SECRET_ACCESS_KEY", "")
    if key_id and secret:
        return (key_id, secret)
    raise RuntimeError("Both of the environment variables CGAP_ACCESS_KEY_ID and CGAP_SECRET_ACCESS_KEY must be set."
                       " Appropriate values can be obtained by creating an access key in your CGAP user profile.")


SITE_REGEXP = re.compile(
    r"^(http://localhost:[0-9]+|https://fourfront-cgap[a-z.-]*|https://[a-z.-]*cgap.hms.harvard.edu)/?$"
)


def main(simulated_args_for_testing=None):
    parser = argparse.ArgumentParser(  # noqa - PyCharm wrongly thinks the formatter_class is invalid
        description="Submits a data bundle",
        epilog=EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument('bundle_filename', help='a local Excel filename that is the data bundle')
    parser.add_argument('--institution', '-i', help='institution identifier', default=None)
    parser.add_argument('--project', '-p', help='project identifier', default=None)
    parser.add_argument('--site', '-s', help="The http or https address of the site")
    args = parser.parse_args(args=simulated_args_for_testing)

    bundle_filename = args.bundle_filename
    institution = args.institution
    project = args.project
    site = args.site

    try:

        matched = SITE_REGEXP.match(site)
        if not matched:
            raise ValueError("The site should be 'http://localhost:<port>' or 'https://<cgap-hostname>'.")
        site = matched.group(1)

        auth = get_cgap_auth()

        user_url = site + "/me?format=json"
        user_record = requests.get(user_url, auth=auth).json()

        if not institution:
            submits_for = user_record.get('submits_for', [])
            if len(submits_for) == 0:
                raise SyntaxError("Your user profile declares no institution"
                                  " on behalf of which you are authorized to make submissions.")
            elif len(submits_for) > 1:
                raise SyntaxError("You must use --institution to specify which institution you are submitting for"
                                  " (probably one of: %s)." % ", ".join([x['@id'] for x in submits_for]))
            else:
                institution = submits_for[0]['@id']
                print("Using institution:", institution)

        if not project:
            project = user_record.get('project', {}).get('@id', None)
            if not project:
                raise SyntaxError("Your user profile has not project declared,"
                                  " so you must specify a --project explicitly.")
            print("Using project:", project)

        if not os.path.exists(bundle_filename):
            raise ValueError("The file '%s' does not exist." % bundle_filename)

        post_files = {
            "datafile": open(bundle_filename, 'rb')
        }

        post_data = {
            'ingestion_type': 'metadata_bundle',
            'institution': institution,
            'project': project,
        }

        submission_url = site + "/submit_for_ingestion"

        res = requests.post(submission_url, auth=auth, data=post_data, files=post_files).json()

        # print(json.dumps(res, indent=2))

        uuid = res['submission_id']

        def tprint(*args):
            print(str(datetime.datetime.now().strftime("%H:%M:%S")), *args)

        tprint("Bundle uploaded. Awaiting processing...")

        tracking_url = site + "/ingestion-submissions/" + uuid + "?format=json"

        success = False
        outcome = None
        n_tries = 8
        tries_left = n_tries
        done = False
        while tries_left > 0:
            time.sleep(15)
            # print(json.dumps(res, indent=2))
            res = res = requests.get(tracking_url, auth=auth).json()
            processing_status = res['processing_status']
            done = processing_status['state'] == 'done'
            if done:
                outcome = processing_status['outcome']
                success = outcome == 'success'
                break
            else:
                tprint("Progress is %s. Continuing to wait..." % processing_status['progress'])
            tries_left -= 1

        if not done:
            tprint("Timed out after %d tries." % n_tries)
        else:
            tprint("Final status: %s" % outcome)

        def show_section(section):
            print("----- %s -----" % section.replace("_", " ").title())
            lines = res['additional_data'].get(section)
            if lines:
                for line in lines:
                    print(line)
            else:
                print("Nothing to show.")

        show_section('validation_output')

        if success:
            show_section('post_output')

            show_section('upload_info')


    except Exception as e:
        print("%s: %s" % (e.__class__.__name__, str(e)))
        exit(1)


# This is stuff Submit4DN does that may or may not be useful to us.
# To be removed if it doesn't get used.  And anyway, all this upload stuff belongs
# in the SubmitCGAP repo at some point. It's just easier to debug here for now.
# -kmp 9-Aug-2020
#
#
#     def get_upload_creds(file_id, connection):  # pragma: no cover
#         url = "%s/upload/" % (file_id)
#         req = ff_utils.post_metadata({}, url, key=connection.key)
#         return req['@graph'][0]['upload_credentials']
#
#
# def upload_file(creds, path):  # pragma: no cover
#     # Source: Submit4DN
#
#     ####################
#     # POST file to S3
#     env = os.environ.copy()  # pragma: no cover
#     try:
#         env.update({
#             'AWS_ACCESS_KEY_ID': creds['AccessKeyId'],
#             'AWS_SECRET_ACCESS_KEY': creds['SecretAccessKey'],
#             'AWS_SECURITY_TOKEN': creds['SessionToken'],
#         })
#     except Exception as e:
#         raise("Didn't get back s3 access keys from file/upload endpoint.  Error was %s" % str(e))
#     # ~10s/GB from Stanford - AWS Oregon
#     # ~12-15s/GB from AWS Ireland - AWS Oregon
#     print("Uploading file.")
#     start = time.time()
#     try:
#         subprocess.check_call(['aws', 's3', 'cp', '--only-show-errors', path, creds['upload_url']], env=env)
#     except subprocess.CalledProcessError as e:
#         # The aws command returns a non-zero exit code on error.
#         print("Upload failed with exit code %d" % e.returncode)
#         sys.exit(e.returncode)
#     else:
#         end = time.time()
#         duration = end - start
#         print("Uploaded in %.2f seconds" % duration)


if __name__ == '__main__':
    main()
