import json
import os
from concurrent.futures import ThreadPoolExecutor

import boto3
import botocore

from encoded.util import s3_local_file

AWS_ACCESS_KEY_ID = os.environ.get("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.environ.get("AWS_SECRET_ACCESS_KEY")

CGAP_UPLOAD_BUCKET = "elasticbeanstalk-fourfront-cgap-files"


def submit_upload_files(
    *, s3_client, bucket, key, project, institution, vapp, validate_only=False
):
    """
    Handles processing of a submitted gene list.

    Args:
        s3_client: a boto3 s3 client object
        bucket: the name of the s3 bucket that contains the data to be
            processed
        key: the name of a key within the given bucket that contains the data
            to be processed
        project: a project identifier
        institution: an institution identifier
        vapp: a vapp object
        validate_only: a bool. If True, only do validation, not posting;
            otherwise (if False), do posting, too.
    """

    with s3_local_file(s3_client, bucket=bucket, key=key) as filename:
        results = {
            "success": False,
            "validation_output": [],
            "result": {},
            "post_output": [],
            "upload_info": [],
        }
        if filename.endswith(".json"):
            upload_files = AssociateFiles(filename, vapp, validate_only)
            if validate_only:
                if upload_files.errors:
                    results["validation_output"] = upload_files.errors
                else:
                    results["success"] = True
                    results["validation_output"] = upload_files.validation_output
                    results["result"] = {
                        "files_found": upload_files.files_to_move,
                        "file_size": upload_files.largest_file_size
                    }
            elif upload_files.post_output:
                results["success"] = True
                results["validation_output"] = upload_files.validation_output
                results["post_output"] = upload_files.post_output
            else:
                results["validation_output"] = upload_files.errors
        else:
            msg = "Expected a json file."
            results["validation_output"].append(msg)
        return results


class AssociateFiles:
    """
    Class to handle moving files from the S3 Uploads folder
    into the appropriate file location on S3. If the file is
    successfully moved, the file is deleted from the
    Uploads folder.
    """

    # TODO:
    # Patch file status once in place
    # Ensure file deletion works as expected
    # Figure out how to catch errors for file deletion if they occur.

    def __init__(self, filename, vapp, validate_only=False):
        self.filename = filename
        self.vapp = vapp
        self.src_bucket = CGAP_UPLOAD_BUCKET
        self.validation_output = []
        self.post_output = []
        self.errors = []
        self.s3_client = self.setup_client()
        self.dest_bucket = self.get_file_upload_bucket()
        self.file_specs = self.get_file_info()
        self.files_to_move, self.largest_file_size = self.validate_files()
        if not validate_only and not self.errors:
            self.copy_success = self.multithread_copy()
            #        self.delete_results = self.delete_files()

    def setup_client(self):
        """
        Set up s3 client with increased pool connections to prevent
        urllib3 connection pool warnings.
        """
        client_config = botocore.config.Config(max_pool_connections=50)
        s3_client = boto3.client("s3", config=client_config)
        return s3_client

    def get_file_upload_bucket(self):
        """
        Finds environment's upload bucket for files.
        """
        vapp_settings = self.vapp.app.registry._get_settings()
        dest_bucket = vapp_settings.get("file_upload_bucket", "")
        return dest_bucket

    def get_file_info(self):
        """
        Grab all file data from the submission's document.
        """
        file_specs = {}
        with open(self.filename, "r") as f:
            input_info = json.loads(f.read())
        for file_info in input_info:
            src_key = file_info["filename"]
            file_uuid = file_info["uuid"]
            resp = self.vapp.get("/search/?type=File&uuid=" + file_uuid)
            dest_key = resp.json["@graph"][0]["upload_key"]
            file_specs[src_key] = {"upload_key": dest_key}
        return file_specs

    @staticmethod
    def _is_file_in_bucket(s3_client, file_key, bucket):
        """Check if file exists in bucket."""
        result = False
        file_length = None
        try:
            response = s3_client.head_object(Bucket=bucket, Key=file_key)
            file_length = response.get("ContentLength")
            file_length = file_length * 10**(-9)
            result = True
        except Exception:
            pass
        return result, file_length

    def validate_files(self):
        """
        Ensure all files to upload either exist in the Uploads bucket
        or have already been uploaded to the destination.
        """
        found_in_src = {}
        found_in_dest = []
        not_found = []
        largest_file_size = 0
        s3_client = self.s3_client
        src = self.src_bucket
        dest = self.dest_bucket
        for file_info in self.file_specs:
            upload_key = self.file_specs[file_info]["upload_key"]
            src_check, file_length = self._is_file_in_bucket(s3_client, file_info, src)
            if src_check:
                found_in_src[file_info] = upload_key
                if file_length > largest_file_size:
                    largest_file_size = file_length
                continue
            dest_check, _ = self._is_file_in_bucket(s3_client, upload_key, dest)
            if dest_check:
                found_in_dest.append(file_info)
            not_found.append(file_info)
        if found_in_src:
            msg = (
                "%s file(s) found and ready to be associated with the case."
            ) % (str(len(found_in_src)))
            self.validation_output.append(msg)
        if found_in_dest:
            msg = (
                "%s file(s) have already been correctly associated with the case."
            ) % (str(len(found_in_dest)))
            self.validation_output.append(msg)
        if not_found:
            msg = (
                "%s file(s) could not be found. Please check the following file(s) "
                "to ensure the name is accurate and the file has been uploaded "
                "appropriately: %s."
            ) % (str(len(not_found)), ", ".join(not_found))
            self.validation_output.append(msg)
        return found_in_src, largest_file_size

    @staticmethod
    def copy_file(s3_client, src_bucket, src_key, dest_bucket, dest_key, errors):
        """
        Copy key from source bucket to new key in destination bucket.
        Catch any copy errors and add them to error dictionary.
        """
        try:
            copy_source = {"Bucket": src_bucket, "Key": src_key}
            s3_client.copy(copy_source, dest_bucket, dest_key)
        except Exception as e:
            errors[src_key] = str(e)

    def _create_file_args(self, errors):
        """
        Create tuple of input args to be used for copying files for
        all files found in source bucket.
        """
        file_args = []
        for file_info in self.files_to_move:
            upload_key = self.files_to_move[file_info]
            copy_args = (
                self.s3_client,
                self.src_bucket,
                file_info,
                self.dest_bucket,
                upload_key,
                errors,
            )
            file_args += [copy_args]
        return tuple(file_args)

    def multithread_copy(self):
        """
        Copies all files found in the source bucket to the destination bucket,
        with each s3 copy command in a separate thread.
        """
        copy_errors = {}
        successful_copy = []
        file_args = self._create_file_args(copy_errors)
        with ThreadPoolExecutor() as executor:
            executor.map(lambda f: self.copy_file(*f), file_args)
        for file_info in self.files_to_move:
            if file_info not in copy_errors:
                successful_copy.append(file_info)
        if not copy_errors:
            msg = "All files were successfully associated with the case."
            self.post_output.append(msg)
        else:
            file_msg = [
                "The file %s failed to upload with the following error: %s. "
                % (filename, error_msg) for filename, error_msg in copy_errors
            ]
            msg = (
                "There was an issue associating some of the files with your case. %s"
                "Please try the upload again or contact the CGAP team to troubleshoot."
            ) % ("".join(file_msg))
            self.post_output.append(msg)
        return successful_copy

    def delete_files(self):
        """
        For all successfully copied files, delete the original in
        the Uploads folder.
        """
        if self.copy_success:
            delete_objs = {
                "Objects": [{"Key": file_info} for file_info in self.copy_success]
            }
            results = self.s3_client.delete_objects(
                Bucket=self.src_bucket, Delete=delete_objs
            )
        return results
