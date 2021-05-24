CGAP-Docker (Local)
===================

With Docker, it is possible to run a local deployment of CGAP without installing any system level
dependencies other than Docker. A few important notes on this setup.

* Although the build dependency layer is cached, it still takes around 4 minutes to rebuild the front-end for each image. This limitation is tolerable considering the local deployment now identically matches the execution runtime of production.
* ElasticSearch is too compute intensive to virtualize on most machines. For this reason we use the CGAP test ES cluster for this deployment instead of spinning up an ES cluster in Docker. If you want to attempt to run containerized ES, see ``docker-compose.yml``.
* This setup only works when users have sourced AWS Keys in the main account (to connect to the shared ES cluster).
* IMPORTANT: Do not upload the local deployment container image to any registry.


Start by installing Docker::

    $ brew install docker


Prior to building the image, navigate to ``deploy/docker/local``, open ``docker_development.ini`` and make the following modifications (at a minimum).

* Modify env.name and indexer.namespace - these values must be globally unique with respect to our infrastructure (feel free to just replace the name)
* Consider changing load_prod_data to load_local_data if you need to load more inserts
* Once you have loaded inserts once, comment out L54 in ``docker-compose.yml`` to disable automatic insert reloading

There are two new Make targets that should be sufficient for normal use. To build the image locally, ensure your AWS keys are sourced and run::

    $ make build-docker  # runs docker-compose build
    $ make build-docker-clean  # runs a no-cache build, regenerating all layers
    $ make deploy-docker  # runs docker-compose up

The build will take around 10 minutes the first time but will speed up dramatically after due to layer caching. In general, the rate limiting step for rebuilding is the front-end build (unless you are also updating dependencies, which will slow down the build further). Although this may seem like a drawback, the key benefit is that what you are running in Docker is essentially identical to that which is orchestrated on ECS in production. This should reduce our reliance/need for test environments.


To access the running container::

    $ docker ps   # will show running containers
    $ docker exec -it <container_id_prefix> bash


Common Issues
^^^^^^^^^^^^^

Some notable issues that you may encounter include:

    * The NPM build may fail/hang - this can happen when Docker does not have enough resources. Try upping the amount CPU/RAM you are allocating to Docker.
    * Nginx install fails to locate GPG key - this happens when the Docker internal cache has run out of space and needs to be cleaned - see documentation on `docker prune <https://docs.docker.com/config/pruning/.>`_.


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
    $ docker system prune  # will cleanup ALL unused Docker components - BE CAREFUL WITH THIS
