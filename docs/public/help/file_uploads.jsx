<div>
	<p>
		All file submissions to CGAP are made with
		SubmitCGAP, found <a href="https://github.com/dbmi-bgm/SubmitCGAP">here</a>
		with documentation on installation and use.
	</p>

	<p>
		SubmitCGAP will only upload files found on the
		local computer running the package. If your files
		are not stored locally and are instead in cloud
		storage or a local cluster, there are a few options
		for uploading such files. 
	</p>

	<p>
		A video tutorial for submitting files using SubmitCGAP can be 
		found on this page.
		All tutorial videos can be found on the <a href="https://www.youtube.com/@cgaptraining">CGAP Training Youtube channel</a>.
	</p>

	<h4>Load the files locally </h4>

	<p>
		This option works well for uploading a small number
		of files or files of small size. Files can be 
		transferred to your local computer from cloud storage
		or a computing cluster in several ways. For example,
		if your files are stored on AWS S3, tools such as 
		<a href="https://github.com/s3fs-fuse/s3fs-fuse">s3fs</a>
		or <a href="https://github.com/kahing/goofys">goofys</a> 
		facilitate mounting of S3 buckets as local file
		systems that can be readily accessed by SubmitCGAP.
		Similar tools exist for Google Cloud Storage and
		Azure Storage. 
	</p>

	<p>
		Alternatively, the files can be directly downloaded
		from the remote location, for example using the 
		AWS CLI for files on AWS S3. 
	</p>

	<p>
		However, the methods above require enough free disk space
		on your local computer to store the files to upload.
		As such files can be rather large, we recommend performing
		the upload from a cloud/cluster instance 
		for uploading many files or larger files.
	</p>

	<h4>Tutorial Video: Uploading Local Files</h4>

	{/* <div style={{ maxWidth: "500px"}} className="w-100 d-flex align-items-center justify-items-center">
        <div>  
            <YoutubeVideoEmbed
                shouldAutoplay={false}
                videoID="4Su3a7AE0HY"
                videoTitle="Case Submission via CGAP Web UI"
                params="start=117"
            />
        </div>
    </div> */}

	<h4>Run SubmitCGAP on remote instance</h4>

	<p>
		File submission can easily be scripted to accommodate
		running on a remote instance. Once an instance has
		been launched with appropriate storage requirements
		for the files to upload, the files can either be
		mounted or downloaded as before, SubmitCGAP can be
		installed, and the remainder of the upload process
		can continue as on your local computer. Note that 
		your SubmitCGAP keys (located at <code>~/.cgap-keys.json</code>)
		will also have to be uploaded to the instance for
		successful file upload to CGAP. 
	</p>

	<p>
		For example, if using an AWS EC2 instance running 
		Amazon Linux 2 with
		files in AWS S3 and an appropriate IAM role, 
		executing the script below (named upload_files.sh)
		with the command:
	</p>

	<pre>
		<code>
			BUCKETS=&lt;S3 buckets to mount&gt; SUBMISSION_UUIDS=&lt;Ingestion Submission UUID(s) for submitted case(s)&gt; bash upload_files.sh
		</code>
	</pre>

	<p>
		will mount the indicated bucket(s) and upload the
		appropriate files to CGAP if found within the buckets.
	</p>

	<pre>
		<code>
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
		</code>
	</pre>


	<p>
		For further support or questions regarding file
		submission, please contact the CGAP team at 
		<a href="mailto:cgap@hms-dbmi.atlassian.net">cgap@hms-dbmi.atlassian.net</a>.
	</p>
</div>