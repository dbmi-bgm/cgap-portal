'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import serialize from 'form-serialize';
import memoize from 'memoize-one';

import { console, object, ajax, JWT, analytics, logger } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { LinkToSelector } from '@hms-dbmi-bgm/shared-portal-components/es/components/forms/components/LinkToSelector';
import Collapse from 'react-bootstrap/esm/Collapse';


export default class UserRegistrationForm extends React.PureComponent {

    static propTypes = {
        'unverifiedUserEmail' : PropTypes.string.isRequired,
        'onComplete' : PropTypes.func.isRequired,
        'endpoint' : PropTypes.string.isRequired,
        'captchaSiteKey' : PropTypes.string
    };

    static defaultProps = {
        'captchaSiteKey' : '6Ldq_OIeAAAAAFyJU-_A_EuazErJnF8vMRFS4gaA', // XXX: this needs to be resolved another way
        'endpoint' : "/create-unauthorized-user"
    };

    constructor(props){
        super(props);
        this.onRecaptchaLibLoaded   = this.onRecaptchaLibLoaded.bind(this);
        this.onReCaptchaResponse    = this.onReCaptchaResponse.bind(this);
        this.onReCaptchaError       = this.onReCaptchaError.bind(this);
        this.onReCaptchaExpiration  = this.onReCaptchaExpiration.bind(this);

        this.onFirstNameChange      = this.onFirstNameChange.bind(this);
        this.onLastNameChange       = this.onLastNameChange.bind(this);
        this.onContactEmailChange   = this.onContactEmailChange.bind(this);
        this.onSelectProject        = this.onSelectProject.bind(this);
        this.onClearProject         = this.onClearProject.bind(this);

        this.maySubmitForm          = this.maySubmitForm.bind(this);
        this.onFormSubmit           = this.onFormSubmit.bind(this);

        this.formRef = React.createRef();
        this.recaptchaContainerRef = React.createRef();

        this.state = {
            'captchaResponseToken' : null,
            'captchaErrorMsg'      : null,
            'registrationStatus'   : 'form',

            // These fields are required, so we store in state
            // to be able to do some as-you-type validation
            "value_for_first_name"          : null,
            "value_for_last_name"           : null,
            "value_for_contact_email"       : null,
            "value_for_pending_project"         : null,
            "value_for_pending_project_details" : null
        };
    }

    componentDidMount(){
        window.onRecaptchaLoaded = this.onRecaptchaLibLoaded;
        this.captchaJSTag = document.createElement('script');
        this.captchaJSTag.setAttribute('src', 'https://www.google.com/recaptcha/api.js?onload=onRecaptchaLoaded&render=explicit');
        this.captchaJSTag.setAttribute('async', true);
        document.head.appendChild(this.captchaJSTag);
    }

    componentWillUnmount(){
        if (this.captchaJSTag){
            document.head.removeChild(this.captchaJSTag);
            delete this.captchaJSTag;
        }
    }

    onRecaptchaLibLoaded(){
        const { captchaSiteKey } = this.props;
        const { onReCaptchaResponse, onReCaptchaExpiration } = this;
        console.info('Loaded Google reCaptcha library..');
        grecaptcha.render(this.recaptchaContainerRef.current, {
            'sitekey'           : captchaSiteKey,
            'callback'          : onReCaptchaResponse,
            'error-callback'    : onReCaptchaExpiration,
            'expired-callback'  : onReCaptchaExpiration
        });
    }

    /** We deliver token received here with POSTed form data for server-side validation. */
    onReCaptchaResponse(captchaResponseToken){
        this.setState({ captchaResponseToken, 'captchaErrorMsg' : null });
    }

    onReCaptchaError(){
        this.setState({
            'captchaResponseToken' : null,
            'captchaErrorMsg' : "Please retry - likely network error encountered."
        });
    }

    onReCaptchaExpiration(){
        this.setState({
            'captchaResponseToken' : null,
            'captchaErrorMsg' : "Please retry - reCaptcha validation expired."
        });
    }

    onFirstNameChange(e){
        this.setState({ 'value_for_first_name' : e.target.value });
    }

    onLastNameChange(e){
        this.setState({ 'value_for_last_name' : e.target.value });
    }

    onContactEmailChange(e){
        this.setState({ 'value_for_contact_email' : e.target.value });
    }

    onSelectProject(value_for_pending_project, value_for_pending_project_details){
        // TODO: If value_for_pending_project exists but not value_for_pending_project_details,
        // then do AJAX request to get details.
        // TODO: Error fallback (?)
        console.log('Received project - ', value_for_pending_project, value_for_pending_project_details);
        this.setState({ value_for_pending_project, value_for_pending_project_details });
    }

    onClearProject(e){
        e.preventDefault();
        this.setState({
            'value_for_pending_project' : null,
            'value_for_pending_project_details' : null
        });
    }

    onFormSubmit(evt){
        evt.preventDefault();
        evt.stopPropagation();

        const { endpoint, onComplete, unverifiedUserEmail } = this.props;
        const { value_for_pending_project } = this.state;
        const maySubmit = this.maySubmitForm();
        const formData = serialize(this.formRef.current, { 'hash' : true });

        if (!maySubmit) {
            return;
        }

        // Add data which is held in state but not form fields -- email & project.
        formData.email = unverifiedUserEmail;
        if (value_for_pending_project){ // Add pending_project, if any.
            formData.pending_project = value_for_pending_project;
        }
        if ((!value_for_pending_project && formData.job_title) || formData.job_title === "null"){
            // Remove any potentially default vals if no pending_project requested.
            delete formData.job_title;
        }

        console.log('Full data being sent - ', formData);

        this.setState({ 'registrationStatus' : 'loading' }, ()=>{

            // We may have lost our JWT, e.g. by opening a new 4DN window which unsets the cookie.
            // So we reset our cached JWT token to our cookies/localStorage prior to making request
            // so that it is delivered/authenticated as part of registration (required by backend/security).
            // var existingToken = JWT.get();
            // if (!existingToken){
            //     if (!jwtToken){
            //         this.setState({ 'registrationStatus' : 'network-failure' });
            //         return;
            //     }
            //     JWT.save(jwtToken);
            // }

            ajax.load(
                endpoint,
                (resp) => {
                    onComplete(); // <- Do request to login, then hide/unmount this component.
                },
                'POST',
                (err) => {
                    // TODO
                    // If validation failure, set / show status message, return;
                    // Else If unknown failure:
                    this.setState({ 'registrationStatus' : 'network-failure' });
                    logger.error("Registration Error - Error on post to /create-unauthorized-user.");
                },
                JSON.stringify(formData)
            );

        });

    }

    maySubmitForm(){
        var { captchaResponseToken, value_for_first_name, value_for_last_name, registrationStatus } = this.state;
        return (
            captchaResponseToken && value_for_first_name && value_for_last_name && registrationStatus === 'form'
        );
    }

    render(){
        const { schemas, heading, unverifiedUserEmail } = this.props;
        const {
            registrationStatus, value_for_first_name, value_for_last_name, value_for_contact_email,
            value_for_pending_project_details, value_for_pending_project, captchaErrorMsg: captchaError
        } = this.state;

        // eslint-disable-next-line no-useless-escape
        const emailValidationRegex= /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        const contactEmail = value_for_contact_email && value_for_contact_email.toLowerCase();
        const isContactEmailValid = !contactEmail || emailValidationRegex.test(contactEmail);
        const maySubmit = this.maySubmitForm();
        let errorIndicator = null;
        let loadingIndicator = null;

        if (registrationStatus === 'network-failure'){
            // TODO: Hide form in this case?
            errorIndicator = (
                <div className="alert alert-danger" role="alert">
                    <span className="text-500">Failed to register new account. Please try again later.</span>
                </div>
            );
        } else if (registrationStatus === 'loading' || registrationStatus === 'success-loading'){
            loadingIndicator = (
                <div style={{
                    'position' : 'absolute',
                    'display' : 'flex',
                    'alignItems' : 'center',
                    'fontSize' : '3em',
                    'color' : 'rgba(0,0,0,0.8)',
                    'backgroundColor' : 'rgba(255,255,255,0.85)',
                    'left' : 0, 'right' : 0, 'bottom' : 0, 'top' : 0
                }}>
                    <div className="text-center" style={{ 'width' : '100%' }}>
                        <i className="icon icon-spin icon-circle-notch fas"/>
                    </div>
                </div>
            );
        } else if (registrationStatus === 'success' || registrationStatus === 'success-loading'){
            errorIndicator = (
                <div className="alert alert-success" role="alert">
                    <span className="text-500">
                        <i className="icon icon-fw fas icon-circle-notch"/>&nbsp;&nbsp;{' '}
                        Registered account, logging in...
                    </span>
                </div>
            );
        }

        return (
            <div className="user-registration-form-container" style={{ 'position' : 'relative' }}>

                { errorIndicator }

                { heading }

                <form method="POST" name="user-registration-form was-validated" ref={this.formRef} onSubmit={this.onFormSubmit}>

                    <div className="mb-3">
                        <label htmlFor="email-address">Primary E-Mail or Username</label>
                        <h4 id="email-address" className="text-300 mt-0">
                            { object.itemUtil.User.gravatar(unverifiedUserEmail, 36, { 'style' : { 'borderRadius': '50%', 'marginRight' : 10 } }, 'mm') }
                            { unverifiedUserEmail }
                        </h4>
                    </div>

                    <div className="row">
                        <div className="col-12 col-md-6">
                            <div className="mb-3">
                                <label htmlFor="firstName">First Name <span className="text-danger">*</span></label>
                                <input name="first_name" type="text" onChange={this.onFirstNameChange}
                                    className={"form-control" + (value_for_first_name === '' ? " is-invalid" : "")} />
                                <div className="invalid-feedback">First name cannot be blank</div>
                            </div>
                        </div>
                        <div className="col-12 col-md-6">
                            <div className="mb-3">
                                <label htmlFor="lastName">Last Name <span className="text-danger">*</span></label>
                                <input name="last_name" type="text" onChange={this.onLastNameChange}
                                    className={"form-control" + (value_for_last_name === '' ? " is-invalid" : "")} />
                                <div className="invalid-feedback">Last name cannot be blank</div>
                            </div>
                        </div>
                    </div>

                    <hr className="mt-1 mb-2" />

                    <div className="mb-3">
                        <label htmlFor="pendingProject">Primary Project <span className="text-300">(Selected for you)</span></label>
                        <div><p>cgap-training</p></div>
                        <small className="form-text text-muted">
                            Project with which you are associated.
                        </small>
                    </div>

                    <JobTitleField {...{ value_for_pending_project, value_for_pending_project_details, schemas }}  />

                    <div className="row">
                        <div className="col-12 col-lg-5">
                            <div className={"recaptcha-container" + (captchaError ? ' has-error' : '')}>
                                <div className="g-recaptcha" ref={this.recaptchaContainerRef} />
                                { captchaError ? <span className="help-block">{ captchaError }</span> : null }
                            </div>
                        </div>
                        <div className="col-12 col-lg-7">
                            <p>
                                By signing up, you are agreeing to our <a href="/help/about/privacy-policy" target="_blank" rel="noreferrer noopener" className="link-underline-hover">Privacy Policy</a>.
                                <br/>
                                We may track your usage of the portal to help improve the quality of user experience and/or security assurance purposes.
                            </p>
                        </div>
                    </div>


                    <div className="clearfix d-grid gap-1">
                        <button type="submit" disabled={!(maySubmit)} className="btn btn-lg btn-primary text-300 mt-2">
                            Sign Up
                        </button>
                    </div>
                </form>

                { loadingIndicator }

            </div>
        );
    }

}

// Use this once we have public projects that can be accessed. For now we should just rely on
// using cgap-core as the core project - Will March 15 2022
class LookupProjectField extends React.PureComponent {

    static fieldTitleColStyle = {
        'flex' : 1,
        'padding' : '7px 0 4px 10px',
        'fontSize' : '1.125rem',
        'background' : '#f4f4f4',
        'marginRight' : 5,
        'borderRadius' : 4
    };

    static propTypes = {
        'onSelect' : PropTypes.func.isRequired,
        'onClear' : PropTypes.func.isRequired,
        'loading' : PropTypes.bool.isRequired
    };

    constructor(props){
        super(props);
        this.receiveItem            = this.receiveItem.bind(this);
        this.setIsSelecting         = _.throttle(this.toggleIsSelecting.bind(this, true), 3000, { 'trailing' : false });
        this.unsetIsSelecting       = this.toggleIsSelecting.bind(this, false);
        this.toggleIsSelecting      = this.toggleIsSelecting.bind(this);
        this.state = {
            'isSelecting' : false
        };
    }

    toggleIsSelecting(isSelecting = null){
        this.setState(function({ "isSelecting": prevIsSelecting }){
            if (typeof isSelecting !== 'boolean') {
                isSelecting = !prevIsSelecting;
            }
            return { isSelecting };
        });
    }

    receiveItem(items, endDataPost) {
        const { onSelect } = this.props;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return;
        }

        if (!_.every(items, function ({ id, json }){ return id && typeof id === 'string' && json; })){
            return;
        }

        // endDataPost = (endDataPost !== 'undefined' && typeof endDataPost === 'boolean') ? endDataPost : true;

        if (items.length > 1) {
            console.warn('Multiple projects selected but we only get a single item, since handler\'s multiple version not implemented yet!');
        }

        // We can change back to `endDataPost` instead of `false` in future if we ever allow multiple projects.
        // But most likely additional projects would go into different field, since User.project is not an array at moment anyway.
        this.setState({ 'isSelecting' : false }, function(){
            // Invoke the object callback function, using the text input.
            // eslint-disable-next-line react/destructuring-assignment

            onSelect(items[0].id, items[0].json);
        });
    }

    render(){
        const { loading, currentProjectDetails, onClear } = this.props;
        const { isSelecting } = this.state;
        const tooltip = "Search for a Project and add it to the display.";
        const dropMessage = "Drop a Project here, likely cgap-core.";
        const searchURL = '/search/?currentAction=selection&type=Project';
        const currProjectTitle = (
            isSelecting && (
                <div style={LookupProjectField.fieldTitleColStyle}>
                    Select a project or drag & drop Project Item or URL into this window.
                </div>
            )
        ) || (
            currentProjectDetails && currentProjectDetails['@id'] && currentProjectDetails.display_title && (
                <div style={LookupProjectField.fieldTitleColStyle}>
                    <a href={object.itemUtil.atId(currentProjectDetails)} target="_blank" data-tip="View project in new tab"
                        rel="noopener noreferrer" style={{ verticalAlign: "middle" }} className="link-underline-hover">
                        { currentProjectDetails.display_title }
                    </a>
                    &nbsp;&nbsp;<i className="icon icon-fw icon-external-link-alt fas text-small"/>
                </div>
            )
        ) || (
            <div style={LookupProjectField.fieldTitleColStyle} onClick={this.setIsSelecting} className="clickable" data-tip={tooltip}>
                No Project selected
            </div>
        );

        return (
            <React.Fragment>
                <div className="flexrow ms-0 me-0">
                    { currProjectTitle }
                    <div className="field-buttons">
                        { currentProjectDetails && currentProjectDetails['@id'] ?
                            <button type="button" onClick={onClear} className="btn btn-secondary me-05">
                                Clear
                            </button>
                            : null }
                        <button type="button" className="btn btn-primary" onClick={this.setIsSelecting} disabled={loading || isSelecting} data-tip={tooltip}>
                            Select
                        </button>
                    </div>
                </div>
                { isSelecting ?
                    <LinkToSelector isSelecting onSelect={this.receiveItem} onCloseChildWindow={this.unsetIsSelecting} dropMessage={dropMessage} searchURL={searchURL} />
                    : null }
            </React.Fragment>
        );
    }
}


function JobTitleField(props) {
    const { value_for_pending_project, value_for_pending_project_details, schemas } = props;
    const fieldSchema = JobTitleField.getJobTitleSchema(schemas);
    let formControl;

    if (fieldSchema && Array.isArray(fieldSchema.suggested_enum) && fieldSchema.suggested_enum.length > 0){
        formControl = (
            <select name="job_title" defaultValue="null" className="form-control">
                <option hidden disabled value="null"> -- select an option -- </option>
                { _.map(fieldSchema.suggested_enum, function(val){ return <option value={val} key={val}>{ val }</option>; }) }
            </select>
        );
    } else {
        formControl = <input type="text" name="job_title" className="form-control"/>;
    }

    return (
        <Collapse in={!!(value_for_pending_project)}>
            <div className="clearfix">
                <div className="mb-3">
                    <label htmlFor="jobTitle">
                        Job Title
                        { value_for_pending_project_details && value_for_pending_project_details.display_title &&
                        <span className="text-400"> at { value_for_pending_project_details.display_title}</span> }
                        <span className="text-300"> (Optional)</span>
                    </label>
                    { formControl }
                </div>
            </div>
        </Collapse>
    );
}
JobTitleField.getJobTitleSchema = function(schemas){
    return (
        schemas && schemas.User && schemas.User.properties &&
        schemas.User.properties.job_title
    ) || null;
};