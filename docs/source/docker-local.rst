CGAP-Docker
===========

It is now possible to run a local deployment of CGAP without installing any system level
dependencies other than Docker. Start by installing Docker::

    $ brew install docker


Prior to building the image, navigate to deploy/docker/local and open development.ini

* Modify env.name and indexer.namespace - these values must be globally unique (feel free to just replace the name)

There are two new Make targets that should be sufficient for normal use. To build the image locally, ensure your
AWS keys are sourced and run::

    $ make build-docker  # runs docker-compose build
    $ make deploy-docker  # runs docker-compose up

The first command will take awhile the first time you run it but should speed up after. Since it is doing a fresh
rebuild every time it is a little slower than the old local deployment since it has to fully reinstall/rebuild both Python
and the client.

To access the running container::

    $ docker ps   # will show running containers
    $ docker exec -it <app_container_id> bash

Container Development
---------------------

When the container is first built, a volume is created in the local repository location called ``src-docker``.
The ``src`` directory of the repository within the container is mounted to this location, allowing you to make
modifications to the source there and trigger rebuilds via bash as appropriate.

Advanced Usage
--------------

There are several useful commands documented below that may be helpful when issues are encountered or changes need to be made.

* ``docker-compose build --no-cache``  # will force a full rebuild of the entire image
