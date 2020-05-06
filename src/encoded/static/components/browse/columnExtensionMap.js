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

export const columnExtensionMap = {
    ...basicColumnExtensionMap,
    // TODO: change to organization
    'lab.display_title' : {
        'title' : "Lab",
        'widthMap' : { 'lg' : 200, 'md' : 180, 'sm' : 160 },
        'render' : function labTitle(result, props){
            const { lab, submitted_by : { display_title : submitterTitle } = {} } = result;
            if (!lab) return null;
            const labLink = <a href={object.atIdFromObject(lab)}>{ lab.display_title }</a>;
            if (!submitterTitle){
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
        'render' : function(result, props){
            if (!result.date_published) return null;
            return <span className="value">{ formatPublicationDate(result.date_published) }</span>;
        },
        'order' : 504
    },
    'google_analytics.for_date' : {
        'title' : 'Analytics Date',
        'widthMap' : { 'lg' : 140, 'md' : 120, 'sm' : 120 },
        'render' : function googleAnalyticsDate(result, props){
            if (!result.google_analytics || !result.google_analytics.for_date) return null;
            return <LocalizedTime timestamp={result.google_analytics.for_date} formatType="date-sm" localize={false} />;
        }
    },
    'age' : {
        "title" : "Age",
        "widthMap" : { 'lg' : 100, 'md' : 90, 'sm' : 80 },
        "render" : function(result, props){
            const { age, age_units } = result;
            if (typeof age !== "number" || isNaN(age)) {
                return null;
            }
            let showAge = age;
            if (age_units) {
                showAge = age + " " + age_units + (age === 1 ? "" : "s");
            }
            return <span className="value">{ showAge }</span>;
        }
    },
    'age_at_death' : {
        "title" : "Age at Death",
        "widthMap" : { 'lg' : 100, 'md' : 90, 'sm' : 80 },
        "render" : function(result, props){
            const { age_at_death: age, age_at_death_units: age_units } = result;
            if (typeof age !== "number" || isNaN(age)) {
                return null;
            }
            let showAge = age;
            if (age_units) {
                showAge = age + " " + age_units + (age === 1 ? "" : "s");
            }
            return <span className="value">{ showAge }</span>;
        }
    },
    'status' : {
        'title' : 'Status',
        'widthMap' : { 'lg' : 120, 'md' : 120, 'sm' : 100 },
        'order' : 501,
        'render' : function statusIndicator(result, props){
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
        'render' : function(result, props){
            if (!result.workflow || !result.workflow.title) return null;
            const { title }  = result.workflow;
            const workflowHref = object.itemUtil.atId(result.workflow);
            let retLink;
            if (workflowHref){
                retLink = <a href={link}>{ title }</a>;
            } else {
                retLink = title;
            }
            return <span className="value">{ retLink }</span>;
        }
    }
};

