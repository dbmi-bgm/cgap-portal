# CGAP-Portal (Production) Dockerfile
# Note that images are pinned via sha256 as opposed to tag
# so that we don't pick up new images unintentionally

# Debian Buster with Python 3.6.13
# TODO: maybe swap in ubuntu 20.04 and install Python manually?
FROM python@sha256:db248d2d0494973550d323dd6b82af7fc2f4c1e0365769a758abd7fac2aa70db

MAINTAINER William Ronchetti "william_ronchetti@hms.harvard.edu"

# Build Arguments
ARG CGAP_ENV_NAME
ENV CGAP_ENV_NAME=${CGAP_ENV_NAME:-"cgap-mastertest"}
ARG BUILD_PATH
ENV BUILD_PATH=${BUILD_PATH:-"deploy/docker/production"}
ARG INI_BASE
ENV INI_BASE=${INI_BASE:-"mastertest.ini"}
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
COPY $BUILD_PATH/install_nginx.sh /
RUN bash /install_nginx.sh && \
    apt-get update && \
    apt-get install -y curl vim emacs postgresql-client net-tools && \
    curl -sL https://deb.nodesource.com/setup_10.x | bash - && \
    apt-get install -y ca-certificates nodejs npm

# Configure CGAP User (nginx)
WORKDIR /home/nginx

# Configure venv
ENV VIRTUAL_ENV=/opt/venv
RUN python -m venv /opt/venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Upgrade pip, install in layer
RUN pip install --upgrade pip && \
    pip install poetry==1.1.4 wheel==0.29.0

# Adjust permissions
RUN chown -R nginx:nginx /opt/venv && \
    mkdir -p /home/nginx/cgap-portal

WORKDIR /home/nginx/cgap-portal

# Do the back-end dependency install
COPY pyproject.toml .
COPY poetry.lock .
RUN poetry install --no-root

# Do the front-end dependency install
COPY package.json .
COPY package-lock.json .
RUN npm ci --no-fund --no-progress --no-optional --no-audit --python=/opt/venv/bin/python

# Copy over the rest of the code
COPY . .

# Build remaining back-end
RUN poetry install && \
    python setup_eb.py develop && \
    make fix-dist-info

# Build front-end
RUN npm run build && \
    npm run build-scss

# Misc
RUN make aws-ip-ranges && \
    cat /dev/urandom | head -c 256 | base64 > session-secret.b64

# Copy config files in (down here for quick debugging)
# Remove default configuration from Nginx
RUN rm /etc/nginx/nginx.conf && \
    rm /etc/nginx/conf.d/default.conf
COPY $BUILD_PATH/nginx.conf /etc/nginx/nginx.conf

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

# Provide base ini file
# will be picked up by IniFileManager
# *.ini must match the env name in secrets manager!
# For now, this is mastertest. - Will 04/29/21
SHELL ["/bin/bash", "-c"]
RUN if [[ $BUILD_PATH =~ .*production.* ]]; then \
        echo "Detected production build" && \
        cp $BUILD_PATH/$INI_BASE deploy/ini_files/. ; \
    else \
        echo "Detected local build" && \
        cp $BUILD_PATH/docker_development.ini development.ini ; \
    fi

RUN touch production.ini
RUN chown nginx:nginx production.ini

COPY $BUILD_PATH/$ENTRYPOINT entrypoint.sh
COPY deploy/docker/production/assume_identity.py .
RUN chmod +x entrypoint.sh
RUN chmod +x assume_identity.py
EXPOSE 8000

# Container does not run as root
USER nginx

ENTRYPOINT ["/home/nginx/cgap-portal/entrypoint.sh"]
