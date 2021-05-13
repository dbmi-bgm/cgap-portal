# CGAP-Portal Dockerfile

# TODO: appropriately pin/verify this image
FROM python:3.6.12-buster

MAINTAINER William Ronchetti "william_ronchetti@hms.harvard.edu"

# CGAP-Portal Dockerfile
# Note that images are pinned via sha256 as opposed to tag
# so that we don't pick up new images unintentionally

# Debian Buster with Python 3.6.13
FROM python@sha256:db248d2d0494973550d323dd6b82af7fc2f4c1e0365769a758abd7fac2aa70db

MAINTAINER William Ronchetti "william_ronchetti@hms.harvard.edu"

# Build Arguments
ARG CGAP_ENV_NAME
ENV CGAP_ENV_NAME=${CGAP_ENV_NAME:-"cgap-mastertest"}
ARG CGAP_REPO
ENV CGAP_REPO=${CGAP_REPO:-"https://github.com/dbmi-bgm/cgap-portal.git"}
ARG CGAP_BRANCH
ENV CGAP_BRANCH=${CGAP_BRANCH:-"c4_519"}
ARG ENTRYPOINT
ENV ENTRYPOINT=${ENTRYPOINT:-"entrypoint.sh"}

# Configure (global) Env
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

# Install nginx, base system
COPY install_nginx.sh /
RUN bash /install_nginx.sh && \
    apt-get update && \
    apt-get install -y curl vim emacs postgresql-client net-tools && \
    curl -sL https://deb.nodesource.com/setup_10.x | bash - && \
    apt-get install -y ca-certificates nodejs npm

# Configure CGAP User (nginx)
WORKDIR /home/nginx

# Configure venv, repo, back-end build
ENV VIRTUAL_ENV=/opt/venv
RUN python -m venv /opt/venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"
RUN chown -R nginx:nginx /opt/venv && \
    mkdir -p /home/nginx/cgap-portal && \
    git clone $CGAP_REPO --branch $CGAP_BRANCH && \
    cd cgap-portal && \
    pip install --upgrade pip && \
    pip install poetry==1.1.4 wheel==0.29.0 && \
    poetry install && \
    python setup_eb.py develop && \
    make fix-dist-info

# Front-end
WORKDIR /home/nginx/cgap-portal
RUN npm ci --no-fund --no-progress --no-optional --no-audit --python=/opt/venv/bin/python && \
    npm run build && \
    npm run build-scss

# Misc
RUN make aws-ip-ranges && \
    cat /dev/urandom | head -c 256 | base64 > session-secret.b64

# Copy config files in (down here for quick debugging)
# Remove default configuration from Nginx
RUN rm /etc/nginx/nginx.conf && \
    rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/nginx.conf

# nginx filesystem setup
RUN chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid && \
    rm -f /var/log/nginx/* && \
    touch /var/log/nginx/access.log && \
    chown -R nginx:nginx /var/log/nginx/access.log && \
    touch /var/log/nginx/error.log && \
    chown -R nginx:nginx /var/log/nginx/error.log

# Copy over ini file, entrypoint
COPY docker_development.ini development.ini
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh
EXPOSE 8000
# Uncomment this to run as the unprivileged user
# USER nginx

ENTRYPOINT ["/home/nginx/cgap-portal/entrypoint.sh"]
