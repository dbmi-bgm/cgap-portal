'use strict';

import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import memoize from 'memoize-one';
import { AboveTableControlsBase } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/above-table-controls/AboveTableControlsBase';
import { SearchBar } from './SearchBar';
import Dropdown from 'react-bootstrap/esm/Dropdown';
import DropdownButton from 'react-bootstrap/esm/DropdownButton';
import DropdownItem from 'react-bootstrap/esm/DropdownItem';
import { Term, pluralize } from '../util/Schemas';
import { Checkbox } from '@hms-dbmi-bgm/shared-portal-components/es/components/forms/components/Checkbox';


/** Adjusts the right buttons for more CGAP-specific theming */
export function AboveTableControlsBaseCGAP (props) {
    const {
        context, // search context
        children: propChildren,
        navigate,
        isContextLoading = false // Present only on embedded search views
    } = props;
    const panelMap = AboveTableControlsBase.getCustomColumnSelectorPanelMapDefinition(props);
    panelMap.multiColumnSort.body = React.cloneElement(panelMap.multiColumnSort.body, { "size": "sm", "variant": "outline-dark" });

    //const { context, currentAction, isFullscreen, windowWidth, toggleFullScreen, sortBy } = props;
    const { total: totalResultCount = 0 } = context || {};

    let children = propChildren;
    // Default, if nothing else supplied.
    if (!children) {
        children = (
            <React.Fragment>
                <div className="col-12 col-md-4">
                    <SearchBar {...{ isContextLoading, context, navigate }} />
                </div>
                <div className="col-12 col-md">
                    <span className="text-400" id="results-count">
                        { totalResultCount }
                    </span> Results
                </div>
            </React.Fragment>
        );
    }

    return <AboveTableControlsBase {...props} {...{ children, panelMap }} />;
}

export const AboveSearchViewOptions = React.memo(function AboveSearchViewOptions(props) {
    const {
        itemType, projectSelectEnabled,
        context, schemas,
        isContextLoading = false, // Present only on embedded search views
        navigate, onFilter,
        sortBy, sortColumns,
        hiddenColumns, addHiddenColumn, removeHiddenColumn, columnDefinitions
    } = props || {};

    const { total: totalResultCount = 0 } = context || {};
    return(
        <React.Fragment>
            <SearchViewSubTitle {...{ itemType }} {...{ schemas, context, onFilter, isContextLoading, navigate, projectSelectEnabled }}
                submitNewButton={<a href={`/search/?type=${itemType}&currentAction=add`} className="btn btn-primary"><i className="icon icon-plus fas icon-small mr-05"></i>Create New</a>} />
            <hr className="tab-section-title-horiz-divider"/>
            <div className="container-wide toggle-reports">

                <AboveTableControlsBaseCGAP {...{ hiddenColumns, addHiddenColumn, removeHiddenColumn, columnDefinitions, sortBy, sortColumns }}>
                    <div className="col-12 col-lg-4 py-2">
                        <SearchBar {...{ isContextLoading, context, navigate }} />
                    </div>
                    <div className="col-12 col-md">
                        <span className="text-400" id="results-count">
                            { totalResultCount }
                        </span> Results
                    </div>
                    <div className="d-none d-md-block col">
                        &nbsp;
                    </div>
                </AboveTableControlsBaseCGAP>

            </div>
        </React.Fragment>
    );
});

export const AboveCaseSearchViewOptions = React.memo(function AboveCaseSearchViewOptions(props){
    const {
        context, projectSelectEnabled,
        onFilter, schemas,
        isContextLoading = false, // Present only on embedded search views,
        navigate,
        sortBy, sortColumns,
        hiddenColumns, addHiddenColumn, removeHiddenColumn, columnDefinitions
    } = props;
    const { filters: ctxFilters = null, total: totalResultCount = 0 } = context || {};

    const { onlyShowCasesWithReports, onlyShowProbandCases } = useMemo(function(){
        return {
            onlyShowCasesWithReports: ctxFilters === null ? true : !!(_.findWhere(ctxFilters, { "field" : "report.uuid!", "term" : "No value" })),
            onlyShowProbandCases: ctxFilters === null ? true : !!(_.findWhere(ctxFilters, { "field" : "proband_case", "term" : "true" }))
        };
    }, [ ctxFilters ]);

    const { onToggleOnlyShowCasesWithReports, onToggleOnlyShowProbandCases } = useMemo(function(){
        return {
            onToggleOnlyShowCasesWithReports: function(){ onFilter({ "field" : "report.uuid!" }, { "key": "No value" }); },
            onToggleOnlyShowProbandCases: function(){ onFilter({ "field" : "proband_case" }, { "key": "true" }); }
        };
    }, []);

    return (
        <React.Fragment>
            <SearchViewSubTitle itemType="Case" {...{ schemas, context, onFilter, isContextLoading, navigate, projectSelectEnabled }} submitNewButton={<CaseSearchViewSubmitNewButton />} />
            <hr className="tab-section-title-horiz-divider"/>
            <div className="container-wide toggle-reports">

                <AboveTableControlsBaseCGAP {...{ hiddenColumns, addHiddenColumn, removeHiddenColumn, columnDefinitions, sortBy, sortColumns }}>
                    <div className="col-12 col-lg-4 py-2">
                        <SearchBar {...{ isContextLoading, context, navigate }} />
                    </div>
                    <div className="col-12 col-md">
                        <span className="text-400" id="results-count">
                            { totalResultCount }
                        </span> Results
                    </div>
                    <div className="d-none d-md-block col">
                        &nbsp;
                    </div>
                    <div className="col-12 col-md-auto">
                        <ProjectFilterCheckbox embedded={false} isContextLoading={isContextLoading || !context} onChange={onToggleOnlyShowCasesWithReports} checked={onlyShowCasesWithReports}>
                            Show Only Cases with Reports
                        </ProjectFilterCheckbox>
                    </div>
                    <div className="col-12 col-md-auto pb-08 pb-md-0">
                        <ProjectFilterCheckbox embedded={false} isContextLoading={isContextLoading || !context} onChange={onToggleOnlyShowProbandCases} checked={onlyShowProbandCases}>
                            Show Only Proband Cases
                        </ProjectFilterCheckbox>
                    </div>
                </AboveTableControlsBaseCGAP>

            </div>
        </React.Fragment>
    );
});

const CaseSearchViewSubmitNewButton = React.memo(function CaseSearchViewSubmitNewButton(props) {
    return (
        <DropdownButton variant="primary d-flex align-items-center" id="submit-new" className="px-1"
            title={<React.Fragment><i className="icon fas icon-plus mr-1"/>Submit New...</React.Fragment>}>
            <Dropdown.Item href="/search/?type=IngestionSubmission&currentAction=add">
                Case
            </Dropdown.Item>
            <Dropdown.Item href="/search/?type=IngestionSubmission&currentAction=add&submissionType=Family History">
                Family History
            </Dropdown.Item>
            <Dropdown.Item href="/search/?type=IngestionSubmission&currentAction=add&submissionType=Gene List">
                Gene List
            </Dropdown.Item>
        </DropdownButton>
    );
});


export const SearchViewSubTitle = React.memo(function SearchViewSubTitle(props) {
    const { schemas, itemType, projectSelectEnabled = false, submitNewButton = null, context, onFilter, isContextLoading, navigate } = props;

    const pluralizedItemType = itemType ? pluralize(itemType) : "";

    return (
        <div className="container-wide py-0 bg-white">
            <div className="tab-section-title flex-wrap">
                <div className="d-flex align-items-center">
                    <h3 className="text-400 my-0 d-none d-sm-block">
                        Browse {pluralizedItemType}&nbsp;
                        {projectSelectEnabled && <span className="text-300">from&nbsp;</span>}
                    </h3>
                    {projectSelectEnabled &&
                        <div className="px-1">
                            <ProjectSelectDropdown embedded={true} {...{ schemas, context, onFilter, isContextLoading, navigate }} />
                        </div>}
                </div>
                { submitNewButton }
            </div>
        </div>
    );
});

class ProjectFilterCheckbox extends React.PureComponent {

    constructor(props){
        super(props);
        this.onChange = _.throttle(this.onChange.bind(this), 500, { trailing: false });

        // State is really only used if used within embedded search table
        this.state = { "isChanging": false };
    }

    componentDidUpdate({ isContextLoading: pastLoading }){
        const { isContextLoading } = this.props;
        console.log("isContextLoading", isContextLoading, pastLoading);
        if (!isContextLoading && pastLoading) {
            this.setState({ "isChanging" : false });
        }
    }

    onChange(e){
        const { onChange, embedded } = this.props;

        e.stopPropagation();

        if (!embedded) { // Just do the change without triggering "load" state in SearchView
            onChange();
        } else { // Trigger load state
            this.setState({ "isChanging": true }, () => {
                onChange();
            });
        }
    }

    render(){
        const { isContextLoading, checked, children } = this.props;
        const { isChanging } = this.state;
        const labelCls = "mb-0 px-2 py-1" + (isChanging ? " is-changing" : "");
        return (
            <Checkbox disabled={isContextLoading} onChange={this.onChange} checked={checked} labelClassName={labelCls}>
                <span className="text-small">
                    { isChanging ? <i className="icon icon-circle-notch icon-spin fas mr-07 text-small" /> : null }
                    { children }
                </span>
            </Checkbox>
        );
    }
}


function ProjectSelectDropdown(props){
    const {
        schemas,
        context: searchContext,
        navigate: virtualNavigate,
        onFilter,
        isContextLoading = false,
        className
    } = props;
    const {
        facets: ctxFacets = [],
        filters: ctxFilters,
        "@id": ctxHref
    } = searchContext || {};

    const { projectFacet, projectFilter } = useMemo(function(){
        return {
            projectFacet: _.findWhere(ctxFacets, { "field" : "project.display_title" }) || null,
            projectFilter: _.findWhere(ctxFilters, { "field" : "project.display_title" }) || null
        };
    }, [ searchContext ]);

    const { term: projectFilterTerm = null } = projectFilter || {};
    const { terms: facetTerms = [] } = projectFacet || {};

    const onTermSelect = useCallback(function(evtKey, e){
        console.log("selecting term, evtKey", evtKey);
        e.preventDefault();
        if (!evtKey) {
            if (projectFilter) {
                // Un-toggle
                onFilter(projectFacet, { key: projectFilter.term });
            }
        } else {
            if (!projectFilter || evtKey === projectFilterTerm) {
                // Single toggle request
                onFilter(projectFacet, { key: evtKey });
                return;
            }

            let updatedFilters = searchFilters.contextFiltersToExpSetFilters(ctxFilters, { "type" : true });
            // Unset existing first, then set new project filter, then perform virtual nav request.
            updatedFilters = searchFilters.changeFilter("project.display_title", projectFilterTerm, updatedFilters, null, true);
            updatedFilters = searchFilters.changeFilter("project.display_title", evtKey, updatedFilters, null, true);
            const updatedSearchHref = searchFilters.filtersToHref(updatedFilters, ctxHref, null, false, null);
            virtualNavigate(updatedSearchHref);
        }
    }, [ onFilter, projectFilter, projectFacet ]);

    const renderedOptions = useMemo(function(){
        let options = null;
        if (!isContextLoading) {
            options = facetTerms.sort(function({ key: a, doc_count: aDC }, { key: b, doc_count: bDC }){
                if (a === "CGAP Core") return -1;
                if (b === "CGAP Core") return 1;
                return bDC - aDC;
            }).map(function(projectTermObj){
                const { key: projectTerm, doc_count } = projectTermObj;
                const active = projectTerm === projectFilterTerm;
                return (
                    <DropdownItem key={projectTerm} eventKey={projectTerm} active={active}>
                        { Term.toName("project.display_title", projectTerm) }
                        <small className="ml-07">({ doc_count })</small>
                    </DropdownItem>
                );
            });
        }
        return options;
    }, [ isContextLoading, facetTerms ]);

    return (
        <DropdownButton disabled={isContextLoading || facetTerms.length === 0}
            title={projectFilterTerm || "All Projects"} onSelect={onTermSelect}
            variant="outline-dark" className={className}>
            <DropdownItem eventKey={null} active={!projectFilterTerm}>
                <span className="text-600">All Projects</span>
            </DropdownItem>
            { renderedOptions }
        </DropdownButton>
    );
}

const itemTypeToIconMap = memoize(function (itemType) {
    switch(itemType) {
        case "AccessKey":
            return "key fas";
        case "Analysis":
        case "CohortAnalysis":
            return "project-diagram fas";
        case "Case":
            return "archive fas";
        case "Disorder":
        case "Phenotype":
            return "x-ray fas";
        case "Document":
        case "File":
        case "FileFormat":
            return "file fas";
        case "Family":
            return "users fas";
        case "FilterSet":
            return "filter fas";
        case "Gene":
        case "GeneList":
        case "StructuralVariant":
        case "StructuralVariantSample":
        case "Variant":
        case "VariantSample":
            return "dna fas";
        case "Image":
            return "file-image fas";
        case "IngestionSubmission":
            return "file-medical-alt fas";
        case "Institution":
            return "hospital-alt fas";
        case "Individual":
            return "user-injured fas";
        case "Note":
            return "file-medical fas";
        case "Page":
        case "StaticSection":
            return "file-code fas";
        case "Project":
            return "briefcase fas";
        case "QualityMetric":
            return "tasks fas";
        case "Report":
            return "briefcase-medical fas";
        case "Sample":
            return "vial fas";
        case "Software":
            return "laptop-code fas";
        case "SomaticAnalysis":
            return "spinner fas";
        case "User":
            return "user fas";
        case "WorkflowRun":
        case "Workflow":
            return "network-wired fas";
        default:
            return "search fas";
    }
});

export const DashboardTitle = React.memo(function DashboardTitle(props){
    const { subtitle } = props;
    return (
        <div className="dashboard-header">
            <div className="container-wide d-flex align-items-center justify-content-between">
                <div className="align-items-center d-flex">
                    <i className={`icon icon-fw icon-${itemTypeToIconMap(subtitle)} mr-1`} />
                    <h5 className="mt-0 mb-0 text-400">{subtitle} Dashboard</h5>
                </div>
            </div>
        </div>
    );
});
