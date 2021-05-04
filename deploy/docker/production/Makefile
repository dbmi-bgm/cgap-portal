login:
	aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 645819926742.dkr.ecr.us-east-1.amazonaws.com

wsgi:
	docker build -t cgap-mastertest:latest .
	docker tag cgap-mastertest:latest 645819926742.dkr.ecr.us-east-1.amazonaws.com/cgap-mastertest:latest
	docker push 645819926742.dkr.ecr.us-east-1.amazonaws.com/cgap-mastertest:latest

indexer:
	docker build -t cgap-mastertest:latest-indexer -f Dockerfile . --build-arg ENTRYPOINT=entrypoint_indexer.sh
	docker tag cgap-mastertest:latest-indexer 645819926742.dkr.ecr.us-east-1.amazonaws.com/cgap-mastertest:latest-indexer
    docker push 645819926742.dkr.ecr.us-east-1.amazonaws.com/cgap-mastertest:latest-indexer

ingester:
	docker build -t cgap-mastertest:latest-ingester -f Dockerfile . --build-arg ENTRYPOINT=entrypoint_ingester.sh
	docker tag cgap-mastertest:latest-ingester 645819926742.dkr.ecr.us-east-1.amazonaws.com/cgap-mastertest:latest-ingester
    docker push 645819926742.dkr.ecr.us-east-1.amazonaws.com/cgap-mastertest:latest-ingester

deployment:
	docker build -t cgap-mastertest:latest-deployment -f Dockerfile . --build-arg ENTRYPOINT=entrypoint_deployment.sh
	docker tag cgap-mastertest:latest-deployment 645819926742.dkr.ecr.us-east-1.amazonaws.com/cgap-mastertest:latest-deployment
    docker push 645819926742.dkr.ecr.us-east-1.amazonaws.com/cgap-mastertest:latest-deployment
