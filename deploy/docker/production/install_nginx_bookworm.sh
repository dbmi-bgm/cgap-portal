# Installs the pinned nginx.org MAINLINE build on a Debian bookworm base.
#
# Originally copied from https://github.com/nginxinc/docker-nginx/blob/master/mainline/debian/Dockerfile
# (March 3 2022 -Will) for bullseye. Moved to bookworm because nginx.org's bullseye
# mainline repository stops at 1.31.6, which is vulnerable to CVE-2026-123633 and
# CVE-2026-123007 (fixed in 1.31.9; see https://nginx.org/en/security_advisories.html).
# nginx 1.31.9 and njs 1.0.2 are published for bookworm (amd64 and arm64).
export NGINX_VERSION=1.31.9
export NJS_VERSION=1.0.2
export PKG_RELEASE=1~bookworm

# The nginx.org repository is verified by signature (`signed-by=` below) rather than
# trusted blindly. The key bundle published at nginx.org/keys/nginx_signing.key holds
# the legacy 2011 key plus the two 2024 rotation keys; all three fingerprints are
# checked so a substituted key file fails the build instead of silently authorizing
# an unexpected repository.
#
# The single `[ trusted=yes ]` further down is the LOCAL, just-built file:// repo of .deb
# packages compiled from nginx.org SOURCE packages that apt had already verified against
# the signature-checked remote repository. It is NOT a remote trust bypass -- the remote
# nginx.org source is `signed-by=` verified in both branches of the arch case statement.
# (Comments have to live up here: mid-`&&`-chain a comment would eat the line
# continuation and break the chain.)
NGINX_GPGKEY_PATH=/usr/share/keyrings/nginx-archive-keyring.gpg
NGINX_EXPECTED_FINGERPRINTS="573BFD6B3D8FBC641079A6ABABF5BD827BD9BF62
8540A6F18833A80E9C1653A42FD21310B49F6B46
9E9BE90EACBCDE69FE9B204CBCDCD8A38D88A2B3"

set -x \
# create nginx user/group first, to be consistent throughout docker variants
    addgroup --system --gid 121 nginx \
    && adduser --system --disabled-login --ingroup nginx --no-create-home --home /nonexistent --gecos "nginx user" --shell /bin/false --uid 121 nginx \
    && apt-get update \
    && apt-get install --no-install-recommends --no-install-suggests -y gnupg ca-certificates curl \
    && \
    set -e; \
    curl -fsSL https://nginx.org/keys/nginx_signing.key -o /tmp/nginx_signing.key; \
    export GNUPGHOME="$(mktemp -d)"; \
    actual_fingerprints="$(gpg --show-keys --with-colons /tmp/nginx_signing.key | awk -F: '/^fpr:/ { print $10 }')"; \
    for fpr in $NGINX_EXPECTED_FINGERPRINTS; do \
        echo "$actual_fingerprints" | grep -qx "$fpr" \
            || { echo >&2 "error: nginx signing key bundle is missing expected fingerprint $fpr"; exit 1; }; \
    done; \
    gpg --dearmor < /tmp/nginx_signing.key > "$NGINX_GPGKEY_PATH"; \
    rm -rf "$GNUPGHOME" /tmp/nginx_signing.key; \
    unset GNUPGHOME; \
    set +e; \
    apt-get remove --purge --auto-remove -y gnupg && rm -rf /var/lib/apt/lists/* \
    && dpkgArch="$(dpkg --print-architecture)" \
    && nginxPackages=" \
        nginx=${NGINX_VERSION}-${PKG_RELEASE} \
        nginx-module-xslt=${NGINX_VERSION}-${PKG_RELEASE} \
        nginx-module-geoip=${NGINX_VERSION}-${PKG_RELEASE} \
        nginx-module-image-filter=${NGINX_VERSION}-${PKG_RELEASE} \
        nginx-module-njs=${NGINX_VERSION}+${NJS_VERSION}-${PKG_RELEASE} \
    " \
    && case "$dpkgArch" in \
        amd64|arm64) \
            echo "deb [signed-by=$NGINX_GPGKEY_PATH] https://nginx.org/packages/mainline/debian/ bookworm nginx" >> /etc/apt/sources.list.d/nginx.list \
            && apt-get update \
            ;; \
        *) \
            echo "deb-src [signed-by=$NGINX_GPGKEY_PATH] https://nginx.org/packages/mainline/debian/ bookworm nginx" >> /etc/apt/sources.list.d/nginx.list \
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
                        curl \
    && apt-get remove --purge --auto-remove -y && rm -rf /var/lib/apt/lists/* /etc/apt/sources.list.d/nginx.list \
    \
    && if [ -n "$tempDir" ]; then \
        apt-get purge -y --auto-remove \
        && rm -rf "$tempDir" /etc/apt/sources.list.d/temp.list; \
    fi \
    && ln -sf /dev/stdout /var/log/nginx/access.log \
    && ln -sf /dev/stderr /var/log/nginx/error.log
