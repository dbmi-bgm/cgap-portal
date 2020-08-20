'use strict';

import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import { layout } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { UserRegistrationModal } from './UserRegistrationModal';


export const LoginNavItem = React.memo(function LoginNavItem(props){
    const { id =  "loginbtn", isRegistrationModalVisible, showLock, isLoading } = props;
    const onClick = useMemo(function(){
        return function(e){
            // Prevent setting URL to '#' as might cause navigation away from tab.
            e.preventDefault();
            showLock();
            return false;
        };
    }, [ showLock ]);
    return (
        <React.Fragment>
            <a role="button" href="#" key="login-reg-btn" active={isRegistrationModalVisible} onClick={onClick} className="nav-link user-account-item" id={id}>
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
