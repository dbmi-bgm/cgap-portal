login:
	aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 645819926742.dkr.ecr.us-east-1.amazonaws.com

build:
	docker build -t cgap-docker .

tag:
	docker tag cgap-docker:latest 645819926742.dkr.ecr.us-east-1.amazonaws.com/cgap-docker:latest

push:
	docker push 645819926742.dkr.ecr.us-east-1.amazonaws.com/cgap-docker:latest

