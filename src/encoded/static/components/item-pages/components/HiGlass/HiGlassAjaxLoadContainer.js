"use strict";

import React from "react";
import _ from "underscore";
import memoize from "memoize-one";
import {
  object,
  ajax,
} from "@hms-dbmi-bgm/shared-portal-components/es/components/util";
import {
  HiGlassPlainContainer,
  HiGlassLoadingIndicator,
} from "./HiGlassPlainContainer";

/**
 * Accepts `higlassItem` (HiglassViewConfig Item JSON) as a prop and loads in the full
 * representation from `higlassItem.@id` if `higlassItem.viewconfig` is not present before
 * instantiating a HiGlassPlainContainer.
 */
export class HiGlassAjaxLoadContainer extends React.PureComponent {
  constructor(props) {
    super(props);

    this.getFullHiglassItem = this.getFullHiglassItem.bind(this);
    this.getHiGlassComponent = this.getHiGlassComponent.bind(this);

    this.state = {
      loading: false,
      higlassItem: null,
      variantPositionAbsCoord: props.variantPositionAbsCoord
        ? props.variantPositionAbsCoord
        : null,
      variantEndAbsCoord: props.variantEndAbsCoord
        ? props.variantEndAbsCoord
        : null,
      requestingTab: props.requestingTab,
      bamSampleId: props.bamSampleId ? props.bamSampleId : null,
      samples: props.samples ? props.samples : null,
      higlassSvVcf: props.higlassSvVcf ? props.higlassSvVcf : null,
      higlassCnvVcf: props.higlassCnvVcf ? props.higlassCnvVcf : null,
      cohortVariantTestResults: props.cohortVariantTestResults
        ? props.cohortVariantTestResults
        : null,
      cohortGeneTestResults: props.cohortGeneTestResults
        ? props.cohortGeneTestResults
        : null,
      cohortVariantDensity: props.cohortVariantDensity
        ? props.cohortVariantDensity
        : null,
      file: props.file ? props.file : null,
    };
    this.containerRef = React.createRef();
  }

  componentDidMount() {
    if (!this.state.higlassItem) {
      this.getFullHiglassItem();
    }
  }

  /**
   * Retrieve the HiGlass Component, if it exists.
   *
   * @returns {object} The result of getHiGlassComponent on the HiGlass container. Or null if it doesn't exist.
   */
  getHiGlassComponent() {
    return (
      (this.containerRef &&
        this.containerRef.current &&
        this.containerRef.current.getHiGlassComponent()) ||
      null
    );
  }

  /**
   * Makes an AJAX call to get the Higlass viewconfig resource.
   */
  getFullHiglassItem() {
    // Use the @id to make an AJAX request to get the HiGlass Item.
    this.setState({ loading: true }, () => {
      const fallbackCallback = (errResp, xhr) => {
        // Error callback
        console.warn(errResp);
      };

      const {
        variantPositionAbsCoord,
        requestingTab,
        bamSampleId,
        file,
        samples,
      } = this.state;

      if (requestingTab === "bam" && bamSampleId !== null && file !== null) {
        // Get the associated case and extract BAM infos from there
        ajax.load(
          "/search/?type=Case&sample.bam_sample_id=" +
            bamSampleId +
            "&vcf_file.accession=" +
            file,
          (resp) => {
            if (
              resp["@graph"].length > 0 &&
              resp["@graph"][0]["sample_processing"]
            ) {
              const samplesPedigree =
                resp["@graph"][0]["sample_processing"]["samples_pedigree"] ??
                null;
              const payload = {
                variant_pos_abs: variantPositionAbsCoord,
                requesting_tab: requestingTab,
                samples_pedigree: samplesPedigree,
                bam_sample_id: bamSampleId,
              };
              this.getViewconf(payload, fallbackCallback);
            } else {
              console.warn("There are no BAM files for this case.");
            }
          },
          "GET",
          fallbackCallback
        );
      } else if (requestingTab === "sv") {
        // In contrast to the bam case above, we already got the case in SvBrowser.js. We are reusing that data here.

        if (samples === null) {
          console.warn("No available samples");
          return;
        }

        const variantEndAbsCoord =
          this.state.variantEndAbsCoord === null
            ? variantPositionAbsCoord
            : this.state.variantEndAbsCoord;
        const higlassSvVcf = this.state.higlassSvVcf;
        const higlassCnvVcf = this.state.higlassCnvVcf;

        // Default settings for initial load - show only the proband bam files
        const svBamVisibility = {};
        const svVcfVisibility = {};
        samples.forEach((sample) => {
          if (sample.sample_name === bamSampleId) {
            svBamVisibility[sample.sample_accession] = true;
          } else {
            svBamVisibility[sample.sample_accession] = false;
          }
          svVcfVisibility[sample.sample_accession] = true;
          svVcfVisibility["gnomad-sv"] = true;
        });

        const payload = {
          variant_pos_abs: variantPositionAbsCoord,
          variant_end_abs: variantEndAbsCoord,
          requesting_tab: requestingTab,
          samples_pedigree: samples,
          bam_sample_id: bamSampleId,
          bam_visibilty: svBamVisibility,
          sv_vcf_visibilty: svVcfVisibility,
          higlass_sv_vcf: higlassSvVcf,
          higlass_cnv_vcf: higlassCnvVcf,
        };
        this.getViewconf(payload, fallbackCallback);
      } else if (requestingTab === "cohort") {
        const {
          cohortVariantTestResults,
          cohortGeneTestResults,
          cohortVariantDensity,
        } = this.state;
        const payload = {
          cohort_variant_test_results: cohortVariantTestResults,
          cohort_gene_test_results: cohortGeneTestResults,
          cohort_density: cohortVariantDensity,
        };
        this.getViewconf(
          payload,
          fallbackCallback,
          "/get_higlass_cohort_viewconf/"
        );
      } else {
        const payload = {
          variant_pos_abs: variantPositionAbsCoord,
          requesting_tab: requestingTab,
        };
        this.getViewconf(payload, fallbackCallback);
      }
    });
  }

  getViewconf(payload, fallbackCallback, endpoint = "/get_higlass_viewconf/") {
    ajax.load(
      endpoint,
      (resp) => {
        const higlassItem = {
          viewconfig: resp.viewconfig,
        };
        this.setState({ higlassItem: higlassItem, loading: false });
      },
      "POST",
      fallbackCallback,
      JSON.stringify(payload)
    );
  }

  render() {
    const { higlassItem, loading } = this.state;
    let { height } = this.props;

    //if height not defined by container then use instance defined value
    if (
      !height &&
      higlassItem &&
      higlassItem.instance_height &&
      higlassItem.instance_height > 0
    ) {
      height = higlassItem.instance_height;
    }

    // Use the height to make placeholder message when loading.
    const placeholderStyle = { height: height || 600 };
    if (placeholderStyle.height >= 140) {
      placeholderStyle.paddingTop = placeholderStyle.height / 2 - 40;
    }

    // If we're loading, show a loading screen
    if (loading) {
      return (
        <div className="text-center" style={placeholderStyle}>
          <HiGlassLoadingIndicator title="Loading" />
        </div>
      );
    }

    // Raise an error if there is no viewconfig
    if (!higlassItem || !higlassItem.viewconfig) {
      return (
        <div className="text-center" style={placeholderStyle}>
          <HiGlassLoadingIndicator
            icon="exclamation-triangle fas"
            title="No HiGlass content found. Please go back or try again later."
          />
        </div>
      );
    }

    // Scale the higlass config so it fits the given container.
    const adjustedViewconfig = object.deepClone(higlassItem.viewconfig);
    // Pass the viewconfig to the HiGlassPlainContainer
    return (
      <HiGlassPlainContainer
        {..._.omit(this.props, "higlassItem", "height")}
        viewConfig={adjustedViewconfig}
        ref={this.containerRef}
        height={height}
      />
    );
  }
}
