'use strict';

import React from 'react';

/**
 * Render a simple static error page with a link to return to the homepage.
 */
export default class ErrorPage extends React.PureComponent {

    render() {
        const { currRoute, status } = this.props;

        let errorMessage;

        if (status === 'invalid_login'){
            errorMessage = (
                <div>
                    <h3>The account you provided is not valid. <a href="/">Return</a> to the homepage.</h3>
                    <h5>
                        Please note: our authentication system will automatically
                        attempt to log you in through your selected provider if you are
                        already logged in there. If you have an account with 4DN, please make sure
                        that you are logged in to the provider (e.g. google) with the matching email address.
                    </h5>
                    <h5>Access is restricted to 4DN consortium members.</h5>
                    <h5><a href="mailto:4DN.DCIC.support@hms-dbmi.atlassian.net">Request an account.</a></h5>
                </div>
            );
        } else if (status === 'not_found'){
            return <HTTPNotFoundView/>;
        } else if (status === 'forbidden'){
            return <HTTPForbiddenView/>;
        }else{
            errorMessage = <h3>{"The page you've requested does not exist or you have found an error."} <a href="/">Return</a> to the homepage.</h3>;
        }
        return <div className="error-page text-center container" id="content">{ errorMessage }</div>;
    }
}

const HTTPNotFoundView = React.memo(function(props){
    return (
        <div className="error-page container" id="content">
            <div className="error-msg-container mt-3 mb-3 row">
                <i className="icon icon-exclamation-circle fas col-auto text-larger"/>
                <div className="title-wrapper col">
                    <h4 className="text-400 mb-0 mt-0">
                        {"The page you've requested does not exist."}
                    </h4>
                    <p className="mb-0 mt-0">
                        <a href="/">Return</a> to the homepage.
                    </p>
                </div>
            </div>
        </div>
    );
});

const HTTPForbiddenView = React.memo(function HTTPForbiddenView(props){
    return (
        <div className="error-page container" id="content">
            <div className="error-msg-container mt-3 mb-3 row">
                <i className="icon icon-ban fas col-auto text-larger"/>
                <div className="title-wrapper col">
                    <h4 className="text-400 mb-0 mt-0">
                        Access was denied to this resource.
                    </h4>
                    <p className="mb-0 mt-0">
                        If you have an account, please try logging in or return to the <a href="/">homepage</a>.
                        <br/>
                        For instructions on how to set up an account, please visit the help page for <a href="/help/account-creation">Creating an Account</a>.
                    </p>
                </div>
            </div>
        </div>
    );
});
