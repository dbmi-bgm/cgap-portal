'use strict';

import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import _ from 'underscore';
import url from 'url';
import queryString from 'query-string';

import Dropdown from 'react-bootstrap/esm/Dropdown';
import DropdownButton from 'react-bootstrap/esm/DropdownButton';
import DropdownItem from 'react-bootstrap/esm/DropdownItem';

import { console, ajax, JWT, searchFilters } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Checkbox } from '@hms-dbmi-bgm/shared-portal-components/es/components/forms/components/Checkbox';
import { Term } from './../../util/Schemas';
import { responsiveGridState } from './../../util/layout';

import { EmbeddedCaseSearchTable } from './../../item-pages/components/EmbeddedItemSearchTable';
import ReactTooltip from 'react-tooltip';


export const UserDashboard = React.memo(function UserDashboard({ windowHeight, windowWidth }){
    // const { schemas } = props;
    // We can turn container into container-wide to expand width
    // We can convert dashboard-header into tabs, similar to Item pages.
    // We can do novel stuff like sidebar menu or something.
    // Various options.

    // Since UserDashboard visible, we assume user is logged in.
    // We use email as unique component key for components
    // which need to make AJAX requests. This way we can just
    // re-initialize component upon 'Impersonate User' action
    // insteat of handling w. componentDidUpdate or similar.
    // const { uuid: userUUID = null } = JWT.getUserDetails() || {};

    return (
        <React.Fragment>

            <div className="dashboard-header">
                <div className="container-wide d-flex align-items-center">
                    <i className="icon icon-fw icon-home fas mr-1" />
                    <h5 className="mt-0 mb-0 text-400">Home Dashboard</h5>
                </div>
            </div>

            {/* We apply .bg-light class here instead of .container-wide child divs because home-dashboard-area height is calculated off of window height in stylesheet */}
            <div className="home-dashboard-area bg-light" id="content">
                <RecentCasesTable {...{ windowHeight, windowWidth }} />
            </div>
        </React.Fragment>
    );
});


const RecentCasesTable = React.memo(function RecentCasesTable({ windowHeight, windowWidth }){
    const searchHref = (
        "/search/?type=Case"
        + "&report.uuid!=No+value"
        + "&proband_case=true"
        + "&status!=inactive"
        + "&sort=-last_modified.date_modified"
    );
    const maxHeight = typeof windowHeight === "number" ?
        (
            windowHeight
            - (80 + 46 + 78 + 52 + 20 + 50) // Sum of all footer/header elem heights & margins (excl. checkboxes)
            - (responsiveGridState(windowWidth) !== "xs" ? 53 : 106) // Height of checkboxes
        )
        : 400;
    return (
        <div className="recent-cases-table-section mb-36">
            <EmbeddedCaseSearchTable {...{ searchHref, maxHeight }} facets={null} aboveTableComponent={<AboveCasesTableOptions />} />
        </div>
    );
});

function AboveCasesTableOptions(props){
    const { context, onFilter, isContextLoading, navigate } = props;
    const { filters: ctxFilters = null } = context || {};

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

            <div className="container-wide py-0 bg-white">
                <div className="tab-section-title flex-wrap">

                    <div className="d-flex align-items-center">
                        <h3 className="text-400 my-0 d-none d-sm-block">
                            Recent Cases&nbsp;
                            <span className="text-300">from&nbsp;</span>
                        </h3>
                        <div className="px-1">
                            <ProjectSelectDropdown {...{ context, onFilter, isContextLoading, navigate }} />
                        </div>
                    </div>

                    <DropdownButton variant="primary d-flex align-items-center" id="submit-new" className="px-1"
                        title={<React.Fragment><i className="icon fas icon-plus mr-1"/>Submit New...</React.Fragment>}>
                        <Dropdown.Item href="/search/?type=IngestionSubmission&currentAction=add">
                            Case(s)
                        </Dropdown.Item>
                        <Dropdown.Item href="/search/?type=IngestionSubmission&currentAction=add&submissionType=Family History">
                            Family History
                        </Dropdown.Item>
                        <Dropdown.Item href="/search/?type=IngestionSubmission&currentAction=add&submissionType=Gene List">
                            Gene List(s)
                        </Dropdown.Item>
                    </DropdownButton>

                </div>
            </div>

            <hr className="tab-section-title-horiz-divider"/>

            <div className="container-wide toggle-reports row align-items-center py-2">
                <div className="col-12 col-md-4 col-lg-3 py-2">
                    <SearchBar {...{ isContextLoading, context, navigate }} />
                </div>
                <div className="d-none d-md-block col-md">
                    &nbsp;
                </div>
                <div className="col-12 col-sm-auto">
                    <ProjectFilterCheckbox isContextLoading={isContextLoading || !context} onChange={onToggleOnlyShowCasesWithReports} checked={onlyShowCasesWithReports}>
                        Show Only Cases with Reports
                    </ProjectFilterCheckbox>
                </div>
                <div className="col-12 col-sm-auto">
                    <ProjectFilterCheckbox isContextLoading={isContextLoading || !context} onChange={onToggleOnlyShowProbandCases} checked={onlyShowProbandCases}>
                        Show Only Proband Cases
                    </ProjectFilterCheckbox>
                </div>
            </div>
        </React.Fragment>
    );
}


class ProjectFilterCheckbox extends React.PureComponent {

    constructor(props){
        super(props);
        this.onChange = _.throttle(this.onChange.bind(this), 500, { trailing: false });
        this.state = { "isChanging": false };
    }

    componentDidUpdate({ isContextLoading: pastLoading }){
        const { isContextLoading } = this.props;
        if (!isContextLoading && pastLoading) {
            this.setState({ "isChanging" : false });
        }
    }

    onChange(e){
        e.stopPropagation();
        const { onChange } = this.props;
        this.setState({ "isChanging": true }, () => {
            onChange();
        });
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
            <DropdownItem eventKey={0} active={!projectFilterTerm}>
                <span className="text-600">All Projects</span>
            </DropdownItem>
            { renderedOptions }
        </DropdownButton>
    );

}

function SearchBar (props) {
    const {
        context: searchContext,
        isContextLoading,
        navigate: virtualNavigate
    } = props;
    // This should be present & accurate on search response as long as is not compound filterset
    // search with 2+ filterblocks used.
    const { "@id": currentSearchHref } = searchContext || {};

    const currentSearchParts = useMemo(function(){
        if (!currentSearchHref) {
            return null;
        }
        return url.parse(currentSearchHref, true);
    }, [ searchContext ]);

    const { query: currentSearchQuery } = currentSearchParts || {};
    const { q: currentSearchTextQuery = "" } = currentSearchQuery || {};

    const [ value, setValue ] = useState(currentSearchTextQuery);
    const [ isChanging, setIsChanging ] = useState(false);
    const searchInputRef = useRef(null);

    const isValueChanged = value !== currentSearchTextQuery;

    if (!isContextLoading && isChanging) {
        // Unset isChanging if finished loading.
        // Calling set value inside func body is equivalent to
        // getDerivedStateFromProps (avoids additional re-render).
        setIsChanging(false);
    }

    const onChange = useCallback(function(e){
        e.stopPropagation();
        e.preventDefault();
        setValue(searchInputRef.current.value);
    });

    const onSubmit = useCallback(function(e){
        e.stopPropagation();
        e.preventDefault();
        const nextQuery = { ...currentSearchQuery };
        // Using value from ref instead of 'value' for slight perf
        // (avoid re-instantiating this onSubmit func each render)
        const nextValue = searchInputRef.current.value || "";
        if (!isValueChanged) {
            return false;
        }
        setIsChanging(true);
        if (nextValue) {
            nextQuery.q = nextValue;
        } else {
            delete nextQuery.q;
        }
        const nextSearchParts = {
            ...currentSearchParts,
            "search": "?" + queryString.stringify(nextQuery)
        };
        virtualNavigate(url.format(nextSearchParts));
    }, [ virtualNavigate, currentSearchParts, isValueChanged ]);

    const valueLen = value.length;
    const isValid = valueLen === 0 || valueLen > 1;

    const toggleTooltip = useMemo(function(){
        return _.debounce(function(hide = false){
            if (hide){
                ReactTooltip.hide();
            } else {
                ReactTooltip.show(searchInputRef.current);
            }
        }, 300, false);
    });

    useEffect(function(){
        setTimeout(toggleTooltip, 50, isValid);
    }, [ isValid ]);

    const iconCls = (
        "icon icon-fw align-middle fas"
        + (" icon-" + (isChanging ? "circle-notch icon-spin" : "search"))
        + (" text-" + (!isValid ? "danger" : isValueChanged ? "dark" : "secondary"))
    );

    return (
        <form onSubmit={onSubmit} className="mb-0 d-flex align-items-center" role="search">
            <input type="search" placeholder="Search Cases..." aria-label="Search"
                spellCheck={false} name="q" className={"form-control" + (!isValid ? " is-invalid" : "")}
                data-tip="Search term must have at least 2 characters"
                data-tip-disable={isValid} data-type="error" disabled={!currentSearchHref}
                {...{ onChange, value }} ref={searchInputRef} />
            <button type="submit" className="bg-transparent border-0 px-2 py-1" disabled={!isValid || isChanging || isContextLoading || !isValueChanged}>
                <i className={iconCls}/>
            </button>
        </form>
    );
}
