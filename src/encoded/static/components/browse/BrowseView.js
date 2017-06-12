'use strict';

import React from 'react';
import createReactClass from 'create-react-class';
import PropTypes from 'prop-types';
import url from 'url';
import queryString from 'querystring';
import _ from 'underscore';
import * as globals from './../globals';
import { MenuItem, DropdownButton, ButtonToolbar, ButtonGroup, Table, Checkbox, Button, Panel, Collapse } from 'react-bootstrap';
import * as store from './../../store';
import FacetList, { ReduxExpSetFiltersInterface } from './../facetlist';
import ExperimentsTable from './../experiments-table';
import { isServerSide, expFxn, Filters, navigate, object } from './../util';
import { FlexibleDescriptionBox } from './../item-pages/components';
import { PageLimitSortController, SearchResultTable, defaultColumnBlockRenderFxn, extendColumnDefinitions, defaultColumnDefinitionMap } from './components';



export class ExperimentSetDetailPane extends React.Component {

    static propTypes = {
        'expSetFilters' : PropTypes.object.isRequired,
        'selectAllFilesInitially' : PropTypes.bool,
        'result' : PropTypes.object.isRequired,
        'containerWidth' : PropTypes.number.isRequired,
        'additionalDetailFields' : PropTypes.object.isRequired
    }

    static defaultProps = {
        'selectAllFilesInitially' : false,
        'additionalDetailFields' : {
            'Lab': 'lab.title',
            'Treatments':'biosample.treatments_summary',
            'Modifications':'biosample.modifications_summary'
        }
    }

    constructor(props){
        super(props);
        this.componentWillReceiveProps = this.componentWillReceiveProps.bind(this);
        this.pairsAndFiles = this.pairsAndFiles.bind(this);
        this.allFileIDs = this.allFileIDs.bind(this);
        this.handleCheck = this.handleCheck.bind(this);
        this.state = {
            selectedFiles : this.props.selectAllFilesInitially ? new Set(this.allFileIDs(this.props)) : new Set()
        };
    }

    componentWillReceiveProps(nextProps) {
        if(this.props.expSetFilters !== nextProps.expSetFilters){
            this.setState({
                selectedFiles: this.props.selectAllFilesInitially ? new Set(this.allFileIDs()) : new Set()
            });
        }
    }

    /**
     * Combine file pairs and unpaired files into one array. 
     * Length will be file_pairs.length + unpaired_files.length, e.g. files other than first file in a pair are not counted.
     * Can always _.flatten() this or map out first file per pair.
     * 
     * @param {any} [props=this.props] 
     * @returns {Array.<Array>} e.g. [ [filePairEnd1, filePairEnd2], [...], fileUnpaired1, fileUnpaired2, ... ]
     */
    pairsAndFiles(props = this.props){
        return expFxn.listAllFilePairs(props.result.experiments_in_set).concat(
            expFxn.listAllUnpairedFiles(props.result.experiments_in_set)
        );
    }

    allFileIDs(props = this.props){
        return this.pairsAndFiles(props).map(function(f){
            if (Array.isArray(f)) return f[0].uuid;
            else return f.uuid;
        });
    }

    handleCheck(e) {
        var newChecked = e.target.checked;
        var selectedFiles;

        if (newChecked === false){
            selectedFiles = new Set();
        } else {
            selectedFiles = new Set(this.allFileIDs());
        }

        this.setState({
            selectedFiles : selectedFiles
        });
    }

    render(){
        var expSet = this.props.result;
        var addInfo = this.props.additionalDetailFields;


        var files = this.pairsAndFiles();

        var disabled = files.length === 0;
        var allFilesChecked = this.state.selectedFiles.size === files.length && !disabled;
        var indeterminate = this.state.selectedFiles.size > 0 && this.state.selectedFiles.size < files.length;

        return (
            <div className="experiment-set-info-wrapper">
                <div className="expset-addinfo">
                    <div className="row">
                        <div className="col-sm-6 addinfo-description-section">
                            <label className="text-500 description-label">Description</label>
                            <FlexibleDescriptionBox
                                description={ expSet.description }
                                fitTo="self"
                                textClassName="text-medium"
                                dimensions={null}
                            />
                        </div>
                        <div className="col-sm-6 addinfo-properties-section">
                        { _.keys(addInfo).map(function(title){
                            var value = SearchResultTable.sanitizeOutputValue(defaultColumnBlockRenderFxn(expSet, { 'field' : addInfo[title] })); // Uses object.getNestedProperty, pretty prints JSX. Replaces value probe stuff.
                            return (
                                <div key={title}>
                                    <span className="expset-addinfo-key">{ title }:</span>
                                    <span className="expset-addinfo-val">{ value || <small><em>N/A</em></small> }</span>
                                </div>
                            );
                        })}
                        </div>
                    </div>
                </div>
                <ExperimentsTable
                    key='experiments-table'
                    columnHeaders={[
                        { columnClass: 'file-detail', title : 'File Type'},
                        { columnClass: 'file-detail', title : 'File Info'}
                    ]}
                    experimentArray={expSet.experiments_in_set}
                    replicateExpsArray={expSet.replicate_exps}
                    experimentSetType={expSet.experimentset_type}
                    parentController={this}
                    width={this.props.containerWidth - 47 /* account for left padding of pane */}
                    fadeIn={false}
                />
            </div>
        );
    }

}


const browseTableConstantColumnDefinitions = extendColumnDefinitions([
    { 'field' : 'display_title', },
    { 'field' : 'experiments_in_set.experiment_type', },
    { 'field' : 'experiments_in_set', },
    { 'field' : 'lab.display_title', },
    { 'field' : 'date_created',  }
], defaultColumnDefinitionMap);


/**
 * Handles state for Browse results, including page & limit.
 * 
 * @export
 * @class ResultTableContainer
 * @extends {React.Component}
 */
class ResultTableContainer extends React.Component {

    static propTypes = {
        // Props' type validation based on contents of this.props during render.
        href            : PropTypes.string.isRequired,
        context         : PropTypes.object.isRequired,
        expSetFilters   : PropTypes.object.isRequired,
        fileFormats     : PropTypes.array,
        fileStats       : PropTypes.object,
        targetFiles     : PropTypes.instanceOf(Set)
    }

    static defaultProps = {
        'href'      : '/browse/',
        'debug'     : false,
        'columnDefinitionOverrides' : {
            'experiments_in_set.biosample.biosource_summary' : {
                'title' : "Biosource"
            }
        }
    }

    constructor(props){
        super(props);
        this.shouldComponentUpdate = this.shouldComponentUpdate.bind(this);
        this.componentDidUpdate = this.componentDidUpdate.bind(this);
        this.getSelectedFiles = this.getSelectedFiles.bind(this);
        this.isTermSelected = this.isTermSelected.bind(this);
        this.render = this.render.bind(this);
    }

    shouldComponentUpdate(nextProps, nextState){
        if (this.props.context !== nextProps.context) return true;
        if (this.props.page !== nextProps.page) return true;
        if (this.props.limit !== nextProps.limit) return true;
        if (this.props.changingPage !== nextProps.changingPage) return true;
        if (this.props.sortColumn !== nextProps.sortColumn) return true;
        if (this.props.sortReverse !== nextProps.sortReverse) return true;
        if (this.props.searchBase !== nextProps.searchBase) return true;
        if (this.props.schemas !== nextProps.schemas) return true;
        return false;
    }

    componentDidUpdate(pastProps, pastState){
        if (this.props.debug) { 
            console.log('ResultTableContainer updated.');
        }
    }


    getSelectedFiles(){
        if (!this.experimentSetRows) return null;
        return _(this.experimentSetRows).chain()
            .pairs()
            .map(function(expRow){
                return [expRow[0], expRow[1].state.selectedFiles];
            })
            .object()
            .value();
    }

    isTermSelected(termKey, facetField, expsOrSets = 'sets'){
        var standardizedFieldKey = Filters.standardizeFieldKey(facetField, expsOrSets);
        if (
            this.props.expSetFilters[standardizedFieldKey] &&
            this.props.expSetFilters[standardizedFieldKey].has(termKey)
        ){
            return true;
        }
        return false;
    }

    render() {
        var facets = this.props.context.facets;
        var results = this.props.context['@graph'];
        return (
            <div className="row">
                { facets.length > 0 ?
                    <div className="col-sm-5 col-md-4 col-lg-3">
                        <ReduxExpSetFiltersInterface
                            experimentSets={results}
                            expSetFilters={this.props.expSetFilters}
                            facets={facets}
                            href={this.props.href}
                            schemas={this.props.schemas}
                            session={this.props.session}
                        >
                            <FacetList
                                orientation="vertical"
                                browseFilters={{
                                    filters : this.props.context.filters || null,
                                    clear_filters : this.props.context.clear_filters || null
                                }}
                                className="with-header-bg"
                                isTermSelected={this.isTermSelected}
                            />
                        </ReduxExpSetFiltersInterface>
                    </div>
                    :
                    null
                }
                <div className="expset-result-table-fix col-sm-7 col-md-8 col-lg-9">
                    <SearchResultTable
                        results={results}
                        columns={this.props.context.columns || {}}
                        detailPane={ <ExperimentSetDetailPane expSetFilters={this.props.expSetFilters} /> }
                        stickyHeaderTopOffset={-78}
                        constantColumnDefinitions={browseTableConstantColumnDefinitions}
                        hiddenColumns={['experimentset_type']}
                        columnDefinitionOverrideMap={this.props.columnDefinitionOverrides}
                        href={this.props.href}

                        sortBy={this.props.sortBy}
                        sortColumn={this.props.sortColumn}
                        sortReverse={this.props.sortReverse}

                    />
                </div>
            </div>
        );
    }

}



class ControlsAndResults extends React.Component {

    constructor(props){
        super(props);
        this.getSelectedFiles = this.getSelectedFiles.bind(this);
        this.render = this.render.bind(this);
    }

    getSelectedFiles(){
        if (!this.refs.resultTableContainer) return null;
        return this.refs.resultTableContainer.getSelectedFiles();
    }

    render(){
        //var fileStats = this.state.fileStats;
        //var targetFiles = this.state.filesToFind;
        //var selectorButtons = this.props.fileFormats.map(function (format, idx) {
        //    var count = fileStats.formats[format] ? fileStats.formats[format].size : 0;
        //    return(
        //        <FileButton key={format} defaults={targetFiles} fxn={this.selectFiles} format={format} count={count}/>
        //    );
        //}.bind(this));
        // var deselectButton = <Button className="expset-selector-button" bsSize="xsmall">Deselect</Button>;
        var downloadButton = <Button className="expset-selector-button" bsSize="xsmall" onClick={this.downloadFiles}>Download</Button>;
        return(
            <div>

                {/*<div className="row">
                    <div className="box expset-whole-selector col-sm-12 col-md-10 col-lg-9 col-md-push-2 col-lg-push-3">
                        <div className="col-sm-8 col-md-8 col-lg-8 expset-file-selector">
                            <div className="row">
                                <div className="expset-selector-header">
                                    <h5>For all experiments, display files of type:</h5>
                                </div>
                            </div>
                            <div className="row">
                                <ButtonToolbar>{selectorButtons}</ButtonToolbar>
                            </div>
                        </div>
                        <div className="col-sm-3 col-md-3 col-lg-3">
                            <div className="row">
                                <div className="expset-selector-header">
                                    <h5>For all selected files:</h5>
                                </div>
                            </div>
                            <div className="row">
                                <ButtonToolbar>
                                    {downloadButton}
                                </ButtonToolbar>
                            </div>
                        </div>
                    </div>
                </div>*/}

                <PageLimitSortController href={this.props.href} context={this.props.context} navigate={this.props.navigate || navigate}>
                    <ResultTableContainer
                        ref="resultTableContainer"
                        context={this.props.context}
                        expSetFilters={this.props.expSetFilters}
                        session={this.props.session}
                        href={this.props.href}
                        schemas={this.props.schemas}
                    />
                </PageLimitSortController>

            </div>

        );
    }

}



export default class BrowseView extends React.Component {

    static propTypes = {
        'context' : PropTypes.object.isRequired,
        'expSetFilters' : PropTypes.object,
        'session' : PropTypes.bool,
        'schemas' : PropTypes.object,
        'href' : PropTypes.string.isRequired
    }

    shouldComponentUpdate(nextProps, nextState){
        if (this.props.context !== nextProps.context) return true;
        if (this.props.expSetFilters !== nextProps.expSetFilters) return true;
        if (this.props.session !== nextProps.session) return true;
        if (this.props.href !== nextProps.href) return true;
        if (this.props.schemas !== nextProps.schemas) return true;
        return false; // We don't care about props.expIncomplete props (other views might), so we can skip re-render.
    }

    render() {
        //console.log('BROWSE PROPS', this.props);
        var context = this.props.context;
        //var fileFormats = findFormats(context['@graph']);

        // no results found!
        if(context.total === 0 && context.notification){
            return <div className="error-page"><h4>{context.notification}</h4></div>;
        }
        var results = context['@graph'];
        var searchBase = url.parse(this.props.href).search || '';

        // browse is only for experiment sets
        //console.log(this.props.href, this.context.location_href, searchBase);
        if(searchBase.indexOf('?type=ExperimentSetReplicate') === -1){
            return(
                <div className="error-page">
                    <h4>
                        <a href='/browse/?type=ExperimentSetReplicate&experimentset_type=replicate&limit=25&from=0'>
                            Only experiment sets may be browsed.
                        </a>
                    </h4>
                </div>
            );
        }

        return (
            <div className="browse-page-container">

                <h1 className="page-title">Data Browser</h1>
                <h4 className="page-subtitle">Filter & browse experiments</h4>

                <ControlsAndResults
                    {...this.props}
                    //fileFormats={fileFormats}
                    href={this.props.href}
                    schemas={this.props.schemas}
                />

            </div>
        );
    }

}

globals.content_views.register(BrowseView, 'Browse');
