'use strict';

import React, { useRef, useEffect } from 'react';
/**
 * Here's where we'll store custom hooks we've been using these days; maybe see about
 * moving these to SPC
 * @module
 */



/**
 * For replicating the functionality of "pastProps" in functional components
 * @param {*} value The value (prop or state) that you're trying to keep track of
 * @returns The current value
 */
export function usePrevious(value) {
    const ref = useRef();

    // This code will run when the value of 'value' changes
    useEffect(() => {
        ref.current = value; // assign the value of ref to the argument
    }, [value]);

    return ref.current;
}

/**
 * Custom React Hook by Dan Abramov https://overreacted.io/making-setinterval-declarative-with-react-hooks/
 * @param {Function} callback Method to call
 * @param {Number | null} delay Amount of time between calls of callback in ms (pass null to pause the interval)
 */
export function useInterval(callback, delay) {
    const savedCallback = useRef();

    // Remember the latest callback.
    useEffect(() => {
        savedCallback.current = callback;
    }, [callback]);

    // Set up the interval.
    useEffect(() => {
        function tick() {
            savedCallback.current();
        }
        if (delay !== null) {
            const id = setInterval(tick, delay);
            return () => clearInterval(id);
        }
    }, [delay]);
}