configure:
	brew install docker

build:
	docker build -t cgap-docker:0.0.0b0 .

enter:
	docker run -it cgap-docker:0.0.0b0 bash

info:
	@: $(info Here are some 'make' options:)
	   $(info - Use 'make configure' to install Docker on OSX via Brew.)
	   $(info - Use 'make build' to build a local version of the Docker image.)
	   $(info - Use 'make enter' to start a bash session in the build container.)
