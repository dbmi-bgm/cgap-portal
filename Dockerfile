# syntax=docker/dockerfile:1.7
# CGAP-Portal (Production) Dockerfile

# Keep the CGAP base image and tool versions; only the build is split into
# builder/runtime stages so compilers and front-end build dependencies do not
# ship in the production image.
ARG BASE_IMAGE=python:3.11.5-slim-bullseye

FROM ${BASE_IMAGE} AS builder

ENV DEBIAN_FRONTEND=noninteractive \
    CRYPTOGRAPHY_DONT_BUILD_RUST=1 \
    PYTHONFAULTHANDLER=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONHASHSEED=random \
    PIP_NO_CACHE_DIR=off \
    PIP_DISABLE_PIP_VERSION_CHECK=on \
    PIP_DEFAULT_TIMEOUT=100 \
    NVM_VERSION=v0.39.1 \
    NODE_VERSION=20.17.0

ENV VIRTUAL_ENV=/opt/venv
RUN python -m venv /opt/venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Build-only system dependencies, Poetry, and Node.
WORKDIR /home/nginx/.nvm
ENV NVM_DIR=/home/nginx/.nvm
RUN echo 'Acquire::Retries "5";' > /etc/apt/apt.conf.d/80-retries && \
    echo 'Acquire::http::Pipeline-Depth "0";' >> /etc/apt/apt.conf.d/80-retries
RUN apt-get update && apt-get upgrade -y && \
    apt-get install -y --no-install-recommends vim emacs net-tools ca-certificates build-essential \
    gcc zlib1g-dev postgresql-client libpq-dev git make curl libmagic-dev && \
    pip install --upgrade pip && \
    pip install poetry==1.4.2 && \
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh | bash && \
    . "$NVM_DIR/nvm.sh" && nvm install ${NODE_VERSION} && \
    nvm use v${NODE_VERSION} && \
    nvm alias default v${NODE_VERSION}
ENV PATH="/home/nginx/.nvm/versions/node/v${NODE_VERSION}/bin/:${PATH}"

WORKDIR /home/nginx/cgap-portal

# Install locked back-end and front-end dependencies before copying source so
# code-only changes retain the expensive dependency layers.
COPY pyproject.toml poetry.lock poetry.toml ./
RUN --mount=type=cache,target=/root/.cache/pypoetry \
    --mount=type=cache,target=/root/.cache/pip \
    poetry install --no-root --no-dev

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-fund --no-progress --no-optional --no-audit --python=/opt/venv/bin/python

COPY . .
RUN --mount=type=cache,target=/root/.cache/pypoetry \
    poetry install --no-dev -vvv && \
    python setup_eb.py develop && \
    make fix-dist-info

ENV NODE_ENV=production
RUN npm run build && \
    npm run build-scss && \
    rm -rf node_modules/

# CGAP consumes this generated file from the application root at runtime.
RUN curl -o aws-ip-ranges.json https://ip-ranges.amazonaws.com/ip-ranges.json

FROM ${BASE_IMAGE} AS runtime

MAINTAINER William Ronchetti "william_ronchetti@hms.harvard.edu"

# Build Arguments
ARG INI_BASE
ENV INI_BASE=${INI_BASE:-"cgap_any_alpha.ini"}

ENV NGINX_USER=nginx \
    DEBIAN_FRONTEND=noninteractive \
    CRYPTOGRAPHY_DONT_BUILD_RUST=1 \
    PYTHONFAULTHANDLER=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONHASHSEED=random \
    PIP_DISABLE_PIP_VERSION_CHECK=on \
    PIP_DEFAULT_TIMEOUT=100 \
    VIRTUAL_ENV=/opt/venv \
    NODE_VERSION=20.17.0
ENV NODE_DIR=/home/nginx/.nvm/versions/node/v${NODE_VERSION}
ENV PATH="$VIRTUAL_ENV/bin:${NODE_DIR}/bin:$PATH"

RUN echo 'Acquire::Retries "5";' > /etc/apt/apt.conf.d/80-retries && \
    echo 'Acquire::http::Pipeline-Depth "0";' >> /etc/apt/apt.conf.d/80-retries

# Runtime dependencies only. libpq5 remains because CGAP includes the source
# psycopg2 package as well as psycopg2-binary; headers and compilers stay above.
RUN apt-get update && apt-get upgrade -y && \
    apt-get install -y --no-install-recommends ca-certificates git make libmagic1 libpq5 && \
    apt-get clean

# Install CGAP's pinned nginx.org packages with its existing signed-by keyring
# verification. Do not replace this with an unverified or distro-default source.
COPY deploy/docker/production/install_nginx_bullseye.sh /install_nginx.sh
RUN bash /install_nginx.sh && \
    apt-get update && apt-get install -y --no-install-recommends ca-certificates && \
    apt-get clean

# Remove packaged nginx defaults and install CGAP's configuration.
RUN rm -f /etc/nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/docker/production/nginx.conf /etc/nginx/nginx.conf

# nginx and CGAP's cache/log/pid paths are writable by the non-root runtime user.
RUN chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid && \
    rm -f /var/log/nginx/* && \
    touch /var/log/nginx/access.log && \
    chown -R nginx:nginx /var/log/nginx/access.log && \
    touch /var/log/nginx/error.log && \
    chown -R nginx:nginx /var/log/nginx/error.log && \
    mkdir -p /data/nginx/cache && \
    chown -R nginx:nginx /data/nginx/cache

WORKDIR /home/nginx/cgap-portal

# Copy only the built application, venv, and Node runtime from the builder.
COPY --chown=nginx:nginx --from=builder /opt/venv /opt/venv
COPY --chown=nginx:nginx --from=builder /home/nginx/cgap-portal /home/nginx/cgap-portal
COPY --chown=nginx:nginx --from=builder ${NODE_DIR} ${NODE_DIR}

# CGAP-specific configuration and entrypoints.
COPY --chown=nginx:nginx deploy/docker/local/docker_development.ini development.ini
COPY --chown=nginx:nginx deploy/docker/local/entrypoint.sh entrypoint_local.sh
COPY --chown=nginx:nginx deploy/docker/production/$INI_BASE deploy/ini_files/.
COPY --chown=nginx:nginx deploy/docker/production/entrypoint.sh .
COPY --chown=nginx:nginx deploy/docker/production/entrypoint_portal.sh .
COPY --chown=nginx:nginx deploy/docker/production/entrypoint_deployment.sh .
COPY --chown=nginx:nginx deploy/docker/production/entrypoint_indexer.sh .
COPY --chown=nginx:nginx deploy/docker/production/entrypoint_ingester.sh .
COPY --chown=nginx:nginx deploy/docker/production/supervisord.conf .
COPY --chown=nginx:nginx deploy/docker/production/assume_identity.py .

RUN touch production.ini session-secret.b64 supervisord.log supervisord.sock supervisord.pid && \
    chown nginx:nginx production.ini session-secret.b64 supervisord.log supervisord.sock supervisord.pid && \
    chmod +x entrypoint.sh entrypoint_local.sh entrypoint_portal.sh \
             entrypoint_deployment.sh entrypoint_indexer.sh entrypoint_ingester.sh \
             assume_identity.py

EXPOSE 8000

# Container does not run as root
USER nginx

ENTRYPOINT ["/home/nginx/cgap-portal/entrypoint.sh"]
