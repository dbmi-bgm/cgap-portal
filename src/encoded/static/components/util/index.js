'use strict';

/**
 * A directory of methods and maybe a mini-component or two for common use.
 *
 * @module util
 */


// Navigation
export { navigate } from './navigate';

// Type definitions
import * as typeDefinitions from './typedefs';
export const typedefs = typeDefinitions;

import * as SchemaUtilities from './Schemas';
export const Schemas = SchemaUtilities;

// Transforms, manipulations, parsers, etc. re: objects.
import * as fileUtilities from './file';
export const fileUtil = fileUtilities;

import * as SearchEngineOptimizationUtilities from './seo';
export const SEO = SearchEngineOptimizationUtilities;

import * as acmgUtilities from './acmg';
export const acmgUtil = acmgUtilities;

import * as hookUtilities from './hooks';
export const customHooks = hookUtilities;

// Shared utilities for item pages (Case, VariantSample, SomaticAnalysis, etc.)
import * as itemUtilities from './item';
export const itemUtil = itemUtilities;