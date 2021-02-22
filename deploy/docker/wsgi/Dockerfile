FROM python:3.6-buster

MAINTAINER William Ronchetti "william_ronchetti@hms.harvard.edu"

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
# Remove default configuration from Nginx
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/nginx.conf

# Intall things needed for our system
RUN apt-get update
RUN apt-get install -y curl postgresql-client
RUN curl -sL https://deb.nodesource.com/setup_10.x | bash -
RUN apt-get install -y ca-certificates nodejs npm

EXPOSE 80
EXPOSE 443

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
RUN make build
RUN make aws-ip-ranges
RUN cat /dev/urandom | head -c 256 | base64 > session-secret.b64
COPY development.ini .
USER cgap-admin

#COPY entrypoint.sh /home/cgap-admin/entrypoint.sh
#ENTRYPOINT ["/home/cgap-admin/entrypoint.sh"]
#TODO link up with nginx
#TODO expose back-end ports
#ie: make deploy1 on local machine, make deploy2/3 runs in the docker


