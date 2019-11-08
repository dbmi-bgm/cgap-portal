'use strict';

import React from 'react';
import _ from 'underscore';

import { console, object } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { LocalizedTime, formatPublicationDate } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/LocalizedTime';
import { basicColumnExtensionMap } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/table-commons';
import { Schemas, typedefs } from './../util';

// eslint-disable-next-line no-unused-vars
const { Item, ColumnDefinition } = typedefs;

export const DEFAULT_WIDTH_MAP = { 'lg' : 200, 'md' : 180, 'sm' : 120, 'xs' : 120 };

/** Theoretically we could change all these render functions to just be functional React components, maybe a later todo. */

export const columnExtensionMap = _.extend({}, basicColumnExtensionMap, {
    // TODO: change to organization
    'lab.display_title' : {
        'title' : "Lab",
        'widthMap' : { 'lg' : 200, 'md' : 180, 'sm' : 160 },
        'render' : function labTitle(result, columnDefinition, props, width, popLink = false){
            var labItem = result.lab;
            if (!labItem) return null;
            var labLink;
            if (popLink){
                labLink = <a href={object.atIdFromObject(labItem)} target="_blank" rel="noopener noreferrer">{ labItem.display_title }</a>;
            }else{
                labLink = <a href={object.atIdFromObject(labItem)}>{ labItem.display_title }</a>;
            }

            if (!result.submitted_by || !result.submitted_by.display_title){
                return labLink;
            }
            return (
                <span>
                    <i className="icon icon-fw icon-user far user-icon" data-html data-tip={'<small>Submitted by</small> ' + result.submitted_by.display_title} />
                    { labLink }
                </span>
            );
        }
    },
    'date_published' : {
        'widthMap' : { 'lg' : 140, 'md' : 120, 'sm' : 120 },
        'render' : function(result, columnDefinition, props, width){
            if (!result.date_published) return null;
            return formatPublicationDate(result.date_published);
        },
        'order' : 504
    },
    'google_analytics.for_date' : {
        'title' : 'Analytics Date',
        'widthMap' : { 'lg' : 140, 'md' : 120, 'sm' : 120 },
        'render' : function googleAnalyticsDate(result, columnDefinition, props, width){
            if (!result.google_analytics || !result.google_analytics.for_date) return null;
            return <LocalizedTime timestamp={result.google_analytics.for_date} formatType="date-sm" localize={false} />;
        }
    },
    'age' : {
        "title" : "Age",
        "widthMap" : { 'lg' : 100, 'md' : 90, 'sm' : 80 },
        "render" : function(result, columnDefinition, props, width){
            const { age, age_units } = result;
            if (typeof age !== "number" || isNaN(age)) {
                return null;
            }
            if (age_units) {
                return age + " " + age_units + (age === 1 ? "" : "s");
            }
            return age;
        }
    },
    'age_at_death' : {
        "title" : "Age at Death",
        "widthMap" : { 'lg' : 100, 'md' : 90, 'sm' : 80 },
        "render" : function(result, columnDefinition, props, width){
            const { age_at_death: age, age_at_death_units: age_units } = result;
            if (typeof age !== "number" || isNaN(age)) {
                return null;
            }
            if (age_units) {
                return age + " " + age_units + (age === 1 ? "" : "s");
            }
            return age;
        }
    },
    'status' : {
        'title' : 'Status',
        'widthMap' : { 'lg' : 120, 'md' : 120, 'sm' : 100 },
        'order' : 501,
        'render' : function statusIndicator(result, columnDefinition, props, width){
            const statusFormatted = Schemas.Term.toName('status', result.status);
            return (
                <React.Fragment>
                    <i className="item-status-indicator-dot mr-07" data-status={result.status}/>
                    <span className="value">{ statusFormatted }</span>
                </React.Fragment>
            );
        }
    },
    'workflow.title' : {
        'title' : "Workflow",
        'render' : function(result, columnDefinition, props, width){
            if (!result.workflow || !result.workflow.title) return null;
            const { title }  = result.workflow;
            const link = object.itemUtil.atId(result.workflow);
            if (link){
                return <a href={link}>{ title }</a>;
            } else {
                return title;
            }
        }
    }
});
