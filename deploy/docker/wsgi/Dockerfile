FROM python:3.6-buster

MAINTAINER William Ronchetti "william_ronchetti@hms.harvard.edu"

ENV DEBIAN_FRONTEND=noninteractive

# Copied from: https://github.com/nginxinc/docker-nginx/blob/594ce7a8bc26c85af88495ac94d5cd0096b306f7/mainline/buster/Dockerfile

# Standard set up Nginx
ENV NGINX_VERSION=1.17.10
ENV NJS_VERSION=0.3.9
ENV PKG_RELEASE=1~buster

# Securely provisions deps, installs Nginx, then removes all artifacts
RUN set -x \
    && apt-get update \
    && apt-get install --no-install-recommends --no-install-suggests -y gnupg1 ca-certificates \
    && \
    NGINX_GPGKEY=573BFD6B3D8FBC641079A6ABABF5BD827BD9BF62; \
    found=''; \
    for server in \
        ha.pool.sks-keyservers.net \
        hkp://keyserver.ubuntu.com:80 \
        hkp://p80.pool.sks-keyservers.net:80 \
        pgp.mit.edu \
    ; do \
        echo "Fetching GPG key $NGINX_GPGKEY from $server"; \
        apt-key adv --keyserver "$server" --keyserver-options timeout=10 --recv-keys "$NGINX_GPGKEY" && found=yes && break; \
    done; \
    test -z "$found" && echo >&2 "error: failed to fetch GPG key $NGINX_GPGKEY" && exit 1; \
    apt-get remove --purge --auto-remove -y gnupg1 && rm -rf /var/lib/apt/lists/* \
    && dpkgArch="$(dpkg --print-architecture)" \
    && nginxPackages=" \
        nginx=${NGINX_VERSION}-${PKG_RELEASE} \
        nginx-module-xslt=${NGINX_VERSION}-${PKG_RELEASE} \
        nginx-module-geoip=${NGINX_VERSION}-${PKG_RELEASE} \
        nginx-module-image-filter=${NGINX_VERSION}-${PKG_RELEASE} \
        nginx-module-njs=${NGINX_VERSION}.${NJS_VERSION}-${PKG_RELEASE} \
    " \
    && case "$dpkgArch" in \
        amd64|i386) \
            echo "deb https://nginx.org/packages/mainline/debian/ buster nginx" >> /etc/apt/sources.list.d/nginx.list \
            && apt-get update \
            ;; \
        *) \
            echo "deb-src https://nginx.org/packages/mainline/debian/ buster nginx" >> /etc/apt/sources.list.d/nginx.list \
            \
            && tempDir="$(mktemp -d)" \
            && chmod 777 "$tempDir" \
            \
            && savedAptMark="$(apt-mark showmanual)" \
            \
            && apt-get update \
            && apt-get build-dep -y $nginxPackages \
            && ( \
                cd "$tempDir" \
                && DEB_BUILD_OPTIONS="nocheck parallel=$(nproc)" \
                    apt-get source --compile $nginxPackages \
            ) \
            \
            && apt-mark showmanual | xargs apt-mark auto > /dev/null \
            && { [ -z "$savedAptMark" ] || apt-mark manual $savedAptMark; } \
            \
            && ls -lAFh "$tempDir" \
            && ( cd "$tempDir" && dpkg-scanpackages . > Packages ) \
            && grep '^Package: ' "$tempDir/Packages" \
            && echo "deb [ trusted=yes ] file://$tempDir ./" > /etc/apt/sources.list.d/temp.list \
            && apt-get -o Acquire::GzipIndexes=false update \
            ;; \
    esac \
    \
    && apt-get install --no-install-recommends --no-install-suggests -y \
                        $nginxPackages \
                        gettext-base \
    && apt-get remove --purge --auto-remove -y ca-certificates && rm -rf /var/lib/apt/lists/* /etc/apt/sources.list.d/nginx.list \
    \
    && if [ -n "$tempDir" ]; then \
        apt-get purge -y --auto-remove \
        && rm -rf "$tempDir" /etc/apt/sources.list.d/temp.list; \
    fi

# forward request and error logs to docker log collector
RUN ln -sf /dev/stdout /var/log/nginx/access.log \
    && ln -sf /dev/stderr /var/log/nginx/error.log

# end of Nginx setup

# Intall things needed for our system
RUN apt-get update
RUN apt-get install -y curl
RUN curl -sL https://deb.nodesource.com/setup_10.x | bash -
RUN apt-get install -y ca-certificates nodejs npm
ENV CRYPTOGRAPHY_DONT_BUILD_RUST=1

EXPOSE 80
EXPOSE 443

# Remove default configuration from Nginx
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/nginx.conf

# Configure venv
RUN useradd -ms /bin/bash cgap-admin
WORKDIR /home/cgap-admin
RUN python -m venv /opt/venv
RUN chown cgap-admin /opt/venv
RUN mkdir -p /home/cgap-admin/cgap-portal
RUN mkdir -p /home/cgap-admin/.poetry
RUN chown cgap-admin /home/cgap-admin/cgap-portal
RUN chown cgap-admin /home/cgap-admin/.poetry

# Configure Poetry
ENV PYTHONFAULTHANDLER=1 \
  PYTHONUNBUFFERED=1 \
  PYTHONHASHSEED=random \
  PIP_NO_CACHE_DIR=off \
  PIP_DISABLE_PIP_VERSION_CHECK=on \
  PIP_DEFAULT_TIMEOUT=100 \
  POETRY_VERSION=1.1.4

# Copy to /home/cgap-admin/cgap-portal
WORKDIR /home/cgap-admin/
RUN git clone https://github.com/dbmi-bgm/cgap-portal.git

# Build, configure the back-end
WORKDIR /home/cgap-admin/cgap-portal
RUN . /opt/venv/bin/activate && pip install --upgrade pip
RUN . /opt/venv/bin/activate && make build
RUN make aws-ip-ranges
RUN cat /dev/urandom | head -c 256 | base64 > session-secret.b64
USER cgap-admin

#COPY entrypoint.sh /home/cgap-admin/entrypoint.sh
#ENTRYPOINT ["/home/cgap-admin/entrypoint.sh"]
#TODO link up with nginx
#TODO expose back-end ports
#ie: make deploy1 on local machine, make deploy2/3 runs in the docker


