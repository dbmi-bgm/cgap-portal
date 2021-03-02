CGAP-Docker
===========

It is now possible to run a local deployment of CGAP without installing any system level
dependencies other than Docker. A few important notes on this setup.

* This is not ideal for active development as you cannot run unit tests or edit source files in the container on the host machine (in your local editor).
* ElasticSearch is too compute intensive to virtualize on most machines. For this reason we use the CGAP test ES cluster for this deployment instead of spinning up an ES cluster in Docker. If you want to attempt to run containerized ES, see ``docker-compose.yml``.
* VERY IMPORTANT: Do not upload the local deployment container image to any registry. This utility is in beta - .


Start by installing Docker::

    $ brew install docker


Prior to building the image, navigate to deploy/docker/local and open docker_development.ini

* Modify env.name and indexer.namespace - these values must be globally unique (feel free to just replace the name)
* Consider changing load_prod_data to load_local_data if you need to load more inserts

There are two new Make targets that should be sufficient for normal use. To build the image locally, ensure your
AWS keys are sourced and run::

    $ make build-docker  # runs docker-compose build
    $ make deploy-docker  # runs docker-compose up

The first command will take awhile the first time you run it but should speed up after. Since it is doing a fresh
rebuild every time it is a little slower than the old local deployment since it has to fully reinstall/rebuild both Python
and the client. Because of this, it is recommended to continue active development using the existing installation setup.
Once the branch is ready for integrated testing, set the desired branch in ``docker-compose.yml`` and trigger a build.
When the app is brought online the behavior should be identical to that of the existing local deployment setup.

To access the running container::

    $ docker ps   # will show running containers
    $ docker exec -it <container_id_prefix> bash


Docker Command Cheatsheet
^^^^^^^^^^^^^^^^^^^^^^^^^

Below is a small list of useful Docker commands for advanced users::

    $ docker-compose build  # will trigger a build of the local cluster
    $ docker-compose build --no-cache  # will trigger a fresh build of the entire cluster
    $ docker-compose down  # will stop cluster
    $ docker-compose down --volumes  # will remove cluster volumes as well
    $ docker-compose up  # will start cluster and log all output to console
    $ docker-compose up -d  # will start cluster in background using existing containers
    $ docker-compose up -d -V --build  # trigger a rebuild/recreation of cluster containers
    $ docker system prune  # will cleanup unused Docker components - BE CAREFUL WITH THIS
