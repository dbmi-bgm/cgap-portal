configure:
	brew install docker

build:
	docker build --progress=plain -t cgap-docker:0.0.0b0 .

enter:
	docker run -v /tmp/snovault/pgdata:/tmp/snovault/pgdata -p 5441:5441 -p 6543:6543 -it cgap-docker:0.0.0b0 bash

info:
	@: $(info Here are some 'make' options:)
	   $(info - Use 'make configure' to install Docker on OSX via Brew.)
	   $(info - Use 'make build' to build a local version of the Docker image.)
	   $(info - Use 'make enter' to start a bash session in the build container.)
