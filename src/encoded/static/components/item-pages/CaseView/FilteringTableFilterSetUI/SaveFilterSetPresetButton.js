'use strict';

import React from 'react';
import _ from 'underscore';
import memoize from 'memoize-one';
import Modal from 'react-bootstrap/esm/Modal';
import { console, ajax, JWT, valueTransforms } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';

import { SaveFilterSetButtonController, filterSetFieldsToKeepPrePatch } from './SaveFilterSetButton';




/**
 * Stores & loads originalPresetFilterSet, keeps track of lastSavedPresetFilterSet.
 * Useful for informing confirm dialogs (or lack of) & disabling things, outside of
 * the SaveFilterSetPresetButton.
 */
export class SaveFilterSetPresetButtonController extends React.Component {

    constructor(props){
        super(props);
        this.setLastSavedPresetFilterSet = this.setLastSavedPresetFilterSet.bind(this);
        this.getDerivedFromFilterSetIfPresent = this.getDerivedFromFilterSetIfPresent.bind(this);

        this.state = {
            "originalPresetFilterSet": null,
            "isOriginalPresetFilterSetLoading": false,
            // Stored after POSTing new FilterSet to allow to prevent immediate re-submits.
            "lastSavedPresetFilterSet": null
        };

        this.memoized = {
            hasFilterSetChangedFromOriginalPreset: memoize(function(arg1, arg2){
                return SaveFilterSetButtonController.hasFilterSetChanged(arg1, arg2, ["filter_blocks"]);
            }),
            hasFilterSetChangedFromLastSavedPreset: memoize(function(arg1, arg2){
                return SaveFilterSetButtonController.hasFilterSetChanged(arg1, arg2, ["filter_blocks"]);
            })
        };

        this.currentOriginalDerivedFromPresetFilterSetRequest = null;
    }

    /**
     * If `filterSet.derived_from_preset_filterset` exists,
     * grab & save it to compare against.
     */
    componentDidMount(){
        this.getDerivedFromFilterSetIfPresent();
    }

    componentDidUpdate({ currFilterSet: pastFilterSet }){
        const { currFilterSet: currentFilterSet } = this.props;
        const { derived_from_preset_filterset: pastDerivedFrom = null } = pastFilterSet || {};
        const { derived_from_preset_filterset: currentDerivedFrom = null } = currentFilterSet || {};

        if (currentDerivedFrom !== pastDerivedFrom) {
            // If initial filterSet is null (due to being loaded in still), then
            // check+fetch `filterSet.derived_from_preset_filterset` once filterSet
            // gets loaded & passed-in.
            // Also handles if `derived_from_preset_filterset` has changed due to
            // importing a new Preset FS blocks.
            this.getDerivedFromFilterSetIfPresent(true);
        }
    }

    /**
     * Random thought - we could theoretically avoid additional
     * request if selected new preset filterset from result list of presets (containing all necessary data).
     * Needs thought on how to "send" that filterset context to here from there in a clean way; if not clean then
     * probably not worth doing.
     */
    getDerivedFromFilterSetIfPresent(allowFromProp=false){
        const { currFilterSet, originalPresetFilterSetBody } = this.props;
        const { derived_from_preset_filterset = null } = currFilterSet || {};

        console.info("Called `getDerivedFromFilterSetIfPresent`");

        if (derived_from_preset_filterset){ // derived_from_preset_filterset has format 'uuid'

            // First check if props.originalPresetFilterSetBody matched our UUID, and if so, just use that
            // to avoid AJAX request.
            if (allowFromProp) {
                const { uuid: propPriginalPresetFilterSetUUID = null } = originalPresetFilterSetBody || {};
                if (propPriginalPresetFilterSetUUID && propPriginalPresetFilterSetUUID === derived_from_preset_filterset){
                    this.currentOriginalDerivedFromPresetFilterSetRequest = null; // Cancel any existing requests incase any started.
                    this.setState({
                        "originalPresetFilterSet": originalPresetFilterSetBody,
                        "isOriginalPresetFilterSetLoading": false
                    });
                    return;
                }
            }

            this.setState({ "isOriginalPresetFilterSetLoading": true }, () => {

                if (this.currentOriginalDerivedFromPresetFilterSetRequest) {
                    console.log("Aborting previous request", this.currentOriginalDerivedFromPresetFilterSetRequest);
                    this.currentOriginalDerivedFromPresetFilterSetRequest.aborted = true;
                    this.currentOriginalDerivedFromPresetFilterSetRequest.abort();
                }

                const currScopedRequest = this.currentOriginalDerivedFromPresetFilterSetRequest = ajax.load("/filter-sets/" + derived_from_preset_filterset + "/?datastore=database&frame=object", (res)=>{
                    const { "@id" : origPresetFSID } = res;

                    if (currScopedRequest !== this.currentOriginalDerivedFromPresetFilterSetRequest) {
                        // Latest curr request has changed since this currScopedRequest was launched.
                        // Throw out this response
                        console.warn("This request was superseded");
                        return;
                    }

                    this.currentOriginalDerivedFromPresetFilterSetRequest = null;

                    if (!origPresetFSID) {
                        // Some error likely.
                        console.error("Error (a) in getDerivedFromFilterSetIfPresent, likely no view permission", res);
                        this.setState({ "isOriginalPresetFilterSetLoading": false });
                        return;
                    }

                    this.setState({
                        "originalPresetFilterSet": res,
                        "isOriginalPresetFilterSetLoading": false
                    });
                }, "GET", (err)=>{

                    // Don't unset state.isOriginalPresetFilterSetLoading if request was aborted/superceded
                    if (currScopedRequest.aborted === true) {
                        return;
                    }

                    console.error("Error (b) in getDerivedFromFilterSetIfPresent, perhaps no view permission", err);
                    this.setState({ "isOriginalPresetFilterSetLoading": false });
                });
            });
        }
    }

    setLastSavedPresetFilterSet(lastSavedPresetFilterSet, callback = null){
        this.setState({ lastSavedPresetFilterSet }, callback);
    }

    render(){
        const { children, currFilterSet, ...passProps } = this.props;
        const { originalPresetFilterSet, isOriginalPresetFilterSetLoading, lastSavedPresetFilterSet } = this.state;

        const hasFilterSetChangedFromOriginalPreset = this.memoized.hasFilterSetChangedFromOriginalPreset(originalPresetFilterSet, currFilterSet);
        const hasFilterSetChangedFromLastSavedPreset = this.memoized.hasFilterSetChangedFromLastSavedPreset(lastSavedPresetFilterSet, currFilterSet);

        const childProps = {
            ...passProps,
            currFilterSet,
            hasFilterSetChangedFromOriginalPreset,
            hasFilterSetChangedFromLastSavedPreset,
            lastSavedPresetFilterSet,
            originalPresetFilterSet,
            isOriginalPresetFilterSetLoading,
            // Loading of it itself is done in SaveFilterSetPresetButton
            // still, until time comes for that logic to be moved up (if ever (unlikely)).
            setLastSavedPresetFilterSet: this.setLastSavedPresetFilterSet,
            // Passed down to allow PresetFilterSetResult to call it after if the originalPresetFilterSet has been edited.
            refreshOriginalPresetFilterSet: this.getDerivedFromFilterSetIfPresent
        };
        return React.Children.map(children, function(child){
            return React.cloneElement(child, childProps);
        });
    }

}




/**
 * @todo
 * Probably split out a SaveFilterSetPresetController..
 *
 * @todo or defer:
 * Making 'Save As...' btn disabled if unchanged from previous preset.
 * Hard to figure out in good definitive way if changed, esp. if then save new preset.
 */
export class SaveFilterSetPresetButton extends React.Component {

    constructor(props){
        super(props);
        this.onSelectPresetOption = this.onSelectPresetOption.bind(this);
        this.onClickSavePresetButton = this.onClickSavePresetButton.bind(this);
        this.onHideModal = this.onHideModal.bind(this);
        this.onPresetTitleInputChange = this.onPresetTitleInputChange.bind(this);
        this.onPresetFormSubmit = this.onPresetFormSubmit.bind(this);

        this.state = {
            showingModalForEventKey: null,
            presetTitle: "",
            savingStatus: 0 // 0 = not loading; 1 = loading; 2 = load succeeded; -1 = load failed.
        };
    }

    /** @deprecated */
    onSelectPresetOption(eventKey, e) {
        e.stopPropagation();
        e.preventDefault();
        // Save info about clicked option to state (eventKey)
        this.setState({ "showingModalForEventKey": eventKey });
        return;
    }

    onClickSavePresetButton(e) {
        e.stopPropagation();
        e.preventDefault();
        this.setState({ "showingModalForEventKey": "user:preset" });
        return;
    }

    onHideModal(e){
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
        const { savingStatus } = this.state;
        if (savingStatus === 1) {
            // Prevent if in middle of POST request.
            return false;
        }
        this.setState({ "showingModalForEventKey": null, "savingStatus": 0 });
        return false;
    }

    onPresetTitleInputChange(e) {
        this.setState({ "presetTitle": e.target.value });
    }

    /**
     * Copies the current FilterSet and creates new one, with
     * "preset_for_project", "preset_for_user", and/or
     * "default_for_project" fields set accordingly.
     */
    onPresetFormSubmit(e) {
        e.stopPropagation();
        e.preventDefault();

        const { caseItem, filterSet, setLastSavedPresetFilterSet, originalPresetFilterSet } = this.props;
        const { showingModalForEventKey = null, presetTitle } = this.state;
        const {
            project: {
                "@id": caseProjectID,
                uuid: caseProjectUUID
            } = {},
            institution: {
                "@id": caseInstitutionID
            }
        } = caseItem;

        const [ modalOptionItemType = null, modalOptionType = null ] = showingModalForEventKey ? showingModalForEventKey.split(":") : [];

        this.setState({ "savingStatus": 1 }, () => {

            const payload = {
                ..._.omit(
                    // Preserves `derived_from_preset_filterset` also for now.
                    _.pick(filterSet, ...filterSetFieldsToKeepPrePatch),
                    "uuid", // We'll POST this as new FilterSet; delete existing UUID if any.
                    "status" // By omitting 'status', the serverDefault value should be set. Which is "draft" status.
                ),
                "title": presetTitle,
                "institution": caseInstitutionID,
                "project": caseProjectID
            };

            console.log("Submitted Preset Modal Form; modalOptionType, modalOptionItemType ==", modalOptionType, modalOptionItemType);

            // TODO (figure out performant approach for, ideally so can get this info in render/memoized.hasFilterSetChanged):
            // Check previous filtersets in the context (e.g. /search/?type=FilterSet&preset_for_projects=...)
            // and prevent saving if _any_ matches. Kind of difficult given the size of filtersets...

            if (modalOptionType === "preset" && modalOptionItemType === "user") {
                const { uuid: userUUID = null } = JWT.getUserDetails() || {};
                payload.preset_for_users = [ userUUID ];
            } else if (modalOptionType === "preset" && modalOptionItemType === "project") {
                payload.preset_for_projects = [ caseProjectUUID ];
            } else if (modalOptionType === "default" && modalOptionItemType === "project") {
                payload.default_for_projects = [ caseProjectUUID ];
            }

            console.log("Preset FilterSet Payload", payload);

            ajax.promise("/filter-sets/", "POST", {}, JSON.stringify(payload))
                .then((res) => {
                    console.info("Created new Preset FilterSet; response:", res);
                    const { "@graph": [ newPresetFilterSetItem ] } = res;
                    return new Promise((resolve, reject) => {
                        setLastSavedPresetFilterSet(newPresetFilterSetItem, ()=>{
                            this.setState({ "savingStatus": 2, "presetTitle": "" }, ()=>{
                                resolve(newPresetFilterSetItem);
                            });
                        });
                    });
                }).catch((err)=>{
                    // TODO: Add analytics.
                    console.error("Error POSTing new preset FilterSet", err);
                    this.setState({ "savingStatus" : -1 });
                });

        });

        return false;
    }

    render(){
        const {
            btnCls = "btn btn-outline-light btn-sm text-truncate d-flex align-items-center",
            btnInner = <><i className="icon fas icon-plus-circle mr-05" />Create Preset</>,
            caseItem,
            filterSet,
            isEditDisabled,
            lastSavedPresetFilterSet,
            isOriginalPresetFilterSetLoading,
            hasFilterSetChangedFromOriginalPreset,
            hasFilterSetChangedFromLastSavedPreset,
        } = this.props;
        const {
            showingModalForEventKey,
            presetTitle,
            // originalPresetFilterSet,
            // lastSavedPresetFilterSet,
            savingStatus,
            // isOriginalPresetFilterSetLoading
        } = this.state;
        const {
            project: {
                "@id": caseProjectID,
                "display_title": caseProjectTitle
            }
        } = caseItem;

        const {
            title: filterSetTitle = null
        } = filterSet || {}; // May be null while loading initially in FilterSetController

        const disabled = (
            savingStatus !== 0
            || isOriginalPresetFilterSetLoading
            || showingModalForEventKey
            || isEditDisabled
            // TODO: consider disabling if not saved yet?
            // || hasCurrentFilterSetChanged
            || !hasFilterSetChangedFromOriginalPreset
            || !hasFilterSetChangedFromLastSavedPreset
        );

        const [ modalOptionItemType = null, modalOptionType = null ] = showingModalForEventKey ? showingModalForEventKey.split(":") : [];


        // TODO: Put into own component possibly, once split apart FilteringTableFilterSetUI into directory of files.
        let modal = null;
        if (modalOptionItemType) {
            let modalBody = null;
            if (savingStatus === 0) {
                // POST not started
                modalBody = (
                    <form onSubmit={this.onPresetFormSubmit} className="d-block">
                        <label htmlFor="new-preset-fs-id">Preset FilterSet Title</label>
                        <input id="new-preset-fs-id" type="text" placeholder={filterSetTitle + "..."} onChange={this.onPresetTitleInputChange} value={presetTitle} className="form-control mb-1" />
                        <button type="submit" className="btn btn-success" disabled={!presetTitle}>
                            Create
                        </button>
                    </form>
                );
            }
            else if (savingStatus === 1) {
                // Is POSTing
                modalBody = (
                    <div className="text-center py-4 text-larger">
                        <i className="icon icon-spin icon-circle-notch fas mt-1 mb-1" />
                    </div>
                );
            }
            else if (savingStatus === 2) {
                // POST succeeded
                const { title: lastSavedPresetTile, "@id": lastSavedPresetID } = lastSavedPresetFilterSet; // Is in @@object representation
                modalBody = (
                    <div>
                        <h5 className="text-400 my-0">
                            { valueTransforms.capitalize(modalOptionType) } FilterSet Created
                        </h5>
                        <a className="text-600 d-inline-block mb-16" href={lastSavedPresetID} target="_blank" rel="noopener noreferrer">{ lastSavedPresetTile }</a>
                        <p className="mb-16">
                            It may take some time before the preset is visible in list of presets and available for import.
                        </p>
                        <button type="button" className="btn btn-success btn-block"
                            onClick={this.onHideModal} autoFocus>
                            OK
                        </button>
                    </div>
                );
            }
            else if (savingStatus === -1) {
                // POST failed
                modalBody = (
                    <div>
                        <h4 className="text-400 mt-0 mb-16">
                            Failed to create preset FilterSet
                        </h4>
                        <p className="mb-16 mt-0">You may not have permission yet to create new FilterSets. Check back again later or report to developers.</p>
                        <button type="button" className="btn btn-warning btn-block" onClick={this.onHideModal}>
                            Close
                        </button>
                    </div>
                );
            }

            modal = (
                <Modal show onHide={this.onHideModal}>
                    <Modal.Header closeButton>
                        <Modal.Title className="text-400">
                            Creating { modalOptionType } FilterSet for { modalOptionItemType }
                        </Modal.Title>
                    </Modal.Header>
                    <Modal.Body>{ modalBody }</Modal.Body>
                </Modal>
            );
        }

        return (
            <React.Fragment>

                { modal }

                <button className={btnCls} type="button" onClick={disabled ? null : this.onClickSavePresetButton}
                    disabled={disabled} data-tip="Save this FilterSet as a Preset available for all cases in your project">
                    { savingStatus === 1 ? <i className="icon icon-circle-notch icon-spin fas"/> : btnInner }
                </button>

                {/*

                <DropdownButton title={savingStatus === 1 ? <i className="icon icon-circle-notch icon-spin fas"/> : "Save as..."}
                    variant="outline-light" size="sm" onSelect={this.onSelectPresetOption}
                    data-tip="Create copy of this current FilterSet and set it as a preset for..." disabled={disabled}>
                    <DropdownItem data-tip="Create a copy of this current FilterSet and set it as a preset for yourself" eventKey="user:preset">
                        A preset for <span className="text-600">yourself</span> only
                    </DropdownItem>
                    <DropdownItem data-tip="Create a copy of this current FilterSet and set it as a preset for this project" eventKey="project:preset">
                        A preset for project <span className="text-600">{ caseProjectTitle }</span>
                    </DropdownItem>
                    <DropdownItem data-tip="Create a copy of this current FilterSet and set it as the default FilterSet for this project, to be basis for FilterSets of new Cases going forward" eventKey="project:default">
                        Default FilterSet for project <span className="text-600">{ caseProjectTitle }</span>
                    </DropdownItem>
                </DropdownButton>

                */}

            </React.Fragment>
        );
    }

}
