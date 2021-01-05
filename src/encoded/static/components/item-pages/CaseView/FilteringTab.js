'use strict';

import React, { useMemo } from 'react';
import queryString from 'query-string';

import { console, ajax } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { DisplayTitleColumnWrapper } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/table-commons';
import { VirtualHrefController } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/VirtualHrefController';

import { EmbeddedItemSearchTable } from '../components/EmbeddedItemSearchTable';
import { FilteringTableFilterSetUI, FilterSetController } from './FilteringTableFilterSetUI';

const GenesMostSevereHGVSCColumn = React.memo(function GenesMostSevereHGVSCColumn({ hgvsc }){
    // Memoized on the 1 prop it receives which is dependency for its calculation.
    const hgvscSplit = hgvsc.split(":");
    const pSplit = hgvscSplit[1].split(".");
    // Will add hgvsp when added in data/backend
    const rows = [<div className="text-truncate d-block" key="genes_severe_transcript"><span className="text-600">{ pSplit[0] }.</span><span>{ pSplit[1] }</span></div>];
    return <StackedRowColumn rowKey="genes_hgvsc" className="text-center" {...{ rows }} />;
});

function CaseViewEmbeddedVariantSampleSearchTable(props){
    const {
        columnExtensionMap: originalColExtMap = EmbeddedItemSearchTable.defaultProps.columnExtensionMap, // Get/reuse default colExtMap from EmbeddedItemSearchTable
        // onSelectVariant, // `onSelectVariant` theoretically passed down from FilteringTab or something; will perform AJAX request + update selected variantsample state.
        ...passProps
    } = props;

    // Will use this method to inject modal open fx when Annotation/Interpretation spaces are moved to overlay
    // const onSelectVariant = function(e) {
    //     e.preventDefault();
    //     console.log("thing happened, e", e);
    // };
    const columnExtensionMap = useMemo(function() {
        // Generates new object `columnExtensionMap` only if `originalColExtMap` changes (if ever)
        return {
            ...originalColExtMap, // Copy in existing vals but overwrite display_title.render
            "display_title" : {
                ...originalColExtMap.display_title,
                widthMap: { 'lg' : 250, 'md' : 220, 'sm' : 200 },
                render: function(result, parentProps){
                    const { href, context, rowNumber, detailOpen, toggleDetailOpen } = parentProps;
                    return (
                        <DisplayTitleColumnWrapper {...{ result, href, context, rowNumber, detailOpen, toggleDetailOpen }}>
                            <SelectableTitle />
                        </DisplayTitleColumnWrapper>
                    );
                }
            },
            // TODO? We could potentially move some of these definitions into EmbeddedItemSearchTable.defaultProps.columnExtensionMap
            "DP" : { // Coverage, VAF column
                widthMap: { 'lg' : 140, 'md' : 120, 'sm' : 70 },
                render: function(result, props) {
                    const { DP = null, AF = null } = result;
                    const rows = [
                        <span key="DP" data-tip="Coverage" className="d-block text-truncate">{DP || "-"}</span>,
                        <span key="AF" data-tip="VAF" className="d-block text-truncate">{AF || "-"}</span>
                    ];
                    return <StackedRowColumn rowKey="Coverage, AF Row" className="text-center" {...{ rows }}/>;
                }
            },
            "associated_genotype_labels.proband_genotype_label" : { // Genotype column
                widthMap: { 'lg' : 240, 'md' : 230, 'sm' : 200 },
                render: function(result, props) {
                    const { associated_genotype_labels : { proband_genotype_label = null, mother_genotype_label = null, father_genotype_label = null } = {} } = result;
                    const rows = [];
                    if (proband_genotype_label) {
                        rows.push(<div key="proband_gt" className="d-block text-truncate"><span className="font-italic">Proband: </span>{proband_genotype_label}</div>);
                    } else {
                        return null;
                    }
                    if (mother_genotype_label) {
                        rows.push(<div key="mother_gt" className="d-block text-truncate"><span className="font-italic">Mother: </span>{mother_genotype_label || "-"}</div>);
                    }
                    if (father_genotype_label) {
                        rows.push(<div key="father_gt" className="d-block text-truncate"><span className="font-italic">Father: </span>{father_genotype_label || "-"}</div>);
                    }
                    return <StackedRowColumn rowKey="genotype" className="text-center" {...{ rows }}/>;
                }
            },
            "variant.genes.genes_ensg.display_title": { // Gene Transcript column
                widthMap: { 'lg' : 155, 'md' : 140, 'sm' : 130 },
                render: function(result, props) {
                    const { variant : { genes = [] } = {} } = result;

                    const geneTitles = genes.map((geneItem) => {
                        const { genes_ensg: { display_title = null } = {} } = geneItem || {};
                        return display_title;
                    });
                    if (genes.length > 0) {
                        const { genes_most_severe_transcript = null } = genes[0] || {};
                        const rows = [
                            <span key="genes_ensg" className="font-italic d-block text-truncate">{ geneTitles.length > 1 ? geneTitles.join() : geneTitles } </span>,
                            <span data-tip="Most Severe Transcript" key="genes_severe_transcript" className="font-italic d-block text-truncate">{ genes_most_severe_transcript}</span>
                        ];
                        return <StackedRowColumn rowKey="genes_data" className="text-center" {...{ rows }} />;
                    }
                    return null;
                }
            },
            "variant.genes.genes_most_severe_hgvsc": { // Variant column
                noSort: true,
                widthMap: { 'lg' : 120, 'md' : 110, 'sm' : 95 },
                render: function(result, props) {
                    const { variant : { genes : [firstGene = null] = [] } = {} } = result;
                    const { genes_most_severe_hgvsc = null } = firstGene || {};

                    if (firstGene && genes_most_severe_hgvsc) {
                        return <GenesMostSevereHGVSCColumn hgvsc={genes_most_severe_hgvsc} />;
                    }
                    return null;
                }
            },
            "variant.genes.genes_most_severe_consequence.coding_effect": { // Coding Effect column
                widthMap: { 'lg' : 140, 'md' : 130, 'sm' : 120 },
                render: function(result, props) {
                    const { variant : { genes : [firstGene = null] = [] } = {} } = result;
                    const { genes_most_severe_consequence : { coding_effect = null } = {} } = firstGene || {};

                    if (firstGene && coding_effect) {
                        return <StackedRowColumn rowKey="genes_codingeffect" className="text-center text-truncate" rows={[coding_effect]} />;
                    }
                    return null;
                }
            },
            "variant.gnomad_af": { // Gnomad column
                widthMap: { 'lg' : 140, 'md' : 130, 'sm' : 120 },
                render: function(result, props){
                    const { variant : { gnomad_af = null, max_pop_af_af_popmax = null } = {} } = result;
                    const rows = [];

                    if (!gnomad_af && !max_pop_af_af_popmax) {
                        return null;
                    }
                    if (gnomad_af) {
                        const gnomad_af_exp = gnomad_af ? gnomad_af.toExponential(3): null;
                        rows.push(<div key="gnomad_af" className="d-block text-truncate"><span className="text-600">ALL: </span>{gnomad_af_exp || gnomad_af || "-"}</div>);
                    }
                    if (max_pop_af_af_popmax){
                        const max_pop_af_af_popmax_exp = max_pop_af_af_popmax ? max_pop_af_af_popmax.toExponential(3): null;
                        rows.push(<div key="gnomad_af_popmax" className="d-block text-truncate"><span className="text-600">MAX: </span>{max_pop_af_af_popmax_exp || max_pop_af_af_popmax || "-"}</div>);
                    }
                    return <StackedRowColumn rowKey="genes_gnomad" className="text-center" {...{ rows }}/>;
                }
            },
            "variant.cadd_phred": { // Predictors column (cadd_phred, spliceai, phylop100)
                render: function(result, props) {
                    const { variant : { cadd_phred = null, spliceai_maxds = null, conservation_phylop100 = null } = {} } = result;
                    const rows = [];

                    if (!cadd_phred && !spliceai_maxds && !conservation_phylop100) {
                        return null;
                    }
                    if (cadd_phred) {
                        rows.push(<div key="cadd_phred" className="d-block text-truncate"><span className="text-600">Cadd Phred: </span>{cadd_phred || "-"}</div>);
                    }
                    if (spliceai_maxds) {
                        rows.push(<div key="spliceai_maxds" className="d-block text-truncate"><span className="text-600">SpliceAI MaxDS: </span>{spliceai_maxds || "-"}</div>);
                    }
                    if (conservation_phylop100) {
                        rows.push(<div key="phylop" className="d-block text-truncate"><span className="text-600">PhyloP 100: </span>{conservation_phylop100 || "-"}</div>);
                    }
                    return <StackedRowColumn rowKey="genes_predictors" className="text-center" {...{ rows }}/>;
                }
            }
        };
    }, [ originalColExtMap ]);
    return <EmbeddedItemSearchTable {...passProps} {...{ columnExtensionMap }} />;
}

function StackedRowColumn(props) {
    const { rowKey = null, rows = [], className = null } = props;
    const cls = ("w-100" + (className ? " " + className : ""));
    return (
        <div key={rowKey} className={cls} data-delay-dhow={750}>
            { rows }
        </div>
    );
}


/**
 * An edited version of SPC's DisplayTitleColumnDefault
 */
const VSDisplayTitleColumnDefault = React.memo(function VSDisplayTitleColumnDefault(props) {
    const { result = null, link, onClick, className = null } = props;
    const { variant = null } = result || {};
    const { display_title = null, dbsnp_rs_number = null } = variant;

    const cls = ("title-block" + (className ? " " + className : ""));
    const rows = [
        <span key="variant-title" className="d-block text-600 text-truncate">{display_title}</span>
    ];

    if (dbsnp_rs_number) {
        rows.push(<span key="dbsnp" className="font-italic">{dbsnp_rs_number}</span>);
    }

    return (
        <a key="title" href={link || '#'} onClick={onClick} className="d-block text-truncate">
            <StackedRowColumn rowKey="title-container" {...{ rows, cls }}  />
        </a>
    );
});

function SelectableTitle({ onSelectVariant, result, link }){
    // DisplayTitleColumnWrapper passes own 'onClick' func as prop to this component which would navigate to Item URL; don't use it here; intercept and instead use onSelectVariant from FilteringTab (or wherever).
    // `link` is also from DisplayTitleColumnWrapper; I think good to keep as it'll translate into <a href={link}> in DisplayTitleColumnDefault and this will still allow to right-click + open in new tab (may need event.preventDefault() and/or event.stopPropagation() present in onSelectVariant).
    return <VSDisplayTitleColumnDefault {...{ result, link }} onClick={onSelectVariant} />;
}

/**
 * @todo maybe reuse somewhere
 * // This... more or less should handle "NOT" (!=), where the "!" will be last char of field.
 *
 * @param {*} query1  Query to filter
 * @param {*} query2  Query to filter by
 */
export function filterQueryByQuery(query1, query2){
    if (typeof query1 === "string") {
        query1 = queryString.parse(query1);
    }
    if (typeof query2 === "string") {
        query2 = queryString.parse(query2);
    }

    const filterByDict = Object.keys(query2).reduce(function(m, field){
        m[field] = m[field] || {};
        if (Array.isArray(query2[field])){
            query2[field].forEach(function(v){
                m[field][v] = true;
            });
        } else {
            m[field][query2[field]] = true;
        }
        return m;
    }, { "type" : { "VariantSample" : true } });

    const queryFiltered = Object.keys(query1).reduce(function(m, field){
        const val = query1[field];

        if (typeof filterByDict[field] === "undefined") {
            m[field] = val;
            return m; // include it
        }

        if (!Array.isArray(val)) {
            if (filterByDict[field][val]) {
                return m; // Exclude/skip it.
            }
            m[field] = val;
            return m;
        }

        const nextArr = val.filter(function(v){
            return !filterByDict[field][v];
        });
        if (nextArr.length === 0) {
            // do nothing
        } else if (nextArr.length === 1) {
            // eslint-disable-next-line prefer-destructuring
            m[field] = nextArr[0];
        } else {
            m[field] = nextArr;
        }
        return m;

    }, {});

    return queryFiltered;
}



export const FilteringTab = React.memo(function FilteringTab(props) {
    const { context = null, windowHeight, session = false, schemas } = props;
    const {
        accession: caseAccession,
        initial_search_href_filter_addon = "",
        active_filterset = null,
        additional_variant_sample_facets = []
    } = context || {};

    const {  "@id" : activeFilterSetID = null } = active_filterset || {};

    const searchHrefBase = (
        "/search/?type=VariantSample"
        + (initial_search_href_filter_addon ? "&" + initial_search_href_filter_addon : "")
        + (additional_variant_sample_facets.length > 0 ? "&" + additional_variant_sample_facets.map(function(fac){ return "additional_facet=" + encodeURIComponent(fac); }).join("&") : "")
        + "&sort=date_created"
    );

    // DEPRECATED - we no longer have filter_blocks present initially.
    // const currentActiveFilterAppend = (filter_blocks[0] || {}).query || "";
    // const searchHrefWithCurrentFilter = searchHrefBase + (currentActiveFilterAppend ? "&" + currentActiveFilterAppend : "");

    // Hide facets that are ones used to initially narrow down results to those related to this case.
    const { hideFacets, onClearFiltersVirtual, isClearFiltersBtnVisible, blankFilterSetItem } = useMemo(function(){

        const onClearFiltersVirtual = function(virtualNavigateFxn, callback) {
            // By default, EmbeddedSearchItemView will reset to props.searchHref.
            // We override with searchHrefBase.
            return virtualNavigateFxn(searchHrefBase, {}, callback);
        };

        const isClearFiltersBtnVisible = function(virtualHref){
            // Re-use same algo for determining if is visible, but compare virtualhref
            // against searchHrefBase (without the current filter(s)) rather than
            // `props.searchHref` which contains the current filters.
            return VirtualHrefController.isClearFiltersBtnVisible(virtualHref, searchHrefBase);
        };

        let hideFacets = ["type", "validation_errors.name"];
        if (initial_search_href_filter_addon) {
            hideFacets = hideFacets.concat(Object.keys(queryString.parse(initial_search_href_filter_addon)));
        }

        const blankFilterSetItem = {
            "title" : "FilterSet for Case " + caseAccession,
            "created_in_case_accession" : caseAccession,
            "search_type": "VariantSample",
            "filter_blocks" : [
                {
                    "name" : "Filter Block 1",
                    "query" : ""
                }
            ]
        };

        if (initial_search_href_filter_addon) {
            blankFilterSetItem.flags = [
                {
                    "name" : "Case:" + caseAccession,
                    "query" : initial_search_href_filter_addon
                }
            ];
        }

        return { hideFacets, onClearFiltersVirtual, isClearFiltersBtnVisible, blankFilterSetItem };
    }, [ context ]);

    // This maxHeight is stylistic and dependent on our view design/style
    // wherein we have minHeight of tabs set to close to windowHeight in SCSS.
    // 405px offset likely would need to be changed if we change height of tab nav, tab title area, etc.
    // Overrides default 400px.
    const maxHeight = typeof windowHeight === "number" && windowHeight > 845 ? (windowHeight - 445) : undefined;

    // Table re-initializes upon change of key so we use it refresh table based on session.
    const searchTableKey = "session:" + session;

    // Load initial filter set Item via AJAX to ensure we get all @@embedded/calculated fields
    // regardless of how much Case embeds.
    const embeddedTableHeader = activeFilterSetID ? (
        <ajax.FetchedItem atId={activeFilterSetID} fetchedItemPropName="initialFilterSetItem" isFetchingItemPropName="isFetchingInitialFilterSetItem">
            <FilterSetController {...{ searchHrefBase }} excludeFacets={hideFacets}>
                <FilteringTableFilterSetUI caseItem={context} schemas={schemas} />
            </FilterSetController>
        </ajax.FetchedItem>
    ) : (
        // Possible to-do, depending on data-model future requirements for FilterSet Item (holding off for now):
        // could pass in props.search_type and use initialFilterSetItem.flags[0] instead of using searchHrefBase.
        <FilterSetController {...{ searchHrefBase }} excludeFacets={hideFacets} initialFilterSetItem={blankFilterSetItem}>
            <FilteringTableFilterSetUI caseItem={context} />
        </FilterSetController>
    );

    return (
        <React.Fragment>
            <h1 className="mb-24 mt-0">
                <span className="text-300">Variant Filtering and Technical Review</span>
            </h1>
            <CaseViewEmbeddedVariantSampleSearchTable { ...{ hideFacets, maxHeight, session, onClearFiltersVirtual, isClearFiltersBtnVisible, embeddedTableHeader }}
                key={searchTableKey} />
        </React.Fragment>
    );
});
