'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import memoize from 'memoize-one';
import _ from 'underscore';
import { DropdownButton, DropdownItem } from 'react-bootstrap';
import DefaultItemView from './../DefaultItemView';
import { console, layout, ajax, object } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Checkbox } from '@hms-dbmi-bgm/shared-portal-components/es/components/forms/components/Checkbox';
import { CollapsibleItemViewButtonToolbar } from './../components/CollapsibleItemViewButtonToolbar';
import { PedigreeDetailPane } from './../components/PedigreeDetailPane';

/** @todo Eveyrthing */

export class CaseSubmissionView extends React.PureComponent {

    constructor(props){
        super(props);
        this.state = {

        };
    }

}