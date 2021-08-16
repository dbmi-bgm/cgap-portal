All file submissions to CGAP are made with
SubmitCGAP, found [here](https://github.com/dbmi-bgm/SubmitCGAP)
with documentation on installation and use. 

SubmitCGAP will only upload files found on the
local computer running the package. If your files
are not stored locally and are instead in cloud
storage or a local cluster, there are a few options
for uploading such files. 

#### Load the files locally

This option works well for uploading a small number
of files or files of small size. Files can be 
transferred to your local computer from cloud storage
or a computing cluster in several ways. For example,
if your files are stored on AWS S3, tools such as 
[s3fs](https://github.com/s3fs-fuse/s3fs-fuse)
or [goofys](https://github.com/kahing/goofys) 
facilitate mounting of S3 buckets as local file
systems that can be readily accessed by SubmitCGAP.
Similar tools exist for Google Cloud Storage and
Azure Storage. 

Alternatively, the files can be directly downloaded
from the remote location, for example using the 
AWS CLI for files on AWS S3. 

However, the methods above require enough free disk space
on your local computer to store the files to upload.
As such files can be rather large, we recommend performing
the upload from a cloud/cluster instance 
for uploading many files or larger files. 

#### Run SubmitCGAP on remote instance

File submission can easily be scripted to accommodate
running on a remote instance. Once an instance has
been launched with appropriate storage requirements
for the files to upload, the files can either be
mounted or downloaded as before, SubmitCGAP can be
installed, and the remainder of the upload process
can continue as on your local computer. Note that 
your SubmitCGAP keys (located at `~/.cgap-keys.json`)
will also have to be uploaded to the instance for
successful file upload to CGAP. 

For example, if using an AWS EC2 instance running 
Amazon Linux 2 with
files in AWS S3 and an appropriate IAM role, 
executing the script below (named upload_files.sh)
with the command:

<br>

```
BUCKETS=<S3 buckets to mount> SUBMISSION_UUIDS=<Ingestion Submission UUID(s) for submitted case(s)> bash upload_files.sh
```

will mount the indicated bucket(s) and upload the
appropriate files to CGAP if found within the buckets.

<br> 

```
#!/bin/bash

# Install s3fs-fuse for mounting S3 buckets
sudo amazon-linux-extras install epel -y
sudo yum install s3fs-fuse -y

# Mount buckets to ~/upload_files directory
mkdir upload_files
for BUCKET in $BUCKETS
do
	s3fs $BUCKET ~/upload_files/ -o iam_role
done

# Create virtual env for package installation
python3 -m venv ~/cgap_submission
source ~/cgap_submission/bin/activate

# Run SubmitCGAP with mounted files
pip install submit_cgap
for UUID in $SUBMISSION_UUIDS
do
	resume-uploads $UUID -u ~/upload_files/ -nq -sf
done

```


For further support or questions regarding file
submission, please contact the CGAP team at 
[cgap@hms-dbmi.atlassian.net](mailto:cgap@hms-dbmi.atlassian.net).
