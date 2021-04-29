login:
	aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 645819926742.dkr.ecr.us-east-1.amazonaws.com

build:
	docker build -t cgap-mastertest .

tag:
	docker tag cgap-mastertest:latest 645819926742.dkr.ecr.us-east-1.amazonaws.com/cgap-mastertest:latest

push:
	docker push 645819926742.dkr.ecr.us-east-1.amazonaws.com/cgap-mastertest:latest

