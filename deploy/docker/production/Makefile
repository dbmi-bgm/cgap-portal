login:
	aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 645819926742.dkr.ecr.us-east-1.amazonaws.com

wsgi:
	docker build -t cgap-mastertest:latest .
	docker tag cgap-mastertest:latest 645819926742.dkr.ecr.us-east-1.amazonaws.com/cgap-mastertest:latest
	docker push 645819926742.dkr.ecr.us-east-1.amazonaws.com/cgap-mastertest:latest

indexer:
	docker build -t cgap-mastertest:latest-indexer -f Dockerfile_indexer .
	docker tag cgap-mastertest:latest-indexer 645819926742.dkr.ecr.us-east-1.amazonaws.com/cgap-mastertest:latest-indexer
    docker push 645819926742.dkr.ecr.us-east-1.amazonaws.com/cgap-mastertest:latest-indexer
