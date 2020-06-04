'use strict';

import React from 'react';
import _ from 'underscore';

import { console, object } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { itemUtil } from '@hms-dbmi-bgm/shared-portal-components/es/components/util/object';
import { LocalizedTime, formatPublicationDate } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/LocalizedTime';
import { basicColumnExtensionMap,
    DisplayTitleColumnWrapper,
    DisplayTitleColumnDefault,
    DisplayTitleColumnUser } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/table-commons';
import { Schemas, typedefs } from './../util';

// eslint-disable-next-line no-unused-vars
const { Item, ColumnDefinition } = typedefs;

export const DEFAULT_WIDTH_MAP = { 'lg' : 200, 'md' : 180, 'sm' : 120, 'xs' : 120 };

/** Theoretically we could change all these render functions to just be functional React components, maybe a later todo. */

function renderAdvancedColumn(topLeft, status, main, dateTitle, date) {
    return( 
        <div style={{ width: "100%" }}>
            <div className="d-flex justify-content-between">
                <span className="col-topleft text-ellipsis-container" style={{ fontSize: "13px", fontStyle: "italic" }}>
                    {topLeft}
                </span>
                <i className="item-status-indicator-dot mr-07" data-status={status}/>
            </div>
            <div
                className="col-main text-ellipsis-container"
                style={{ textTransform: "uppercase", textAlign: "center", fontSize: "20px", fontWeight: "600" }}
            >
                {main}
            </div>
            <div className="col-date text-ellipsis-container" style={{ textAlign: "center", fontSize: "12px" }}>
                <strong>{dateTitle}</strong> 
                <LocalizedTime timestamp={date} formatType="date-sm" />
            </div>
        </div>
        );

}

// renderAdvancedColumn(result.display_title, result.status, result.individual_id, "Accessioned:", result.date_created);

/**
 * Should move this to CGAP at some point probably
 */
export const DisplayTitleColumnIndividual = React.memo(function DisplayTitleIndividualDefault({ result, link, onClick }) {
    // `href` and `context` reliably refer to search href and context here, i.e. will be passed in from VirtualHrefController.
    let title = itemUtil.getTitleStringFromContext(result); // Gets display_title || title || accession || ...

    const tooltip = (typeof title === "string" && title.length > 20 && title) || null;
    

    console.log("result", result);
    return <div key="title-container" className={`title-block d-flex flex-column`} data-tip={tooltip} data-delay-show={750}>
        {renderAdvancedColumn(result.individual.display_title, result.individual.status, result.case_id, "Accessioned:", result.individual.date_created)}
    </div>;
});





export const columnExtensionMap = {
    ...basicColumnExtensionMap,
    // 'display_title' : {
    //     'title' : "Title",
    //     'widthMap' : { 'lg' : 280, 'md' : 250, 'sm' : 200 },
    //     'minColumnWidth' : 90,
    //     'order' : -100,
    //     'render' : function renderDisplayTitleColumn(result, parentProps){
    //         const { href, context, rowNumber, detailOpen, toggleDetailOpen } = parentProps;
    //         const { '@type' : itemTypeList = ["Item"] } = result;
    //         let renderElem;
    //         if (itemTypeList[0] === "User") {
    //             renderElem = <DisplayTitleColumnUser {...{ result }}/>;
    //         } else if (itemTypeList[0] === "Individual") {
    //             renderElem = <DisplayTitleColumnIndividual {...{ result }}/>;
    //         } else {
    //             renderElem = <DisplayTitleColumnDefault {...{ result }}/>;
    //         }
    //         return (
    //             <DisplayTitleColumnWrapper {...{ result, href, context, rowNumber, detailOpen, toggleDetailOpen }}>
    //                 { renderElem }
    //             </DisplayTitleColumnWrapper>
    //         );
    //     }
    // },
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
    'individual': {
        'title': "Individual",
        'widthMap' : { 'lg' : 280, 'md' : 250, 'sm' : 200 },
        'render' : function renderIndividualColumn(result, parentProps){
            const { href, context, rowNumber, detailOpen, toggleDetailOpen } = parentProps;
            const { '@type' : itemTypeList = ["Item"] } = result;

            if (itemTypeList[0] === "Case") {
                return (<DisplayTitleColumnWrapper {...{ result, href, context, rowNumber, detailOpen, toggleDetailOpen }}>
                            <DisplayTitleColumnIndividual {...{ result }}/>
                     </DisplayTitleColumnWrapper>);
            }
            return <DisplayTitleColumnIndividual {...{ result }}/>;
        }
    },
    'sample_processing': {
        'title': "This won't work right",
        'render' : function renderIndividualColumn(result, parentProps){
            const { href, context, rowNumber, detailOpen, toggleDetailOpen } = parentProps;
            const { '@type' : itemTypeList = ["Item"], individual, sample_processing: { samples = []} } = result;

            let selected = {};
            console.log("individual @id", individual['@id']);
            samples.forEach(sample => {
                console.log("sample @id", sample['@id']);
                if (sample.individual['@id'] === individual['@id']){
                    selected = sample;
                }
            });
            return renderAdvancedColumn(selected.accession, selected.status, selected.specimen_type, "Collected Date:", selected.specimen_collection_date);
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

