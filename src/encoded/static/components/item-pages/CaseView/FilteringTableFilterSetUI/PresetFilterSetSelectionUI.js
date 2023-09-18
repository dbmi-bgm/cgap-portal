
import React, { useState, useMemo, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';

import DropdownButton from "react-bootstrap/esm/DropdownButton";
import DropdownItem from "react-bootstrap/esm/DropdownItem";

import ReactTooltip from 'react-tooltip';

import { console, ajax, JWT } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { LocalizedTime, format as formatDateTime } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/LocalizedTime';
import { CountIndicator } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/FacetList/FacetTermsList';
import { SaveFilterSetPresetButton } from './SaveFilterSetPresetButton';


/**
 * @todo
 * This should be refactored to use load-as-you-scroll at some point,
 * At moment we're limited to showing 200 or so more recent results..
 * possibly less. Consider using react-virtualized or react-window library
 * for this, given that react-infinite is deprecated/defunct...
 * ... or just load in elements for time being ... or add search bar...
 */
export class PresetFilterSetSelectionUI extends React.PureComponent {

    /** Builds a compound search request for all FilterSets with relevant `preset_for_users`, `preset_for_projects`,  & `default_for_projects`  */
    static makeCompoundSearchRequest(caseItem, searchType){
        const { project: { uuid: projectUUID } } = caseItem || {};
        const { uuid: userUUID = null } = JWT.getUserDetails() || {};

        const compoundFS = {
            "search_type": "FilterSet",
            "filter_blocks": [],
            "intersect": false,
            "global_flags": "sort=default_for_projects&sort=-date_created&limit=250&search_type=" + (searchType || "VariantSample")
        };

        if (userUUID) {
            compoundFS.filter_blocks.push({ "query": "preset_for_users=" + encodeURIComponent(userUUID), "flags_applied": [] });
        }

        if (projectUUID) {
            compoundFS.filter_blocks.push({ "query": "preset_for_projects=" + encodeURIComponent(projectUUID), "flags_applied": [] });
            compoundFS.filter_blocks.push({ "query": "default_for_projects=" + encodeURIComponent(projectUUID), "flags_applied": [] });
        }

        return compoundFS;
    }

    constructor(props){
        super(props);
        this.setPatchingPresetResultUUID = this.setPatchingPresetResultUUID.bind(this);
        this.toggleDeletedPresetUUID = this.toggleDeletedPresetUUID.bind(this);
        this.loadInitialResults = _.debounce(this.loadInitialResults.bind(this), 3000);
        this.checkForChangedResultsAndRefresh = this.checkForChangedResultsAndRefresh.bind(this);
        this.state = {
            // Can be blank array (no results found), null (not yet loaded), or array of results.
            "presetResults": null,
            "isLoadingPresets": true,
            // Will contain { requestNumber: true }
            "checkingForNewFilterSetRequests": {},
            // Kept here rather than in PresetFilterSetResult state, to prevent actions on other presets while another is ongoing.
            // Could be removed in future potentially (or moved down) to allow simultaneous edits to multiple FSes.
            "patchingPresetResultUUID": null,
            // Will contain message/tooltip for e.g. if presets list hasn't refreshed within alloted request limit.
            "errorMessage": null,
            // Keep track of deleted-but-not-yet-removed-from-results presets to display them as "muted" temporarily in UI.
            "deletedPresetUUIDs": {}
        };
        this.checkingForNewFilterSetRequestsCounter = 0; // Used to generate unique IDs in `checkForChangedResultsAndRefresh`.

        this.currentInitialResultsRequest = null;
    }

    componentDidMount(){
        this.loadInitialResults();
    }

    // TODO: componentDidUpdate({ pastSession }) { if changed, then reset results & reload (?) }

    componentDidUpdate({ lastSavedPresetFilterSet: pastLastSavedPresetFilterSet }, { isLoadingPresets: lastIsLoadingPresets }){
        const { lastSavedPresetFilterSet } = this.props;
        const { isLoadingPresets } = this.state;

        // Rebuild tooltips after new results loaded.
        if (!isLoadingPresets && lastIsLoadingPresets) {
            ReactTooltip.rebuild();
        }

        // TODO: Wait for indexing to complete, maybe eventually via subscribing to pubsub messages
        // from backend or something. For now, doing this thingy:
        if (pastLastSavedPresetFilterSet !== lastSavedPresetFilterSet) {
            const { uuid: lastSavedPresetUUID } = lastSavedPresetFilterSet;
            this.checkForChangedResultsAndRefresh(`/search/?type=FilterSet&uuid=${lastSavedPresetUUID}&limit=0`);
        }
    }

    setPatchingPresetResultUUID(patchingPresetResultUUID) {
        this.setState({ patchingPresetResultUUID });
    }

    toggleDeletedPresetUUID(presetUUID){
        this.setState(function({ deletedPresetUUIDs: existingIDs }){
            const deletedPresetUUIDs = { ...existingIDs };
            if (deletedPresetUUIDs[presetUUID]) {
                delete deletedPresetUUIDs[presetUUID];
            } else {
                deletedPresetUUIDs[presetUUID] = true;
            }
            return { deletedPresetUUIDs };
        });
    }

    loadInitialResults(){
        const { caseItem, searchType } = this.props;

        if (this.currentInitialResultsRequest) {
            console.log('currentInitialResultsRequest superseded (a)');
        }

        const compoundRequest = PresetFilterSetSelectionUI.makeCompoundSearchRequest(caseItem, searchType);
        const scopedRequest = this.currentInitialResultsRequest = ajax.promise("/compound_search", "POST", {}, JSON.stringify(compoundRequest)).then((res) => {
            const {
                "@graph": presetResults,
                total: totalResultCount
            } = res;

            if (scopedRequest !== this.currentInitialResultsRequest) {
                // Request has been superseded; throw out response and preserve current state.
                console.log('currentInitialResultsRequest superseded (b)');
                return false;
            }

            this.currentInitialResultsRequest = null;

            this.setState({
                presetResults,
                totalResultCount,
                "isLoadingPresets": false
            });
        });
    }

    /**
     * TEMPORARY-ISH
     * @todo We could also disable this polling for now if wanted for simplicity, not really necessary to see it immediately.
     * @todo Eventually change to depend on Redis PubSub server-sent events down the road, rather than polling.
     */
    checkForChangedResultsAndRefresh(
        requestHref,
        conditionCheckFunc = function({ total: totalCountForThisSearch }){ return totalCountForThisSearch > 0; },
        delay = 5000
    ){

        // Arbitrary limit to terminate after, after this we can assume we might've been logged out or something.
        // Not overly consistent/stable, since if there's indexing pile-up it might be an hour until this gets re-indexed..
        const requestLimit = 40;
        let requestCount = 0;
        const uniqueRequestID = this.checkingForNewFilterSetRequestsCounter++;

        const periodicRequestFunc = () => {

            const { checkingForNewFilterSetCount } = this.state;
            if (checkingForNewFilterSetCount === 0) {
                return;
            }

            requestCount++;

            ajax.promise(requestHref).then((res) => {
                if (conditionCheckFunc(res)) {
                    // Edited/added preset has been indexed. Stop checking & re-request our state.presetResults.
                    this.setState(
                        function({ checkingForNewFilterSetRequests: oldRequestsObj }){
                            const checkingForNewFilterSetRequests = { ...oldRequestsObj };
                            delete checkingForNewFilterSetRequests[uniqueRequestID];
                            return {
                                "isLoadingPresets": true,
                                checkingForNewFilterSetRequests
                            };
                        },
                        this.loadInitialResults
                    );
                } else if (requestCount < requestLimit) {
                    // Wait & retry.
                    setTimeout(periodicRequestFunc, delay);
                } else {
                    this.setState(function({ checkingForNewFilterSetRequests: oldRequestsObj }){
                        const checkingForNewFilterSetRequests = { ...oldRequestsObj };
                        delete checkingForNewFilterSetRequests[uniqueRequestID];
                        return {
                            "errorMessage": "Timed out waiting/checking for updated preset results. Please come back later to see your changes.",
                            checkingForNewFilterSetRequests
                        };
                    });
                    console.error("checkForChangedResultsAndRefresh exceeded request limit", requestCount);
                }
            });
        };

        this.setState(
            function({ checkingForNewFilterSetRequests }){
                return { "checkingForNewFilterSetRequests": { ...checkingForNewFilterSetRequests, [uniqueRequestID]: true } };
            },
            ()=>{
                setTimeout(periodicRequestFunc, delay);
            }
        );
    }

    render(){
        const {
            importFromPresetFilterSet,
            caseItem,
            isEditDisabled,
            hasCurrentFilterSetChanged,
            isFetchingInitialFilterSetItem,
            currentCaseFilterSet,
            originalPresetFilterSet,
            lastSavedPresetFilterSet,
            hasFilterSetChangedFromOriginalPreset,
            hasFilterSetChangedFromLastSavedPreset,
            isOriginalPresetFilterSetLoading,
            refreshOriginalPresetFilterSet,
            setLastSavedPresetFilterSet
        } = this.props;
        const {
            isLoadingPresets,
            presetResults,
            totalResultCount,
            patchingPresetResultUUID,
            checkingForNewFilterSetRequests,
            errorMessage = null,
            deletedPresetUUIDs
        } = this.state;

        let body = null;

        const savePresetDropdownProps = {
            filterSet: currentCaseFilterSet,
            caseItem,
            isEditDisabled,
            originalPresetFilterSet,
            hasFilterSetChangedFromOriginalPreset,
            hasFilterSetChangedFromLastSavedPreset,
            lastSavedPresetFilterSet,
            isOriginalPresetFilterSetLoading,
            setLastSavedPresetFilterSet,
        };

        const savePresetDropdownCls = "btn btn-outline-primary-dark btn-sm text-truncate w-100";
        const btnInner = <div><i className="icon icon-plus-circle fas mr-05" /> Create Preset from Current FilterSet</div>;
        const createPresetBtn = (
            <div className={`p-2 bg-white ${ isLoadingPresets || !presetResults || !presetResults.length ? "": "border-bottom"}`}>
                <SaveFilterSetPresetButton {...savePresetDropdownProps} {...{ btnInner }} btnCls={savePresetDropdownCls} />
            </div>);

        if (!presetResults || presetResults.length === 0){
            if (isLoadingPresets) {
                // Only show loading indicator in body for lack of initial results.
                body = (
                    <div className="text-center text-large py-4 text-muted">
                        <i className="icon icon-spin icon-2x icon-circle-notch fas"/>
                    </div>
                );
            } else {
                body = (
                    <div>
                        <div className="py-4 px-3 bg-white border-bottom">
                            <h4 className="my-0 text-400">
                                No presets saved yet
                            </h4>
                            <p>
                                Create a FilterSet and then click <em>Create Preset</em> to generate a preset for your case.
                            </p>
                        </div>
                        { createPresetBtn }
                    </div>
                );
            }
        } else if (presetResults) {

            // TODO wrap results in infinite scroll of some sort later on,
            // once figure out strategy for replacing or removing the
            // deprecated react-infinite library.

            const commonProps = {
                caseItem, importFromPresetFilterSet, patchingPresetResultUUID,
                isEditDisabled, hasCurrentFilterSetChanged,
                hasFilterSetChangedFromOriginalPreset, isOriginalPresetFilterSetLoading, refreshOriginalPresetFilterSet,
                "setPatchingPresetResultUUID": this.setPatchingPresetResultUUID,
                "toggleDeletedPresetUUID": this.toggleDeletedPresetUUID,
                "checkForChangedResultsAndRefresh": this.checkForChangedResultsAndRefresh
            };
            const { derived_from_preset_filterset: currentCaseDerivedFromPresetUUID = null } = currentCaseFilterSet || {};
            body = (
                <div className="results-container">
                    { presetResults.map(function(presetFilterSet, idx){
                        const { uuid: thisPresetFSUUID } = presetFilterSet;
                        const isOriginOfCurrentCaseFilterSet = currentCaseDerivedFromPresetUUID === thisPresetFSUUID;
                        const isDeleted = deletedPresetUUIDs[thisPresetFSUUID];
                        return <PresetFilterSetResult {...commonProps} {...{ presetFilterSet, isOriginOfCurrentCaseFilterSet, isDeleted }} key={thisPresetFSUUID}  />;
                    }) }
                </div>
            );
        }

        const isCheckingForNewFilterSet = Object.keys(checkingForNewFilterSetRequests).length > 0;


        let nextToTitleIcon = null;
        if (errorMessage) {
            nextToTitleIcon = (
                <i className="icon icon-exclamation-triangle fas ml-05 text-small" data-tip={errorMessage} data-html />

            );
        } else if (isCheckingForNewFilterSet || isLoadingPresets) {
            nextToTitleIcon = (
                <i className="icon icon-circle-notch icon-spin fas ml-07 text-small text-muted" data-tip="Preset(s) below have been updated but this is not yet reflected." data-html />
            );
        }

        return (
            <div className="filterset-preset-selection-body h-100">
                <div className="results-heading my-0 py-2 px-2 bg-light">
                    <div className="row align-items-center">
                        <h5 className="col text-400 my-0">
                            <i className="icon icon-copy far mr-08"/>
                            <a href="/search/?type=FilterSet" className="text-body" target="_blank" data-delay-show={1000} data-tip="View all saved FilterSets">Presets</a>
                            { nextToTitleIcon }
                        </h5>
                        { !isCheckingForNewFilterSet && !isLoadingPresets ?
                            <div className="col-auto text-small">
                                { totalResultCount } total
                                { (totalResultCount || 0) >= 250 ?
                                    <i className="icon icon-exclamation-triangle fas ml-1" data-tip="Showing most recent 250 results only.<br/><small>(Eventually we'll show more)</small>" data-html />
                                    : null }
                            </div>
                            : null }
                    </div>
                </div>
                { !isLoadingPresets && presetResults && presetResults.length > 0 ? createPresetBtn: null }
                { body }
            </div>
        );
    }
}



const PresetFilterSetResult = React.memo(function PresetFilterSetResult (props) {
    const {
        presetFilterSet,
        caseItem,
        importFromPresetFilterSet,
        isEditDisabled,
        hasCurrentFilterSetChanged,
        hasFilterSetChangedFromOriginalPreset,
        isOriginalPresetFilterSetLoading,
        refreshOriginalPresetFilterSet,
        isOriginOfCurrentCaseFilterSet,
        patchingPresetResultUUID, setPatchingPresetResultUUID,
        checkForChangedResultsAndRefresh,
        isDeleted, toggleDeletedPresetUUID
    } = props;
    const {
        "@id": presetFSID,
        uuid: presetFSUUID,
        "display_title": presetFSTitle,
        "submitted_by": presetFSAuthor,
        date_created,
        filter_blocks = [],
        actions = []
    } = presetFilterSet;

    const { display_title: presetFSAuthorTitle } = presetFSAuthor;
    const presetFBLen = filter_blocks.length;
    const isCurrentCaseFilterSetUnchanged = isOriginOfCurrentCaseFilterSet && (isOriginalPresetFilterSetLoading || !hasFilterSetChangedFromOriginalPreset);


    // We need to AJAX in the ItemView for this FS to determine if have permission to edit or not.
    const [ loadedItemView, setLoadedItemView ] = useState(null);
    const [ isLoadingItemView, setIsLoadingItemView ] = useState(false);

    const isPatchingPreset = patchingPresetResultUUID === presetFSUUID;

    // Separate from import (view) permission (which is implictly allowed for all presets here, else wouldnt have been returned from /search/?type=FilterSet request)
    const havePresetFSEditPermission = !!(loadedItemView && _.findWhere(loadedItemView.actions || [], { "name": "edit" }));


    // If in uneditable state (no save permissions, duplicate blocks, etc) then don't warn.
    // Don't warn if unchanged from saved Case FS or if from a preset but hasn't changed from preset.
    const warnBeforeImport = (!isEditDisabled && hasCurrentFilterSetChanged && !isOriginalPresetFilterSetLoading && hasFilterSetChangedFromOriginalPreset);

    const importBtnDisabled = isCurrentCaseFilterSetUnchanged || isDeleted; // || isOriginalPresetFilterSetLoading;




    const { userProjectUUID, isPresetForUser, isPresetForProject, isDefaultForProject } = useMemo(function(){
        //const { project: { uuid: projectUUID } } = caseItem || {};
        const {
            preset_for_users = [],
            preset_for_projects = [],
            default_for_projects = []
        } = presetFilterSet;
        // We keep this within useMemo b.c. we assume is invisible if logged out.
        // TODO: reconsider, or use props.session.
        const {
            uuid: userUUID = null,
            project: userProjectUUID
        } = JWT.getUserDetails() || {}; // ( internally calls JSON.parse(localStorage..) ) -- good to memoize
        return {
            userProjectUUID,
            "isPresetForUser": userUUID && preset_for_users.indexOf(userUUID) > -1,
            "isPresetForProject": userProjectUUID && preset_for_projects.indexOf(userProjectUUID) > -1,
            "isDefaultForProject":  userProjectUUID && default_for_projects.indexOf(userProjectUUID) > -1
        };
    }, [ presetFilterSet, caseItem ]);



    const onSelectPresetFilterSet = useCallback(function(e){
        e.preventDefault();
        e.stopPropagation();

        if (warnBeforeImport) {
            const confResult = window.confirm("You have unsaved changes in your Case FilterSet; copying over blocks from this preset will destroy and overwrite them, continue?");
            if (!confResult) {
                return false;
            }
        }

        importFromPresetFilterSet(presetFilterSet);

    }, [ presetFilterSet, importFromPresetFilterSet, warnBeforeImport ]);


    const onMenuClick = useCallback(function(e){
        // Should run only once to load in loadedItemView.
        if (isLoadingItemView) return false;
        if (loadedItemView !== null) return false;
        setIsLoadingItemView(true);
        ajax.promise(presetFSID).then((res)=>{
            setLoadedItemView(res);
        }).finally(()=>{
            setIsLoadingItemView(false);
        });
    }, [ presetFilterSet, loadedItemView, isLoadingItemView ]);


    const menuOptions = [];

    if (isLoadingItemView) {
        menuOptions.push(
            <div className="px-2 py-3 text-larger text-secondary text-center" key="loading">
                <i className="icon icon-circle-notch icon-spin fas"/>
            </div>
        );
    } else {
        menuOptions.push(
            <a key="view" href={presetFSID} target="_blank" rel="noopener noreferrer" className="dropdown-item">
                <i className="icon icon-fw icon-file-alt far mr-12" />
                View Details
            </a>
        );

        if (havePresetFSEditPermission) {

            // We use user's project UUID for this --
            // People may browse Core Project and want to make it preset for their own
            // projects instead, though.

            menuOptions.push(
                <a key="edit" href={presetFSID + "?currentAction=edit"} target="_blank" rel="noopener noreferrer" className="dropdown-item">
                    <i className="icon icon-fw icon-pencil-alt fas mr-12" />
                    Edit
                </a>
            );

            menuOptions.push(
                <DropdownItem key="delete" eventKey="delete">
                    <i className="icon icon-fw icon-times fas mr-12" />
                    Delete
                </DropdownItem>
            );

            if (userProjectUUID && !isPresetForProject) {
                // TODO make sure userProjectUUID not already in FS's `preset_for_projects` before showing or enabling
                menuOptions.push(
                    <DropdownItem key="set-project-preset" eventKey="set-project-preset">
                        <i className="icon icon-fw icon-user-friends fas mr-12" />
                        Set as preset for my project
                    </DropdownItem>
                );
            }
        }

    }


    const onMenuOptionSelect = useCallback(function(eventKey, e){

        e.preventDefault();
        e.stopPropagation();

        if (patchingPresetResultUUID !== null) {
            // Prevent multiple requests/actions from occuring at once.
            return false;
        }

        if (eventKey === "delete") {
            // PATCH status:deleted
            setPatchingPresetResultUUID(presetFSUUID);
            ajax.promise(presetFSID, "PATCH", {}, JSON.stringify({ "status" : "deleted" }))
                .then(function(resp){
                    console.info("PATCHed FilterSet", presetFSID);
                    toggleDeletedPresetUUID(presetFSUUID); // Temporarily (until ES results refreshed) show result as dimmed to indicate it's been deleted in Postgres.
                    if (isOriginOfCurrentCaseFilterSet) {
                        // Make sure we have the new status available in originalPresetFilterSet upstream so that 'Save as Preset' button becomes functional.
                        // Uses datastore=database so should be up-to-date by time this is called.
                        refreshOriginalPresetFilterSet();
                    }
                    checkForChangedResultsAndRefresh(
                        `/search/?type=FilterSet&status=deleted&uuid=${presetFSUUID}&limit=1`,
                        function(searchResponse){
                            const { "@graph": [ patchedFSFromSearch ] = [] } = searchResponse;
                            const { status: statusFromSearch } = patchedFSFromSearch || {};
                            return statusFromSearch === "deleted";
                        },
                        5000,
                        function(){
                            // Cleanup/remove presetFSUUID from higher-level state to free up memory.
                            toggleDeletedPresetUUID(presetFSUUID);
                        }
                    );
                })
                .finally(function(){
                    // TODO - error handling?
                    setPatchingPresetResultUUID(null);
                });
            return;
        }

        if (eventKey === "set-project-preset") {
            setPatchingPresetResultUUID(presetFSUUID);
            const { "preset_for_projects": listOfProjectsPresetFor = [] } = loadedItemView;
            // We assume this doesn't already have userProjectUUID, else option for 'set-project-preset' wouldn't be
            // rendered/available.
            ajax.promise(presetFSID, "PATCH", {}, JSON.stringify({ "preset_for_projects": listOfProjectsPresetFor.concat([userProjectUUID]), "status": "in review" }))
                .then(function(resp){
                    console.info("PATCHed FilterSet", presetFSID);
                    checkForChangedResultsAndRefresh(
                        `/search/?type=FilterSet&uuid=${presetFSUUID}&limit=1`,
                        function(searchResponse){
                            const { "@graph": [ patchedFSFromSearch ] = [] } = searchResponse;
                            const { preset_for_projects: presetForProjectsFromSearch = [] } = patchedFSFromSearch || {};
                            return presetForProjectsFromSearch.indexOf(userProjectUUID) > -1;
                        }
                    );
                })
                .finally(function(){
                    // TODO - error handling?
                    setPatchingPresetResultUUID(null);
                });
            return;
        }

        return false;
    }, [ presetFilterSet, isOriginOfCurrentCaseFilterSet, loadedItemView, patchingPresetResultUUID === null ]);


    const presetIconsToShow = (
        <React.Fragment>
            { isPresetForProject ?
                <i className="mr-05 icon icon-fw icon-user-friends fas text-secondary" data-tip="Project preset" />
                : null }
            { isPresetForUser ?
                <i className="mr-05 icon icon-fw icon-user fas text-muted" data-tip="User preset" />
                : null }
            { isDefaultForProject ?
                <i className="mr-05 icon icon-fw icon-star fas text-secondary" data-tip="Project default" />
                : null }
        </React.Fragment>
    );

    return (
        // These should all have same exact height.
        // And then that height later on will be plugged
        // into (new replacement for) react-infinite rowHeight.
        <div className="preset-filterset-result" data-id={presetFSID}
            data-is-origin-of-current-case-filterset={isOriginOfCurrentCaseFilterSet}
            data-is-current-case-filterset-unchanged={isCurrentCaseFilterSetUnchanged}
            data-has-been-deleted={isDeleted}>
            <div className="title pl-12 pr-08">
                <h5 className="my-0 text-600 flex-grow-1 text-truncate" title={presetFSTitle}>
                    { presetFSTitle }
                </h5>
            </div>
            <div className="info pl-12 pr-08 text-small pb-04">

                <DropdownButton variant="default btn-dropdown-icon mr-05" size="xs" disabled={!!(patchingPresetResultUUID || isDeleted)}
                    onClick={onMenuClick} onSelect={onMenuOptionSelect}
                    title={
                        <i className={"icon text-secondary fas icon-fw icon-" + (isPatchingPreset ? "circle-notch icon-spin" : "ellipsis-v")} data-tip="View actions"/>
                    }>
                    { menuOptions }
                </DropdownButton>

                { presetIconsToShow }

                <span data-tip={"Created " + formatDateTime(date_created, "date-time-md") + " by " + presetFSAuthorTitle} data-delay-show={750}>
                    <LocalizedTime timestamp={date_created} formatType="date-sm" />
                </span>

                <span className="flex-grow-1 count-indicator-wrapper ml-07 text-right">
                    <CountIndicator count={presetFBLen} data-tip={"Contains " + presetFBLen + " filter blocks"}
                        height={18} />
                </span>

                <div className="pl-08 flex-shrink-0 title-icon-container">
                    <button type="button" className="import-preset-btn btn btn-sm btn-outline-primary-dark"
                        onClick={importBtnDisabled ? null : onSelectPresetFilterSet} disabled={importBtnDisabled}
                        data-tip={
                            importBtnDisabled ? null // Button disabled, effectively
                                : isOriginOfCurrentCaseFilterSet ? "Reset current case FilterSet blocks to original ones from this preset"
                                    : "Copy filter blocks to current Case FilterSet"
                        }>
                        <i className="icon icon-file-export icon-fw fas" />
                    </button>

                </div>

            </div>
        </div>
    );
});
