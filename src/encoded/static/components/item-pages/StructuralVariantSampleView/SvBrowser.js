/* eslint-disable react/jsx-no-bind */
'use strict';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import { console, layout, ajax, memoizedUrlParse, valueTransforms } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Checkbox } from '@hms-dbmi-bgm/shared-portal-components/es/components/forms/components/Checkbox';

import { SvBrowserHiglass } from './SvBrowserHiglass';

function SvSettingsCheckbox({ label, checked, onChange, disabled, loading = false }) {
    if (typeof onChange !== 'function') return null;
    if (typeof checked === 'undefined') return null;
    const spinnerClass = "spinner-border text-secondary ml-1 spinner-border-sm" + (!loading ? " d-none" : "");

    return (
        <Checkbox checked={checked} onChange={onChange} disabled={disabled || checked === null}
            labelClassName="mb-0 font-weight-normal"
            className="checkbox-container">
            {label}
            <div className={spinnerClass} role="status"></div>
        </Checkbox>

    );
}

export class SvBrowser extends React.PureComponent {

    constructor(props) {
        super(props);
        const { context } = props;

        const {
            file,
            CALL_INFO: bamSampleId,
            structural_variant: {
                START_ABS: variantStartAbsCoord,
                END_ABS: variantEndAbsCoord,
            }
        } = context;


        this.state = {
            'samples': [],
            'svBamVisibility': {},
            'svBamLoadingStatus': {}, // controls the spinner next to the checkbox
            'svVcfVisibility': {},
            'svVcfLoadingStatus': {}, // controls the spinner next to the checkbox
            'bamSampleId': bamSampleId,
            'variantStartAbsCoord': variantStartAbsCoord,
            'variantEndAbsCoord': variantEndAbsCoord,
            'file': file,
            'svViewSettings': {
                showDeletions: true,
                showDuplications: true,
                showInsertions: true,
                showInversions: true,
                minVariantLength: 1,
                maxVariantLength: Number.MAX_SAFE_INTEGER
            },
            'higlassSvVcf': null,
            'hasError': false
        };
        this.higlassContainer = null;

        this.updateSvType = this.updateSvType.bind(this);
        this.assignHGC = this.assignHGC.bind(this);
    }

    componentDidMount() {

        const { bamSampleId, file } = this.state;

        const fallbackCallback = (errResp, xhr) => {
            // Error callback
            this.setState({
                hasError: true
            });
            console.warn(errResp);
        };

        ajax.load(
            "/search/?type=Case&sample.bam_sample_id=" + bamSampleId + "&structural_variant_vcf_file.accession=" + file,
            (resp) => {
                const { "@graph": [ caseItem = null ] = [] } = resp;
                const { sample_processing: sampleProcessingItem = null } = caseItem || {};

                const svBamVisibility = {};
                const svBamLoadingStatus = {};
                const svVcfVisibility = {};
                const svVcfLoadingStatus = {};

                if (sampleProcessingItem) {
                    const { samples_pedigree: samplesPedigree = null, processed_files: processedFiles = [] } = sampleProcessingItem;
                    const samplesPedigreeSorted = [];

                    // Determines which tracks are visible by default
                    samplesPedigree.forEach((sample) => {
                        if (sample.sample_name === bamSampleId) {
                            samplesPedigreeSorted.unshift(sample);
                            svBamVisibility[sample.sample_accession] = true;
                        }
                        else {
                            samplesPedigreeSorted.push(sample);
                            svBamVisibility[sample.sample_accession] = false;
                        }
                        svVcfVisibility[sample.sample_accession] = true;
                        svBamLoadingStatus[sample.sample_accession] = false;
                        svVcfLoadingStatus[sample.sample_accession] = false;
                        svVcfVisibility["gnomad-sv"] = true;

                    });

                    // Get the Higlass SV vcf location
                    let higlassSvVcf = null;
                    processedFiles.forEach(function(file){
                        if (file["file_type"] === "Higlass SV VCF") {
                            higlassSvVcf = file["upload_key"];
                        }
                    });

                    this.setState({
                        "samples": samplesPedigreeSorted,
                        "svBamVisibility": svBamVisibility,
                        "svBamLoadingStatus": svBamLoadingStatus,
                        "svVcfVisibility": svVcfVisibility,
                        "svVcfLoadingStatus": svVcfLoadingStatus,
                        "higlassSvVcf": higlassSvVcf
                    });
                }
                else {
                    console.warn("There are no BAM files for this case.");
                }
            },
            'GET',
            fallbackCallback
        );
    }

    componentDidUpdate(pastProps, pastState) {

        if (this.higlassContainer === null) {
            return;
        }

        const hgc = this.higlassContainer.getHiGlassComponent();

        if (!hgc) {
            console.warn("Higlass component not found.");
            return;
        }

        const viewconf = hgc.api.getViewConfig();
        const { svViewSettings = {} } = this.state;

        viewconf.views.forEach((view) => {
            // We apply the filter to all tracks. Possibly exclude the GnomAD track?
            view.tracks.top.forEach((track) => {
                if (track.type === "sv") {
                    // Could also do `track.options = { ...track.options, svViewSettings }` to get new obj reference for options.
                    Object.assign(track.options, svViewSettings);
                }
            });
        });

        hgc.api.setViewConfig(viewconf);
    }

    updateSvType(event, svType) {
        this.setState(function(existingState){
            const { svViewSettings: existingSvSettings } = existingState;
            const { showDeletions, showDuplications, showInsertions, showInversions } = existingSvSettings;
            const svViewSettings = { ...existingSvSettings };

            svViewSettings['showDeletions']     = svType === "del" ? !showDeletions : showDeletions;
            svViewSettings['showDuplications']  = svType === "dup" ? !showDuplications : showDuplications;
            svViewSettings['showInsertions']    = svType === "ins" ? !showInsertions : showInsertions;
            svViewSettings['showInversions']    = svType === "inv" ? !showInversions : showInversions;

            return { svViewSettings };
        });
    }

    updateSvLength(event, minMax) {
        this.setState(function(existingState){
            const { svViewSettings: existingSvSettings } = existingState;
            let parsed = parseInt(event.currentTarget.value, 10);
            if (isNaN(parsed)) {
                if (minMax === 'min') {
                    parsed = 1;
                } else if (minMax === 'max') {
                    parsed = Number.MAX_SAFE_INTEGER;
                }
            }

            const svViewSettings = { ...existingSvSettings };

            if (minMax === 'min') {
                svViewSettings['minVariantLength'] = Math.max(parsed, 1);
            } else if (minMax === 'max') {
                svViewSettings['maxVariantLength'] = Math.max(parsed, svViewSettings['minVariantLength']);
            }

            return { svViewSettings };
        });
    }

    updateBamVisibility(accession) {
        this.setState(function({ svBamVisibility: existingVisibility, svBamLoadingStatus: existingLoadingStatus }){
            const svBamVisibility = { ...existingVisibility, [accession]: !existingVisibility[accession] };
            const svBamLoadingStatus = { ...existingLoadingStatus, [accession]: true };
            return { svBamVisibility, svBamLoadingStatus };
        }, this.updateViewconf);
    }

    updateVcfVisibility(accession) {
        this.setState(function({ svVcfVisibility: existingVisibility, svVcfLoadingStatus: existingLoadingStatus }){
            const svVcfVisibility = { ...existingVisibility, [accession]: !existingVisibility[accession] };
            const svVcfLoadingStatus = { ...existingLoadingStatus, [accession]: true };
            return { svVcfVisibility, svVcfLoadingStatus };
        }, this.updateViewconf);
    }

    resetLoadingStatus() {
        this.setState(function({ svVcfLoadingStatus: existingVcfLoadingStatus, svBamLoadingStatus: existingBamLoadingStatus }){
            const svVcfLoadingStatus = { ...existingVcfLoadingStatus };
            const svBamLoadingStatus = { ...existingBamLoadingStatus };
            Object.keys(svVcfLoadingStatus).forEach(function (key) {
                svVcfLoadingStatus[key] = false;
            });
            Object.keys(svBamLoadingStatus).forEach(function (key) {
                svBamLoadingStatus[key] = false;
            });
            return { svBamLoadingStatus, svVcfLoadingStatus };
        });
    }

    assignHGC(ref) {

        if (this.higlassContainer === null && ref.current !== null) {
            this.higlassContainer = ref.current;
        }

    }

    updateViewconf() {

        const fallbackCallback = (errResp, xhr) => {
            // Error callback
            console.warn(errResp);
        };

        if (!hgc) {
            console.error("No HGC available");
            return;
        }

        const hgc = this.higlassContainer.getHiGlassComponent();
        const currentViewconf = hgc.api.getViewConfig();
        const {
            variantStartAbsCoord, variantEndAbsCoord,
            samples, bamSampleId, svBamVisibility, svVcfVisibility,
            higlassSvVcf
        } = this.state;

        const payload = {
            'variant_pos_abs': variantStartAbsCoord,
            'variant_end_abs': variantEndAbsCoord,
            'requesting_tab': "sv",
            'samples_pedigree': samples,
            'bam_sample_id': bamSampleId,
            'bam_visibilty': svBamVisibility,
            'sv_vcf_visibilty': svVcfVisibility,
            'current_viewconf': currentViewconf,
            'higlass_sv_vcf': higlassSvVcf
        };

        ajax.load(
            "/get_higlass_viewconf/",
            (resp) => {
                hgc.api.setViewConfig(resp.viewconfig, true).then((v) => {
                    const viewId = 'ab'; // That's the id in the base viewconf
                    resp.viewconfig.views.forEach((view) => {
                        view.tracks.top.forEach((track) => {
                            if (track.type === "sv") {
                                const trackObj = hgc.api.getTrackObject(viewId, track.uid);
                                if (trackObj) {
                                    // We need to rerender because for some reason the labels in these tracks vanish,
                                    // when we update the viewconf
                                    trackObj.forceRerender();
                                }
                            }
                        });
                    });
                    const settings = {
                        viewId: viewId,
                        trackId: resp.viewconfig.views[1].tracks.top[0].uid
                    };
                    // This will resize the parent window to accommodate all new tracks
                    hgc.trackDimensionsModifiedHandlerBound(settings);
                    this.resetLoadingStatus();
                });

            },
            'POST',
            fallbackCallback,
            JSON.stringify(payload)
        );

    }

    render() {
        const { context = null, schemas } = this.props;
        const commonBodyProps = { context, schemas, "active": true };

        const {
            hasError, svViewSettings, samples, svBamVisibility, svVcfVisibility, svBamLoadingStatus, svVcfLoadingStatus, higlassSvVcf
        } = this.state;

        if (hasError) {
            return (
                <div className="text-center my-5">We had trouble loading the required data.</div>
            );
        }

        if (samples.length === 0) {
            return (
                <div className="text-center my-5">
                    <div className="spinner-border text-secondary"></div>
                    <div className="text-secondary mt-2">Loading samples</div>
                </div>
            );
        }

        const bamCheckboxes = [];
        const vcfCheckboxes = [];

        samples.forEach((sample) => {
            const { relationship, sample_accession: accession } = sample;
            const label = valueTransforms.capitalize(relationship);
            bamCheckboxes.push(<SvSettingsCheckbox label={label} loading={svBamLoadingStatus[accession]} checked={svBamVisibility[accession]} onChange={(e) => this.updateBamVisibility(accession)} />);
            vcfCheckboxes.push(<SvSettingsCheckbox label={label} loading={svVcfLoadingStatus[accession]} checked={svVcfVisibility[accession]} onChange={(e) => this.updateVcfVisibility(accession)} />);
        });
        const gnomadSvLabel = "GnomAD SV";
        const accession = "gnomad-sv";
        vcfCheckboxes.push(<SvSettingsCheckbox label={gnomadSvLabel} checked={svVcfVisibility[accession]} onChange={(e) => this.updateVcfVisibility(accession)} />);

        return (
            <div className="row flex-column flex-lg-row">

                <div className="inner-card-section col pb-2 pb-lg-0 col-lg-3 col-xl-3 d-flex flex-column sv-browser-settings">
                    <div className="info-header-title">
                        <h5 className="text-truncate">Settings</h5>
                    </div>
                    <div className="info-body flex-grow-1">
                        <div className="d-block bg-light px-2 mb-1">
                            <small >STRUCTURAL VARIANTS</small>
                        </div>
                        <div className="d-block mb-2">
                            {vcfCheckboxes}
                        </div>
                        <div className="d-block bg-light px-2 mb-1">
                            <small >BAM FILES</small>
                        </div>
                        <div className="d-block mb-2">
                            {bamCheckboxes}
                        </div>
                        <div className="d-block bg-light px-2 mb-1">
                            <small >SV FILTER</small>
                        </div>
                        <div className="d-block mb-2">
                            <SvSettingsCheckbox label="Show deletions" checked={svViewSettings.showDeletions} onChange={(e) => this.updateSvType(e, "del")} />
                            <SvSettingsCheckbox label="Show duplications" checked={svViewSettings.showDuplications} onChange={(e) => this.updateSvType(e, "dup")} />
                            <SvSettingsCheckbox label="Show insertions" checked={svViewSettings.showInsertions} onChange={(e) => this.updateSvType(e, "ins")} />
                            <SvSettingsCheckbox label="Show inversions" checked={svViewSettings.showInversions} onChange={(e) => this.updateSvType(e, "inv")} />
                        </div>
                        <div className="d-block mb-1">
                            <form>
                                <div className="form-group">
                                    <label className="font-weight-normal">Minimal SV length (bp):</label>
                                    <input type="number" className="form-control form-control-sm" onChange={(e) => this.updateSvLength(e, "min")} />
                                </div>
                                <div className="form-group">
                                    <label className="font-weight-normal">Maximal SV length (bp):</label>
                                    <input type="number" className="form-control form-control-sm" onChange={(e) => this.updateSvLength(e, "max")} />
                                </div>

                            </form>

                        </div>

                    </div>
                </div>

                <div className="inner-card-section col pb-2 pb-lg-0">
                    <div className="info-header-title">
                        <h5>Browser</h5>
                    </div>
                    <div className="info-body">

                        <SvBrowserHiglass {...commonBodyProps} {...{ samples, higlassSvVcf }} assignHGC={this.assignHGC} />

                    </div>
                </div>
            </div>

        );


    }
}







