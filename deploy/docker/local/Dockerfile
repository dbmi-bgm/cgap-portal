FROM python:3.6-buster

MAINTAINER William Ronchetti "william_ronchetti@hms.harvard.edu"

# Build Arguments
ARG CGAP_ENV_NAME
ENV CGAP_ENV_NAME=${CGAP_ENV_NAME:-"cgap-docker-will-test"}

# Configure (global) Env
ENV CGAP_REPO=https://github.com/dbmi-bgm/cgap-portal.git
ENV CGAP_BRANCH=c4_519
ENV DEBIAN_FRONTEND=noninteractive
ENV CRYPTOGRAPHY_DONT_BUILD_RUST=1
ENV PYTHONFAULTHANDLER=1 \
  PYTHONUNBUFFERED=1 \
  PYTHONHASHSEED=random \
  PIP_NO_CACHE_DIR=off \
  PIP_DISABLE_PIP_VERSION_CHECK=on \
  PIP_DEFAULT_TIMEOUT=100 \
  POETRY_VERSION=1.1.4

# Install nginx (unused for local deployment as this runs as part of `make deploy1`)
COPY install_nginx.sh /
RUN bash /install_nginx.sh

# Intall things needed for our system
RUN apt-get update
RUN apt-get install -y curl postgresql-client
RUN curl -sL https://deb.nodesource.com/setup_10.x | bash -
RUN apt-get install -y ca-certificates nodejs npm

# Configure CGAP User
RUN useradd -ms /bin/bash cgap-admin
WORKDIR /home/cgap-admin
RUN mkdir -p /home/cgap-admin/cgap-portal
RUN chown cgap-admin /home/cgap-admin/cgap-portal

# Configure venv
ENV VIRTUAL_ENV=/opt/venv
RUN python -m venv /opt/venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"
RUN chown cgap-admin /opt/venv

# Copy to /home/cgap-admin/cgap-portal
RUN git clone $CGAP_REPO --branch $CGAP_BRANCH

# Build the application
WORKDIR /home/cgap-admin/cgap-portal
RUN pip install --upgrade pip
RUN pip install poetry==1.1.4 wheel==0.29.0
RUN poetry install
RUN python setup_eb.py develop
RUN make fix-dist-info
RUN npm install --no-fund --no-progress --python=/opt/venv/bin/python
RUN npm run build
RUN npm run build-scss
RUN make aws-ip-ranges
RUN cat /dev/urandom | head -c 256 | base64 > session-secret.b64

# Copy config files in (down here for quick debugging)
# Remove default configuration from Nginx
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY development.ini .
COPY entrypoint.sh .
RUN chmod 777 entrypoint.sh
EXPOSE 8000
USER cgap-admin

CMD service nginx start

ENTRYPOINT ["/home/cgap-admin/cgap-portal/entrypoint.sh"]
