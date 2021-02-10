FROM ubuntu:18.04

# XXX: We should consider a multi-base image setup where python, poetry, app etc are done
# separately and can be extended.
MAINTAINER William Ronchetti "william_ronchetti@hms.harvard.edu"

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update

# Add some tools
RUN apt-get -y install emacs vim
RUN apt-get -y install software-properties-common

# Add Python
RUN add-apt-repository ppa:deadsnakes/ppa
RUN apt-get update
RUN apt-get -y install python3.6-dev
RUN python3.6 -V

# Install mod_wsgi
RUN apt-get -y install git git-c++ wget
RUN apt-get -y install apache2-dev apache2-utils ssl-cert libapache2-mod-wsgi

# Install mod_wsgi
RUN apt-get install libapache2-mod-wsgi
RUN systemctl restart apache2

# Environment Configuration
# Adapated from https://github.com/python-poetry/poetry/discussions/1879
# Don't buffer output from Python
ENV PYTHONUNBUFFERED=1
# Don't write .pyc files (to disk)
ENV PYTHONDONTWRITEBYTECODE=1

# Optimize pip
ENV PIP_NO_CACHE_DIR=off
ENV PIP_DISABLE_PIP_VERSION_CHECK=on
ENV PIP_DEFAULT_TIMEOUT=100

# Configure poetry
# Reference: https://python-poetry.org/docs/configuration/#using-environment-variables
ENV POETRY_VERSION=1.1.4
# make poetry install to this location
ENV POETRY_HOME="/home/cgap-admin/poetry"
# make poetry create the virtual environment in the project's root
# it gets named `.venv`
ENV POETRY_VIRTUALENVS_IN_PROJECT=true
ENV POETRY_NO_INTERACTION=1
# This is where our requirements + virtual environment will live
ENV PYSETUP_PATH="/home/cgap-admin/cgap-portal"
ENV VENV_PATH="/home/cgap-admin/.venv"


# Configure Path
ENV PATH="$POETRY_HOME/bin:$VENV_PATH/bin:$PATH"


# Configure CGAP User
RUN useradd -ms /bin/bash cgap-admin
RUN mkdir -p /home/cgap-admin/cgap-portal
RUN chown cgap-admin $PYSETUP_PATH
USER cgap-admin

# Clone to /home/cgap-admin/cgap-portal
WORKDIR /home/cgap-admin
RUN git clone https://github.com/dbmi-bgm/cgap-portal.git

# Build, configure the back-end
WORKDIR /home/cgap-admin/cgap-portal
RUN curl -sSL https://raw.githubusercontent.com/sdispater/poetry/master/get-poetry.py | python
RUN poetry install && poetry run python setup_eb.py develop
RUN make aws-ip-ranges
RUN cat /dev/urandom | head -c 256 | base64 > session-secret.b64

# Execute commands with:
# docker run -it cgap-ingestion-docker:<version> bash -c
#   poetry run simulate-environment <env> &&
#   poetry run reformat-vcf <args> &&
#   poetry run ingest-vcf <args>
