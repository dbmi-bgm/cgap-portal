'use strict';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import { console, layout, ajax } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { LocalizedTime } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/LocalizedTime';
import { PrintPreviewPane, PrintPreviewPaneLoadingIndicator, PagedJSDependencyLoader } from './PrintPreviewPane';




/** These shouldn't be editable by project, are listed here for simpler frontend re-use. */
const reportVars = {
    logos: {
        cgapSrc: "/static/img/exported-logo.svg"
    },
    /** @todo: get/sync colors(&similar-if-needed) from scss; maybe have SPC common func that gets dict of Bootstrap colors from SCSS. */
    colors: {
        primaryDark: "#20445f"
    }
};

/**
 * We could have this defined in a separate SCSS/CSS stylesheet, rather than as string here in JS,
 * which'd allow to not worry about syncing theme colors (primaryDark).
 * This CSS string is short enough to not bother, though.
 * PagedJS Previewer puts this string inside a new <style> tag during its rendering process.
 */
const reportStyleRulesText = `

        .running-header {
            /* Has to be defined here and not in-line */
            position: running(runningHeader);
        }

        .running-header .branding-area {
            padding-bottom: .175in;
        }

        .running-header #cgap-report-logo {
            height: .55in;
            width: .55in;
            display: block;
            flex-grow: 0;
            flex-shrink: 0;
            flex-basis: .55in;
            /* Minor fix as our image's alignment is a bit off-center */
            padding-bottom: 0.0325in;
            padding-left: 0.0325in;
            border: 1px dashed ${reportVars.colors.primaryDark};
            border-radius: 50%;
        }

        .running-header .report-header-box {
            padding: .125in;
            padding-bottom: .1in;
            background: #ebf4fd;
            font-size: 11pt;
        }

        .running-footer {
            /* Has to be defined here and not in-line */
            position: running(runningFooter);
            padding-top: 0.025in;
            padding-bottom: 0.25in;
            border-top: 0.5pt solid ${reportVars.colors.primaryDark};
        }

        .running-footer .attribution-info {
            /* Force text to extend right past the boundary of margin instd of wrapping. */
            white-space: nowrap;
            line-height: 1.35;
            font-size: 8pt;
            color: #555;
            text-align: left;
        }

        .running-footer .page-count {
            padding-left: 1.5ch;
            font-size: 12pt;
            font-weight: 600;
            text-align: right;
            color: ${reportVars.colors.primaryDark};
        }

        .running-footer .page-count:after {
            content: "Page " counter(page) " of " counter(pages);
        }

        /* Formatting -- remove top margin */
        .pagedjs_page_content h1,
        .pagedjs_page_content h2,
        .pagedjs_page_content h3,
        .pagedjs_page_content h4,
        .pagedjs_page_content h5,
        .pagedjs_page_content h6 {
            margin-top: 0;
        }

        @page {
            /* size: $print-page-size; <- This is set via Bootstrap style sheet, edit it there. */
            /* If content exceeds margins, then when go to print then might lose content */
            margin: 3in 0.35in 0.7125in;
            background: #fff;
            font-size: 11pt;
            color: #000;

            /* Add a minor buffer as sometimes Chrome print hides some contents of pagedjs contents (maybe some float calculation/conversion, idk) */
            /* This is then removed with print.scss */
            padding-bottom: 0.075in;

            @top-center {
                content: element(runningHeader);
                padding-top: .3in;
                padding-bottom: .175in;
            }

            @bottom-center {
                content: element(runningFooter);
            }

        }
    `;



export const ReportPrintPreviewPane = React.memo(function ReportPrintPreviewPane (props){
    const { report, caseItem, onPrintPreviewReady, reportSettings } = props;

    const onRenderComplete = useCallback(function(){
        // Allow some time for logo image(s) to load
        setTimeout(onPrintPreviewReady, 2000);
    });

    if (!report || !caseItem) {
        // Still loading required data sources, don't render print preview yet.
        return <PrintPreviewPaneLoadingIndicator footer="Loading data..." />;
    }

    return (
        <React.Fragment>
            <link rel="preload" href={reportVars.logos.cgapSrc} as="image" />
            <PagedJSDependencyLoader>
                <PrintPreviewPane styleRulesText={reportStyleRulesText} {...{ onRenderComplete }}>

                    <ReportHeader {...{ report, caseItem, reportSettings }} />

                    <ReportFooter {...{ report, reportSettings }} />

                    <h3>Test Title</h3>
                    <p>
                        Fames ut varius cursus donec nec. Nam maecenas mollis sem tempus? Aliquet tincidunt, tempus ridiculus vehicula senectus ac purus. Blandit mauris nibh enim lacinia facilisi. Erat aliquet tristique tortor porta. Integer laoreet class facilisis condimentum natoque fames taciti nostra? Urna, enim libero commodo etiam cum feugiat! Suscipit vitae cum velit nullam dapibus ipsum elit. Justo augue fringilla interdum massa nam. Malesuada lacus.
                    </p>
                    <p>
                        Ut, vulputate mattis amet auctor litora hac lacus potenti nibh suspendisse consequat. Bibendum curae; molestie sociosqu senectus habitant feugiat accumsan molestie euismod. Arcu litora nostra nullam mollis natoque, habitant sodales hac interdum lorem. Nascetur turpis enim tristique tincidunt mi fames metus aptent gravida. Nulla quisque felis pellentesque. Nunc at iaculis consectetur nibh bibendum, gravida ligula at senectus morbi nunc! Felis scelerisque dolor torquent porttitor litora id ad per. Faucibus facilisi aliquam nunc ornare, urna blandit eget hac porttitor. Convallis aenean mauris dui convallis.
                    </p>
                    <p>
                        Cum nunc ultrices dictum vel aliquet magnis eu. Cum leo urna malesuada auctor congue donec orci duis litora consectetur! Eros nunc laoreet primis nisl eget praesent sociis. Iaculis curabitur cras viverra cubilia euismod ullamcorper. Nulla netus vulputate magnis integer a curabitur non ridiculus ligula velit mauris? Fermentum etiam sit fames lacus, cubilia elit. Vitae condimentum potenti nisi sagittis per! Curae; imperdiet morbi proin, lacus sollicitudin aliquet. Curabitur lacinia enim ornare sem nunc turpis gravida dignissim metus imperdiet mus. Conubia taciti sollicitudin enim curabitur nulla! Semper felis vivamus neque congue litora tellus dolor natoque.
                    </p>
                    <p>
                        Duis suspendisse montes suscipit quis convallis habitant? Primis duis mi praesent. Viverra, dictum montes mattis sollicitudin. Vel, euismod nulla commodo. Mus tempor metus convallis vehicula tristique eros senectus semper quam gravida. Congue felis, non dolor consequat. Mattis conubia amet platea ultrices metus curabitur hendrerit. Erat ridiculus fusce velit laoreet sapien. Cum ipsum nisl euismod sit massa nibh, morbi curabitur. Enim dapibus.
                    </p>
                    <p>
                        Penatibus risus montes facilisis vulputate, pellentesque fringilla sociosqu tellus. Arcu potenti lectus dolor nascetur sapien integer lorem urna. Phasellus odio sapien purus mauris nulla ullamcorper aliquam nunc ad. Aptent luctus nulla nullam dictum habitant blandit justo ultrices cubilia. Lectus fermentum euismod a conubia magna luctus tincidunt laoreet natoque lacus. Venenatis ullamcorper turpis ante litora. In hac suspendisse bibendum purus convallis quis. Quam dolor erat suscipit molestie. Gravida quisque sagittis varius. Massa magna convallis gravida. Non enim semper felis dictum lacinia nullam adipiscing nullam pharetra aptent. Tellus sodales sed mi eleifend ultricies laoreet quam nec. Pellentesque?
                    </p>
                    <p>
                        Ut, vulputate mattis amet auctor litora hac lacus potenti nibh suspendisse consequat. Bibendum curae; molestie sociosqu senectus habitant feugiat accumsan molestie euismod. Arcu litora nostra nullam mollis natoque, habitant sodales hac interdum lorem. Nascetur turpis enim tristique tincidunt mi fames metus aptent gravida. Nulla quisque felis pellentesque. Nunc at iaculis consectetur nibh bibendum, gravida ligula at senectus morbi nunc! Felis scelerisque dolor torquent porttitor litora id ad per. Faucibus facilisi aliquam nunc ornare, urna blandit eget hac porttitor. Convallis aenean mauris dui convallis.
                    </p>
                    <p>
                        Cum nunc ultrices dictum vel aliquet magnis eu. Cum leo urna malesuada auctor congue donec orci duis litora consectetur! Eros nunc laoreet primis nisl eget praesent sociis. Iaculis curabitur cras viverra cubilia euismod ullamcorper. Nulla netus vulputate magnis integer a curabitur non ridiculus ligula velit mauris? Fermentum etiam sit fames lacus, cubilia elit. Vitae condimentum potenti nisi sagittis per! Curae; imperdiet morbi proin, lacus sollicitudin aliquet. Curabitur lacinia enim ornare sem nunc turpis gravida dignissim metus imperdiet mus. Conubia taciti sollicitudin enim curabitur nulla! Semper felis vivamus neque congue litora tellus dolor natoque.
                    </p>
                    <p>
                        Duis suspendisse montes suscipit quis convallis habitant? Primis duis mi praesent. Viverra, dictum montes mattis sollicitudin. Vel, euismod nulla commodo. Mus tempor metus convallis vehicula tristique eros senectus semper quam gravida. Congue felis, non dolor consequat. Mattis conubia amet platea ultrices metus curabitur hendrerit. Erat ridiculus fusce velit laoreet sapien. Cum ipsum nisl euismod sit massa nibh, morbi curabitur. Enim dapibus.
                    </p>
                    <p>
                        Penatibus risus montes facilisis vulputate, pellentesque fringilla sociosqu tellus. Arcu potenti lectus dolor nascetur sapien integer lorem urna. Phasellus odio sapien purus mauris nulla ullamcorper aliquam nunc ad. Aptent luctus nulla nullam dictum habitant blandit justo ultrices cubilia. Lectus fermentum euismod a conubia magna luctus tincidunt laoreet natoque lacus. Venenatis ullamcorper turpis ante litora. In hac suspendisse bibendum purus convallis quis. Quam dolor erat suscipit molestie. Gravida quisque sagittis varius. Massa magna convallis gravida. Non enim semper felis dictum lacinia nullam adipiscing nullam pharetra aptent. Tellus sodales sed mi eleifend ultricies laoreet quam nec. Pellentesque?
                    </p>

                </PrintPreviewPane>
            </PagedJSDependencyLoader>
        </React.Fragment>
    );
});


/**
 * Will probably move this out into own file eventually.
 */
function ReportBody (){
    return (
        <React.Fragment>
            Stuff
        </React.Fragment>
    );
}


function ReportHeader({ report, caseItem, reportSettings }){
    const {
        header: {
            organization_title = null,
            show_individual_id = true,
            show_family_id = true,
            show_cgap_id = true,
            show_sample_type = true,
            show_sex = true,
            show_age = true
        }
    } = reportSettings;
    const {
        institution: {
            display_title: institutionTitle
        },
        project: {
            display_title: projectTitle
        },
        accession: reportAccession
    } = report;
    const {
        accession: caseAccession,
        date_created,
        individual: {
            individual_id,
            accession: individualAccession,
            age,
            age_units,
            sex
        },
        family: {
            accession: familyAccession
        },
        sample: {
            specimen_type,
            sequencing_date
        },
        sample_processing: {
            analysis_type
        }
    } = caseItem;

    // TODO: Potentially define CGAP logo as SVG markup and embed it inline rather
    // than loading. Would make logo appear sooner. But still would need to load
    // partner logo so perhaps not worth worrying about.

    const showAge = (typeof age === "number" && age_units) ? `${age} ${age_units}${age === 1 ? "" : "s"}` : null;

    return (
        <div className="running-header">
            <div className="row branding-area">
                <div className="col-6 d-flex align-items-center">
                    {/* TODO: partnerLogo ? ... : null */}
                    <h4 className="text-400">{ organization_title || projectTitle }</h4>
                </div>
                <div className="col-6 d-flex align-items-center">
                    <div className="text-right flex-grow-1 pr-16 pb-02">
                        <h4 className="text-primary-dark text-600 my-0">GENOME SEQUENCING REPORT</h4>
                        <h6 className="text-primary text-400 my-0">Computational Genome Analysis Platform</h6>
                    </div>
                    <img id="cgap-report-logo" src={reportVars.logos.cgapSrc} />
                </div>
            </div>
            <div className="row text-left">
                <div className="col-6">

                    <div className="report-header-box">
                        <ReportHeaderItem label="Individual ID" value={individual_id} show={show_individual_id} />
                        <ReportHeaderItem label="CGAP ID" value={caseAccession} show={show_cgap_id} />
                        <ReportHeaderItem label="Family ID" value={familyAccession} show={show_family_id} />
                        <ReportHeaderItem label="Sample Type" value={specimen_type} valueCls="text-capitalize" show={show_sample_type} />
                        <ReportHeaderItem label="Sex" value={sex === "M" ? "Male" : sex === "F" ? "Female" : "Unknown"} show={show_sex} />
                        <ReportHeaderItem label="Age" value={showAge} show={show_age} />
                    </div>

                </div>
                <div className="col-6">

                    <div className="report-header-box">
                        <ReportHeaderItem label="Accession Date" value={<LocalizedTime timestamp={date_created}/>} />
                        <ReportHeaderItem label="Analysis Date" value={<LocalizedTime timestamp={sequencing_date}/>} />
                        <ReportHeaderItem label="Analysis Type" value={analysis_type} />
                        <ReportHeaderItem label="Report ID" value={reportAccession} />
                        {/* Passing in timestamp={null} is equivalent to specifying "now" */}
                        <ReportHeaderItem label="Report Date" value={<LocalizedTime timestamp={null}/>} />
                        <ReportHeaderItem label="Clinical Team" />
                    </div>

                </div>
            </div>
        </div>
    );
}

function ReportFooter({ report }) {
    const {
        institution: {
            display_title: institutionTitle,
            address1,
            address2,
            city,
            state,
            postal_code,
            country,
            phone1,
            fax,
            url: externalWebsiteURL,
            contact_persons: [ { email } = {} ] = []
        } = {}
    } = report;

    const contactInfoRows = [
        _.filter([
            institutionTitle,
            _.filter([
                _.filter([
                    _.filter([ address1, address2, city, state ]).join(", "),
                    postal_code
                ]).join(" "),
                country
            ]).join(", ")
        ]).join(" | "),
        _.filter([ phone1 && ("P: " + phone1), fax && ("F: " + fax) ]).join(" | "),
        _.filter([ email, externalWebsiteURL ]).join(" | ")
    ].map(function(rowStr, i){
        return <div key={i}>{ rowStr }</div>;
    });

    return (
        <div className="running-footer">
            <div className="row align-items-center">
                <div className="col-8 attribution-info">
                    { contactInfoRows }
                </div>
                <div className="col-4 page-count">

                </div>
            </div>
        </div>
    );

}


function ReportHeaderItem(props){
    const {
        label = "Label",
        value = <em className="text-small">Not Implemented</em>,
        valueCls = null,
        fallbackValue = "-",
        show = true
    } = props;
    if (!show) {
        return null;
    }
    return (
        <div className="row">
            <div className="col-5">
                <label className="mb-02">{ label }:</label>
            </div>
            <div className={"col-7" + (valueCls ? " " + valueCls : "")}>
                { value || fallbackValue }
            </div>
        </div>
    );
}
