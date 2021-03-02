# CGAP-Portal Dockerfile

# TODO: appropriately pin/verify this image
FROM python:3.6.12-buster

MAINTAINER William Ronchetti "william_ronchetti@hms.harvard.edu"

# Build Arguments
ARG CGAP_ENV_NAME
ENV CGAP_ENV_NAME=${CGAP_ENV_NAME:-"cgap-docker-will-test"}
#ARG RUN_TEST
#ENV RUN_TEST=${RUN_TEST:-1}

# Configure (global) Env
ENV CGAP_REPO=https://github.com/dbmi-bgm/cgap-portal.git
ENV CGAP_BRANCH=c4_519
ENV NGINX_USER=nginx
ENV DEBIAN_FRONTEND=noninteractive
ENV CRYPTOGRAPHY_DONT_BUILD_RUST=1
ENV PYTHONFAULTHANDLER=1 \
  PYTHONUNBUFFERED=1 \
  PYTHONHASHSEED=random \
  PIP_NO_CACHE_DIR=off \
  PIP_DISABLE_PIP_VERSION_CHECK=on \
  PIP_DEFAULT_TIMEOUT=100 \
  POETRY_VERSION=1.1.4

# Install nginx
COPY install_nginx.sh /
RUN bash /install_nginx.sh

# Intall things needed for our system
RUN apt-get update
RUN apt-get install -y curl vim emacs postgresql-client net-tools
RUN curl -sL https://deb.nodesource.com/setup_10.x | bash -
RUN apt-get install -y ca-certificates nodejs npm

# Configure CGAP User
WORKDIR /home/nginx
RUN mkdir -p /home/nginx/cgap-portal

# Configure venv
ENV VIRTUAL_ENV=/opt/venv
RUN python -m venv /opt/venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"
RUN chown -R nginx:nginx /opt/venv

# Copy to /home/nginx/cgap-portal
RUN git clone $CGAP_REPO --branch $CGAP_BRANCH

# Build the application
WORKDIR /home/nginx/cgap-portal
RUN pip install --upgrade pip
RUN pip install poetry==1.1.4 wheel==0.29.0
RUN poetry install
RUN python setup_eb.py develop
RUN make fix-dist-info
RUN npm ci --no-fund --no-progress --python=/opt/venv/bin/python
RUN npm run build
RUN npm run build-scss
RUN make aws-ip-ranges
RUN cat /dev/urandom | head -c 256 | base64 > session-secret.b64

# Copy config files in (down here for quick debugging)
# Remove default configuration from Nginx
RUN rm /etc/nginx/nginx.conf
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/nginx.conf
# give nginx user permissions
RUN chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d
RUN touch /var/run/nginx.pid && \
        chown -R nginx:nginx /var/run/nginx.pid
RUN rm -f /var/log/nginx/*
RUN touch /var/log/nginx/access.log && \
        chown -R nginx:nginx /var/log/nginx/access.log
RUN touch /var/log/nginx/error.log && \
        chown -R nginx:nginx /var/log/nginx/error.log

# Copy over ini file, entrypoint
COPY docker_development.ini development.ini
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh
EXPOSE 8000
# Uncomment this to run as the unprivileged user
# USER nginx

ENTRYPOINT ["/home/nginx/cgap-portal/entrypoint.sh"]
