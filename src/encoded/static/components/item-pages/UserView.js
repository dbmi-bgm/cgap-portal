/** @preventMunge */
/* ^ see http://stackoverflow.com/questions/30110437/leading-underscore-transpiled-wrong-with-es6-classes */

'use strict';

import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import Modal from 'react-bootstrap/esm/Modal';

import { console, object, JWT, ajax, navigate } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { LocalizedTime } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/LocalizedTime';
import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';
import { EditableField, FieldSet } from '@hms-dbmi-bgm/shared-portal-components/es/components/forms/components/EditableField';

import { store } from './../../store';
import { OnlyTitle, PageTitleContainer, pageTitleViews } from './../PageTitleSection';

// eslint-disable-next-line no-unused-vars
import { Item } from './../util/typedefs';


/**
 * Contains the User profile page view as well as Impersonate User form.
 * Only the User view is exported.
 *
 * @module item-pages/user
 */


/**
 * Component which fetches, saves, and show access keys that user may use to submit
 * experiments and other data.
 *
 * @memberof module:item-pages/user
 * @namespace
 * @type {Component}
 * @private
 */
class SyncedAccessKeyTable extends React.PureComponent {

    static propTypes = {
        'access_keys' : PropTypes.array,
        'user' : PropTypes.shape({
            '@id' : PropTypes.string.isRequired,
            'uuid' : PropTypes.string.isRequired,
            'email' : PropTypes.string,
            'first_name' : PropTypes.string,
            'last_name' : PropTypes.string,
            'groups' : PropTypes.array,
            'status' : PropTypes.string,
            'timezone' : PropTypes.string,
            'role' : PropTypes.string,
            'submits_for' : PropTypes.array
        })
    };

    static loadStatusMap = {
        'loading' : 1,
        'loaded' : 2,
        'failed' : 3
    };

    constructor(props){
        super(props);
        _.bindAll(this, 'syncAccessKeysFromSearch', 'handleCreate', 'handleResetSecret',
            'showNewSecret', 'handleDelete', 'hideModal');

        this.state = {
            'access_keys'   : null,
            'loadingStatus' : SyncedAccessKeyTable.loadStatusMap.loading,
            'modal'         : null
        };
    }

    componentDidMount(){
        this.syncAccessKeysFromSearch();
    }

    syncAccessKeysFromSearch(){
        const { user } = this.props;
        const { loadingStatus } = this.state;
        if (!user || !user.uuid || !object.isUUID(user.uuid)){
            throw new Error("No user, or invalid user.uuid supplied.");
        }

        const requestSucceeded = (resp) => {
            // Use for both load success+fail ajax callback in case of 404 (no results)
            if (!resp || !Array.isArray(resp['@graph'])){
                this.setState({
                    'loadingStatus' : SyncedAccessKeyTable.loadStatusMap.failed,
                    'access_keys' : null
                });
            }
            this.setState({
                'loadingStatus' : SyncedAccessKeyTable.loadStatusMap.loaded,
                'access_keys' : resp['@graph']
            });
        };

        const loadFxn = () => {
            const hrefToRequest = '/search/?type=AccessKey&limit=500&user.uuid=' + user.uuid;
            ajax.load(hrefToRequest, requestSucceeded, 'GET', requestSucceeded);
        };

        if (loadingStatus !== SyncedAccessKeyTable.loadStatusMap.loading){
            this.setState({ 'loadingStatus' : SyncedAccessKeyTable.loadStatusMap.loading }, loadFxn);
        } else {
            loadFxn();
        }
    }


    /**
     * Add new access key for user via AJAX.
     *
     * @param {MouseEvent} e - Click event.
     */
    handleCreate(e) {
        const item = {};
        const idToken = JWT.get();
        if (idToken){
            const decoded = JWT.decode(idToken);
            item.user = decoded.email.toLowerCase();
        } else {
            console.warn("Access key aborted");
            return;
        }

        ajax.load('/access-keys/', (resp)=>{
            const [ newKey ] = resp['@graph'];
            this.setState(function({ access_keys : prevKeys }){
                const nextKeys = prevKeys.slice(0);
                nextKeys.unshift(newKey); // Add to start of list.
                return { 'access_keys' : nextKeys };
            }, () => {
                this.showNewSecret(resp);
            });
        }, 'POST', (err)=>{
            Alerts.queue({
                'title'     : "Adding access key failed",
                "message"   : "Check your internet connection or if you have been logged out due to expired session.",
                "style"     : 'danger'
            });
        }, JSON.stringify(item));
    }

    showNewSecret(response, reset = false) {
        const { secret_access_key, access_key_id } = response;
        this.setState({ 'modal' : (
            <Modal show onHide={this.hideModal}>
                <Modal.Header closeButton>
                    <Modal.Title>Your secret key has been {reset ? "reset" : "created" }</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p className="text-center text-600">
                        Please make a note of the new secret access key.
                        <br/>
                        This is the last time you will be able to view it.
                    </p>

                    <div className="row mt-15">
                        <div className="col-4 text-600 text-right no-user-select">
                            Access Key ID
                        </div>
                        <div className="col-8">
                            <code>{ access_key_id }</code>
                        </div>
                    </div>
                    <div className="row mt-05">
                        <div className="col-4 text-600 text-right no-user-select">
                            Secret Access Key
                        </div>
                        <div className="col-8">
                            <code>{ secret_access_key }</code>
                        </div>
                    </div>
                </Modal.Body>
            </Modal>
        ) });
    }

    /**** Methods which are CALLED BY ITEMSTORE VIA DISPATCH(); TODO: Refactor, more Reactful ****/

    handleResetSecret(id) {
        ajax.load(id + 'reset-secret', (resp)=>{
            this.showNewSecret(resp, true);
        }, 'POST', (err)=>{
            Alerts.queue({
                'title'     : "Resetting access key failed",
                "message"   : "Check your internet connection or if you have been logged out due to expired session.",
                "style"     : 'danger'
            });
        });
    }

    handleDelete(accessKeyToDelete) {
        const dispatch_body = { 'status': 'deleted' };
        const { accession, uuid, '@id' : accessKeyID } = accessKeyToDelete;
        if (accession){
            dispatch_body.accession = accession;
        }
        if (uuid){
            dispatch_body.uuid = uuid;
        }
        ajax.load(accessKeyID + '?render=false', (resp)=>{
            this.setState(({ access_keys : prevKeys }) => {
                const foundItemIdx = _.findIndex(prevKeys, function({ '@id' : existingKeyID }){
                    return existingKeyID === accessKeyID;
                });
                if (typeof foundItemIdx !== 'number' || foundItemIdx === -1){
                    throw new Error("Couldn't find deleted key - " + accessKeyID);
                }
                const foundItem = prevKeys[foundItemIdx];
                const nextKeys = prevKeys.slice(0);
                nextKeys.splice(foundItemIdx, 1);
                return {
                    'access_keys' : nextKeys,
                    'modal' : (
                        <Modal show onHide={this.hideModal}>
                            <Modal.Header closeButton>
                                <Modal.Title className="text-400">Access key <span className="text-monospace">{ foundItem.access_key_id }</span> has been deleted.</Modal.Title>
                            </Modal.Header>
                        </Modal>
                    )
                };
            });
        }, "PATCH", function(){
            Alerts.queue({
                'title'     : "Deleting access key failed",
                "message"   : "Check your internet connection or if you have been logged out due to expired session.",
                "style"     : 'danger'
            });
        }, JSON.stringify(dispatch_body));
    }

    hideModal() {
        this.setState({ 'modal' : null });
    }

    render() {
        const { access_keys, loadingStatus, modal } = this.state;

        if (!Array.isArray(access_keys)){
            if (loadingStatus === SyncedAccessKeyTable.loadStatusMap.loading){
                return (
                    <AccessKeyTableContainer>
                        <div className="text-center pt-3 pb-3">
                            <i className="icon icon-2x icon-fw icon-circle-notch fas icon-spin text-secondary"/>
                        </div>
                    </AccessKeyTableContainer>
                );
            } else if (loadingStatus === SyncedAccessKeyTable.loadStatusMap.failed){
                return (
                    <AccessKeyTableContainer>
                        <div className="text-center pt-3 pb-3">
                            <i className="icon icon-2x icon-fw icon-times fas text-danger"/>
                            <h4 className="text-400">Failed to load Access Keys</h4>
                        </div>
                    </AccessKeyTableContainer>
                );
            } else if (loadingStatus === SyncedAccessKeyTable.loadStatusMap.loaded){
                return (
                    <AccessKeyTableContainer>
                        <div className="text-center pt-3 pb-3">
                            <i className="icon icon-2x icon-fw icon-times fas text-danger" />
                            <h4 className="text-400">Unknown Error</h4>
                        </div>
                    </AccessKeyTableContainer>
                );
            }
        }

        return (
            <AccessKeyTableContainer bodyClassName="card-body px-0 pt-0">
                <AccessKeyTable accessKeys={access_keys} onResetSecret={this.handleResetSecret} onDelete={this.handleDelete} />
                <div className="px-3 pt-16">
                    <button type="button" id="add-access-key" className="btn btn-success" onClick={this.handleCreate}>Add Access Key</button>
                </div>
                { modal }
            </AccessKeyTableContainer>
        );
    }
}

function AccessKeyTableContainer({ children, bodyClassName="card-body" }){
    return (
        <div className="access-keys-container card mt-36">
            <div className="card-header">
                <h3 className="text-300">
                    <i className="icon icon-fw icon-unlock fas mr-12" />
                    Access Keys
                </h3>
            </div>
            <div className={bodyClassName}>
                { children }
            </div>
        </div>
    );
}

const AccessKeyTable = React.memo(function AccessKeyTable({ accessKeys, onDelete, onResetSecret }){

    if (typeof accessKeys === 'undefined' || !accessKeys.length){
        return (
            <div className="no-access-keys">
                <hr/><span>No access keys set.</span>
            </div>
        );
    }

    return (
        <table className="table access-keys-table bg-white">
            <thead>
                <tr>
                    <th>Access Key ID</th>
                    <th>Created</th>
                    <th>Description</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                { accessKeys.map(function(accessKey, idx){
                    return <AccessKeyTableRow {...{ onDelete, onResetSecret, accessKey, idx }} key={idx} />;
                }) }
            </tbody>
        </table>
    );
});

const AccessKeyTableRow = React.memo(function AccessKeyTableRow({ accessKey, idx, onResetSecret, onDelete }){
    const {
        '@id': atId,
        access_key_id: id,
        date_created,
        description,
        uuid
    } = accessKey;

    function resetKey(e){ onResetSecret(atId); }
    function deleteKey(e){ onDelete({ '@id' : atId, uuid }); }

    return (
        <tr key={id || idx}>
            <td className="access-key-id">{ id }</td>
            <td>{ date_created ? <LocalizedTime timestamp={date_created} formatType="date-time-md" dateTimeSeparator=" - " /> : 'N/A' }</td>
            <td>{ description }</td>
            <td className="access-key-buttons">
                <button type="button" className="btn btn-xs btn-success" onClick={resetKey}>Reset</button>
                <button type="button" className="btn btn-xs btn-danger" onClick={deleteKey}>Delete</button>
            </td>
        </tr>
    );
});



/**
 * Draws a User Profile page.
 *
 * @public
 * @type {Component}
 * @prop {Object} context - Context value for user, e.g. from Redux store. AKA user object.
 * @prop {Object} schemas - Object of schemas, e.g. passed from app state.
 * @memberof module:item-pages/user
 */

export default class UserView extends React.Component {

    static onEditableFieldSave(nextContext){
        store.dispatch({
            type: { 'context': nextContext }
        });
    }

    static propTypes = {
        'context' : PropTypes.shape({
            '@id' : PropTypes.string.isRequired,
            'email' : PropTypes.string,
            'first_name' : PropTypes.string,
            'last_name' : PropTypes.string,
            'title' : PropTypes.string,
            'groups' : PropTypes.array,
            'lab' : PropTypes.object,
            'status' : PropTypes.string,
            'timezone' : PropTypes.string,
            'role' : PropTypes.string
        }),
        'href' : PropTypes.string.isRequired,
        'schemas' : PropTypes.shape({
            'User' : PropTypes.shape({
                'required' : PropTypes.array,
                'properties' : PropTypes.shape({
                    'first_name' : PropTypes.object,
                    'last_name' : PropTypes.object,
                    'email' : PropTypes.object,
                    'phone1' : PropTypes.object,
                    'fax' : PropTypes.object,
                    'skype' : PropTypes.object,
                    // etc.
                })
            })
        })
    };

    mayEdit(){
        const { context } = this.props;
        return _.any((context && context.actions) || [], function(action){
            return action.name && action.name === 'edit';
        });
    }

    render() {
        const { context : user, schemas, href, windowWidth } = this.props;
        const { email, project } = user;
        const mayEdit = this.mayEdit();
        // Todo: remove
        const ifCurrentlyEditingClass = this.state && this.state.currentlyEditing ? ' editing editable-fields-container' : '';

        return (
            <div className="user-profile-page container-wide bg-light py-5 border-top">

                <div className="container" id="content">

                    <div className={"page-container data-display" + ifCurrentlyEditingClass}>

                        <div className="row">

                            <div className="col-12 col-lg-6 col-xl-7 mb-2 mb-lg-0">

                                <div className="user-info card h-100">
                                    <div className="card-header">
                                        <div className="row title-row align-items-center py-2">
                                            <div className="col-md-3 gravatar-container">
                                                { object.itemUtil.User.gravatar(email, 70) }
                                                <a className="edit-button-remote text-center" target="_blank" rel="noopener noreferrer" href="https://gravatar.com">
                                                    <i className="icon icon-pencil-alt fas"/>
                                                </a>
                                            </div>
                                            <div className="col-md-9 user-title-col">
                                                <h1 className="user-title">
                                                    <FieldSet context={user} parent={this} style="inline"
                                                        inputSize="lg" absoluteBox objectType="User" onSave={UserView.onEditableFieldSave}
                                                        schemas={schemas} disabled={!mayEdit} href={href} windowWidth={windowWidth}>
                                                        <EditableField labelID="first_name" fallbackText="No first name set"
                                                            placeholder="First name" />
                                                        {' '}
                                                        <EditableField labelID="last_name" fallbackText="No last name set"
                                                            placeholder="Last name" />
                                                    </FieldSet>
                                                </h1>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="card-body">
                                        <ProfileContactFields user={user} parent={this} mayEdit={mayEdit} href={href} />
                                    </div>
                                </div>

                            </div>
                            <div className="col-12 col-lg-6 col-xl-5">
                                <ProfileWorkFields user={user} />
                            </div>

                        </div>

                        <SyncedAccessKeyTable {...{ user }} />

                    </div>

                </div>

            </div>
        );
    }

}


/**
 * Renders out the contact fields for user, which are editable.
 * Shows Gravatar and User's first and last name at top.
 *
 * @private
 * @type {Component}
 */
function ProfileContactFields(props){
    const { user, windowWidth, parent, mayEdit, href, schemas } = props;
    const { email, phone1, fax, skype } = user;
    return (
        <FieldSet context={user} onSave={UserView.onEditableFieldSave}
            parent={parent} className="profile-contact-fields"
            disabled={!mayEdit} objectType="User" windowWidth={windowWidth}
            schemas={schemas} href={href}>

            <EditableField label="Email" labelID="email" placeholder="name@example.com" fallbackText="No email address" fieldType="email" disabled={true}>
                <ProfileContactFieldsIcon icon="envelope far" />&nbsp; <a href={'mailto:' + email}>{ email }</a>
            </EditableField>

            <EditableField label="Phone" labelID="phone1" placeholder="17775551234 x47" fallbackText="No phone number" fieldType="phone">
                <ProfileContactFieldsIcon icon="phone fas" />&nbsp; { phone1 }
            </EditableField>

            <EditableField label="Fax" labelID="fax" placeholder="17775554321" fallbackText="No fax number" fieldType="phone">
                <ProfileContactFieldsIcon icon="fax fas" />&nbsp; { fax }
            </EditableField>

            <EditableField label="Skype" labelID="skype" fallbackText="No skype ID" fieldType="username">
                <ProfileContactFieldsIcon icon="skype fab" />&nbsp; { skype }
            </EditableField>

        </FieldSet>
    );
}

function ProfileContactFieldsIcon({ icon }){
    return <i className={"visible-lg-inline icon icon-fw icon-" + icon }/>;
}







function ProfileWorkFields({ user }){
    return null;
    return (
        <div className="card h-100">
            <div className="card-header">
                <h3 className="text-300 block-title">
                    <i className="icon icon-users fas icon-fw mr-12" />
                    Organizations
                </h3>
            </div>
            <div className="card-body">
                <div className="row field-entry lab">
                    <div className="col-md-3 text-left text-md-right">
                        <label htmlFor="lab">Primary Lab</label>
                    </div>
                    <div id="lab" className="col-md-9 value text-500">
                        { labTitle }
                    </div>
                </div>
                <div className="row field-entry role">
                    <div className="col-md-3 text-left text-md-right">
                        <label htmlFor="role">Role</label>
                    </div>
                    <div id="role" className="col-md-9 value">
                        { role || <span className="not-set">No Job Title</span> }
                    </div>
                </div>
            </div>
        </div>
    );
}


/**
 * Renders out the lab and awards fields for user, which are not editable.
 * Uses AJAX to fetch details for fields which are not embedded.
 *
 * @private
 * @type {Component}
 */

class ProfileWorkFields2 extends React.PureComponent {

    /**
    * Get list of all awards (unique) from list of labs.
    * ToDo : Migrate somewhere more static-cy.
    *
    * @param {Item[]} labDetails - Array of lab objects with embedded award details.
    * @return {Item[]} List of all unique awards in labs.
    */
    static getAwardsList(labDetails){

        if (!labDetails || !Array.isArray(labDetails) || labDetails.length === 0){
            return [];
        }

        // Awards are embedded within labs, so we get full details.
        var awardsList = [];

        function addAwardToList(award){
            if (!award || typeof award['@id'] !== 'string' || _.pluck(awardsList, '@id').indexOf(award['@id']) > -1) return;
            awardsList.push(award);
        }

        _.forEach(labDetails, function(lab){
            if (!lab || !lab.awards || !Array.isArray(lab.awards) || lab.awards.length === 0) return;
            _.forEach(lab.awards, addAwardToList);
        });

        return awardsList;
    }

    constructor(props){
        super(props);
        this.updateAwardsList = this.updateAwardsList.bind(this);
        this.render = this.render.bind(this);
        this.state = {
            'awards_list' : []
        };

        if (props.user && props.user.lab && props.user.lab.awards){
            this.state.awards_list = props.user.lab.awards.slice(0);
        }
    }

    /**
     * Update state.awards_list with award details from list of lab details.
     *
     * @param {Item[]} labDetails - Array of lab objects with embedded award details.
     * @returns {void} Nothing.
     */
    updateAwardsList(labDetails){

        if (!labDetails || !Array.isArray(labDetails) || labDetails.length === 0){
            return;
        }

        this.setState(function({ awards_list = [] }){
            // As of React 16 we can return null in setState func to cancel out of state update.
            const nextAwardsList      = awards_list.slice(0);
            const nextAwardsListIDs   = new Set(_.map(nextAwardsList, object.atIdFromObject));
            const newAwards           = ProfileWorkFields.getAwardsList(labDetails);

            for (var i = 0; i < newAwards.length; i++){
                const award   = newAwards[i];
                const awardID = award && object.atIdFromObject(award);
                if (!awardID) continue; // Error ?
                if (!nextAwardsListIDs.has(awardID)) nextAwardsList.push(award);
            }

            if (nextAwardsList.length > (awards_list || []).length){
                return { 'awards_list' : nextAwardsList };
            } else {
                return null;
            }

        });
    }


    render(){
        const { user, containerClassName } = this.props;
        const { submits_for = [], lab, pending_lab, role } = user;
        const { awards_list: awards } = this.state;

        let labTitle = <span className="not-set">No Labs</span>;
        const pendingLabText = "Will be verified in the next few business days"; // Default

        if (lab){
            labTitle = object.itemUtil.generateLink(lab);
        } else if (pending_lab && object.itemUtil.isAnItem(pending_lab)){
            // Might occur later... currently not embedded.
            labTitle = <span>{ object.itemUtil.generateLink(pending_lab) } <em data-tip={pendingLabText}>(pending)</em></span>;
        } else if (pending_lab && typeof pending_lab === 'string'){
            labTitle = <span className="text-400">{ pendingLabText }</span>;
        }

        // THESE FIELDS ARE NOT EDITABLE.
        // To be modified by admins, potentially w/ exception of 'Primary Lab' (e.g. select from submits_for list).
        return (
            <div className="card h-100">
                <div className="card-header">
                    <h3 className="text-300 block-title">
                        <i className="icon icon-users fas icon-fw mr-12" />
                        Organizations
                    </h3>
                </div>
                <div className="card-body">
                    <div className="row field-entry lab">
                        <div className="col-md-3 text-left text-md-right">
                            <label htmlFor="lab">Primary Lab</label>
                        </div>
                        <div id="lab" className="col-md-9 value text-500">
                            { labTitle }
                        </div>
                    </div>
                    <div className="row field-entry role">
                        <div className="col-md-3 text-left text-md-right">
                            <label htmlFor="role">Role</label>
                        </div>
                        <div id="role" className="col-md-9 value">
                            { role || <span className="not-set">No Job Title</span> }
                        </div>
                    </div>
                    {/*
                    <div className="row field-entry submits_for">
                        <div className="col-md-3 text-left text-md-right">
                            <label htmlFor="submits_for">Submits For</label>
                        </div>
                        <div className="col-md-9 value text-500">
                            <FormattedInfoBlock.List
                                renderItem={object.itemUtil.generateLink}
                                endpoints={_.filter(_.map(submits_for, object.itemUtil.atId))}
                                propertyName="submits_for"
                                fallbackMsg="Not submitting for any organizations"
                                ajaxCallback={this.updateAwardsList}
                            />
                        </div>
                    </div>
                    <div className="row field-entry awards">
                        <div className="col-md-3 text-left text-md-right">
                            <label htmlFor="awards">Awards</label>
                        </div>
                        <div className="col-md-9 value text-500">
                            <FormattedInfoBlock.List
                                details={awards}
                                renderItem={object.linkFromItem}
                                propertyName="awards"
                                fallbackMsg="No awards"
                                loading={false}
                            />
                        </div>
                    </div>
                    */}
                </div>
            </div>
        );
    }

}


export function ImpersonateUserForm({ updateUserInfo }) {

    /**
     * Handler for Impersonate User submit button/action.
     * Performs AJAX request to '/impersonate-user' endpoint then saves returned JWT
     * as own and in order to pretend to be impersonated user.
     *
     * @param {Object} data - User ID or email address.
     */
    const onSubmit = useMemo(function(){
        return function(e){
            e.preventDefault();
            const { value: userid = "" } = e.target;
            if (userid.length === 0){
                return;
            }
            const url = "/impersonate-user";
            const postData = { 'userid' : userid };
            const callbackFxn = (resp) => {
                //if(typeof(Storage) !== 'undefined'){ // check if localStorage supported
                //    localStorage.setItem("user_info", JSON.stringify(payload));
                //}
                JWT.saveUserInfo(resp);
                updateUserInfo();
                let navTarget = "/";
                const profileAction = resp.user_actions && _.find(resp.user_actions, { 'id' : 'profile' });
                if (profileAction && profileAction.href){
                    navTarget = profileAction.href;
                }
                navigate(navTarget, { 'inPlace' : true });
                alert('Success! ' + userid + ' is being impersonated.');
            };
            const fallbackFxn = function() {
                alert('Impersonation unsuccessful.\nPlease check to make sure the provided email is correct.');
            };

            //var userInfo = localStorage.getItem('user_info') || null;
            //var idToken = userInfo ? JSON.parse(userInfo).id_token : null;
            //var reqHeaders = {'Accept': 'application/json'};
            //if(userInfo){
            //    reqHeaders['Authorization'] = 'Bearer '+idToken;
            //}
            ajax.load(url, callbackFxn, 'POST', fallbackFxn, JSON.stringify(postData));
        };
    }, [ updateUserInfo ]);

    return (
        <div className="mt-3 container" id="content">
            <h2 className="text-400 mt-5">Impersonate a User</h2>
            <div className="row">
                <div className="col-12 col-lg-6">
                    <form onSubmit={onSubmit}>
                        <input type="text" className="mt-08 form-control" placeholder="Enter an email to impersonate..." />
                        <button type="submit" className="btn btn-primary btn-md mt-15">
                            <i className="icon icon-fw icon-user icon-user-ninja fas"/>&nbsp; Impersonate
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}



/*** Page Title ***/


const UserViewPageTitle = React.memo(function UserViewPageTitle({ context, schemas, currentAction, alerts }){
    const myDetails = JWT.getUserDetails();
    const myEmail = myDetails && myDetails.email;
    let titleStr;
    if (myEmail && context && context.email && myEmail === context.email){
        titleStr = "My Profile";
    } else {
        titleStr = object.itemUtil.getTitleStringFromContext(context);
    }

    return (
        <PageTitleContainer alerts={alerts} className="container pb-55">
            <OnlyTitle>{ titleStr }</OnlyTitle>
        </PageTitleContainer>
    );
});

pageTitleViews.register(UserViewPageTitle, "User");
