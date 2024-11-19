import React from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';

import { patchedConsoleInstance as console } from '@hms-dbmi-bgm/shared-portal-components/es/components/util/patched-console';
import { FileDownloadButtonAuto as FileDownloadButtonAutoOriginal } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/FileDownloadButton';

import { File } from './typedefs';


/**************************
 ** Common React Classes **
 ************************/

/** Uses different defaultProps.canDownloadStatuses, specific to project */
export function FileDownloadButtonAuto({
    canDownloadStatuses = [
        'uploaded',
        'released',
        'replaced',
        'submission in progress',
        'released to project',
        'archived'
    ],
    ...props
}) {
    return <FileDownloadButtonAutoOriginal {...props} />;
}
