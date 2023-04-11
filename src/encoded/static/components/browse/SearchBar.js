'use strict';

import React, {
    useMemo,
    useCallback,
    useState,
    useRef,
    useEffect,
} from 'react';
import _ from 'underscore';
import url from 'url';
import queryString from 'query-string';
import ReactTooltip from 'react-tooltip';

export function SearchBar(props) {
    const {
        placeholder = 'Search...',
        // From VirtualHrefController or app.js:
        context: searchContext,
        isContextLoading,
        navigate: propNavigate,
        disabled: propDisabled,
    } = props;
    // This should be present & accurate on search response as long as is not compound filterset
    // search with 2+ filterblocks used.
    const { '@id': currentSearchHref } = searchContext || {};

    const currentSearchParts = useMemo(
        function () {
            if (!currentSearchHref) {
                return null;
            }
            return url.parse(currentSearchHref, true);
        },
        [searchContext]
    );

    const { query: currentSearchQuery } = currentSearchParts || {};
    const { q: currentSearchTextQuery = '' } = currentSearchQuery || {};

    const [value, setValue] = useState(currentSearchTextQuery);
    const [isChanging, setIsChanging] = useState(false);
    const searchInputRef = useRef(null);

    const isValueChanged = value !== currentSearchTextQuery;

    if (!isContextLoading && isChanging) {
        // Unset isChanging if finished loading.
        // Calling set value inside func body is equivalent to
        // getDerivedStateFromProps (avoids additional re-render).
        setIsChanging(false);
    }

    const onChange = useCallback(function (e) {
        e.stopPropagation();
        e.preventDefault();
        setValue(searchInputRef.current.value);
    });

    const onSubmit = useCallback(
        function (e) {
            e.stopPropagation();
            e.preventDefault();
            const nextQuery = { ...currentSearchQuery };
            // Using value from ref instead of 'value' for slight perf
            // (avoid re-instantiating this onSubmit func each render)
            const nextValue = searchInputRef.current.value || '';
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
                search: '?' + queryString.stringify(nextQuery),
            };
            propNavigate(url.format(nextSearchParts));
        },
        [propNavigate, currentSearchParts, isValueChanged]
    );

    const valueLen = value.length;
    const isValid = valueLen === 0 || valueLen > 1;

    const toggleTooltip = useMemo(function () {
        return _.debounce(
            function (hide = false) {
                if (hide) {
                    ReactTooltip.hide();
                } else {
                    ReactTooltip.show(searchInputRef.current);
                }
            },
            300,
            false
        );
    });

    useEffect(
        function () {
            setTimeout(toggleTooltip, 50, isValid);
        },
        [isValid]
    );

    // Update state.value if our search response has been updated (i.e. FilterSetUI switching btw filterblocks)
    useEffect(
        function () {
            setValue(currentSearchTextQuery);
        },
        [currentSearchTextQuery]
    );

    const iconCls =
        'icon icon-fw align-middle fas' +
        (' icon-' + (isChanging ? 'circle-notch icon-spin' : 'search')) +
        (' text-' +
            (!isValid ? 'danger' : isValueChanged ? 'dark' : 'secondary'));

    return (
        <form
            onSubmit={onSubmit}
            className="mb-0 d-flex align-items-center"
            role="search">
            <input
                type="search"
                aria-label="Search"
                spellCheck={false}
                name="q"
                className={'form-control' + (!isValid ? ' is-invalid' : '')}
                data-tip="Search term must have at least 2 characters"
                data-tip-disable={isValid}
                data-type="error"
                disabled={propDisabled || !currentSearchHref}
                {...{ onChange, value, placeholder }}
                ref={searchInputRef}
            />
            <button
                type="submit"
                className="btn fixed-height align-items-center d-flex bg-transparent border-0 px-2 py-1"
                disabled={
                    !isValid ||
                    isChanging ||
                    isContextLoading ||
                    !isValueChanged
                }>
                <i className={iconCls} />
            </button>
        </form>
    );
}
