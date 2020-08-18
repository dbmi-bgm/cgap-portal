'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import { layout } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { UserRegistrationModal } from './UserRegistrationModal';


export const LoginNavItem = React.memo(function LoginNavItem(props){
    const { id =  "loginbtn", isRegistrationModalVisible, showLock, isLoading } = props;
    return (
        <React.Fragment>
            <a role="button" href="#" key="login-reg-btn" active={isRegistrationModalVisible} onClick={showLock} className="nav-link user-account-item" id={id}>
                { isLoading ? (
                    <span className="pull-right">
                        <i className="account-icon icon icon-spin icon-circle-notch fas align-middle"/>
                    </span>
                ) : (
                    <React.Fragment>
                        <i className="account-icon icon icon-user fas" />
                        <span>Log In</span>
                        <span className="d-none d-xl-inline"> / Register</span>
                    </React.Fragment>
                )}
            </a>
            { isRegistrationModalVisible ? <UserRegistrationModal {...props} /> : null }
        </React.Fragment>
    );
});
LoginNavItem.propTypes = {
    'session'       : PropTypes.bool.isRequired,
    'href'          : PropTypes.string.isRequired,
    'id'            : PropTypes.string,
    'windowWidth'   : PropTypes.number,
    ...UserRegistrationModal.propTypes
};
