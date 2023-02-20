#!/bin/bash

TMP_FILE=/tmp/fixup-poetry-dot-lock-$$.tmp
INPUT_FILE=poetry.lock

sed -E 's/zope-deprecation/zope.deprecation/' < $INPUT_FILE | \
sed -E 's/(^|[^"])(zope\.deprecation)($|[^"])/"\2"/g' | \
sed -E 's/zope-interface/zope.interface/' | \
sed -E 's/(^|[^"])(zope\.interface)($|[^"])/"\2"/g' | \
sed -E 's/zope-sqlalchemy/zope.sqlalchemy/' | \
sed -E 's/(^|[^"])(zope\.sqlalchemy)($|[^"])/"\2"/g' | \
sed -E 's/repoze-debug/repoze.debug/' | \
sed -E 's/(^|[^"])(repoze\.debug)($|[^"])/"\2"/g' | \
sed -E 's/backports-statistics/backports.statistics/' | \
sed -E 's/(^|[^"])(backports\.statistics)($|[^"])/"\2"/g' > $TMP_FILE

mv $TMP_FILE $INPUT_FILE
