'use strict';

import React, { useEffect, useState } from 'react';

let loadedPedigreeVizLibrary = null;
let isLoading = false; // Global flag for all PedigreeVizLoader instances, since might have > 1 instance on page/view; avoid multiple requests.

/**
 * This loads & caches the package-lock.json file as a separate file since it takes up some non-trivial size
 */
export function PedigreeVizLoader({ children, ...passProps }){
    const [ isLoaded, setLoaded ] = useState(!!(loadedPedigreeVizLibrary));

    useEffect(function(){
        if (isLoaded || isLoading) return;
        isLoading = true;
        import(
            /* webpackChunkName: "pedigree-viz" */
            'pedigree-viz'
        ).then(function(pedigreeVizLibrary){
            loadedPedigreeVizLibrary = pedigreeVizLibrary;
            isLoading = false;
            setLoaded(true);
        });
    }, []); // Runs once upon mount only.

    const childProps = { ...passProps, "PedigreeVizLibrary": loadedPedigreeVizLibrary };
    return React.Children.map(children, function(c){
        return React.cloneElement(c, childProps);
    });

}
