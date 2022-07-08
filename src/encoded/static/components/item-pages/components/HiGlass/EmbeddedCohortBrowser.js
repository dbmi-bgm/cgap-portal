"use strict";

import React, { useRef, useEffect } from "react";
import _ from "underscore";
import { ajax } from "@hms-dbmi-bgm/shared-portal-components/es/components/util";
import { HiGlassAjaxLoadContainer } from "./HiGlassAjaxLoadContainer";
import {
  getGeneLists,
} from "../CohortStatisticalAnalysisTableUtils";

function GeneListFilter({ geneLists, onChange }) {
  if (typeof onChange !== "function") return null;

  return (
    <div className="mb-1">
      <label className="form-label small fw-bold mb-0">Gene list</label>
      <select
        className="form-control form-control-sm d-block"
        aria-label=".form-select-sm example"
        onChange={onChange}
        defaultValue={"NONE"}
      >
        <option value="NONE">Non selected</option>
        {Object.keys(geneLists).map((gl) => (
          <option value={gl}>{gl}</option>
        ))}
      </select>
    </div>
  );
}

function AssociationTestFilter({ associationTests, onChange }) {
  if (typeof onChange !== "function") return null;

  return (
    <div className="mb-1">
      <label className="form-label small fw-bold mb-0">Selected association test</label>
      <select
        className="form-control form-control-sm d-block"
        aria-label=".form-select-sm example"
        onChange={onChange}
        defaultValue={associationTests[0]}
      >
        {associationTests.map((gl) => (
          <option value={gl}>{gl}</option>
        ))}
      </select>
    </div>
  );
}

class GeneSearchBar extends React.PureComponent {
  constructor(props) {
    super(props);
    const { higlassContainer } = props;
    this.higlassContainer = higlassContainer;

    this.state = {
      results: [],
      currentTextValue: props.value || "",
      loading: false, // starts out by loading base RequestURL
      error: null,
      info: null,
    };

    this.currentRequest = null;
    this.onLoadData = _.debounce(this.onLoadData.bind(this), 500, false);
    this.handleResultClick = this.handleResultClick.bind(this);
  }

  componentDidUpdate(pastProps, pastState) {}

  updateCurrentSearchTerm(evt) {
    const val = evt.target.value;
    this.setState(
      {
        currentTextValue: val,
      },
      () => {
        this.onLoadData();
      }
    );
  }

  constructFetchURL() {
    const { currentTextValue } = this.state;
    const url =
      "https://cgap-higlass.com/api/v1/suggest/?d=gene_annotation_hg38&ac=" +
      encodeURIComponent(currentTextValue);
    return url;
  }

  onLoadData() {
    this.setState({ loading: true }, () => {
      if (this.currentRequest) {
        // if there's already a request running, abort it
        this.currentRequest.abort && this.currentRequest.abort();
      }

      // Don't load anything, if there is only one letter
      if (this.state.currentTextValue.length <= 1) {
        this.setState({
          currentTextValue: this.state.currentTextValue,
          loading: false,
          results: [],
          error: null,
          info: null,
        });
        return;
      }

      const requestInThisScope = (this.currentRequest = ajax.load(
        this.constructFetchURL(),
        (response) => {
          if (requestInThisScope !== this.currentRequest) {
            return false; // some other request has been fired; cancel this one
          }
          this.currentRequest = null;

          if (!response) {
            this.setState({
              loading: false,
              results: [],
              error:
                "Could not get a response from server. Check network and try again.",
              info: null,
            });
            return;
          }

          if (Object.keys(response).length === 0) {
            this.setState({
              loading: false,
              results: [],
              error: null,
              info: "We could not find any matching genes.",
            });
            return;
          }
          if (this.state.loading) {
            this.setState({
              loading: false,
              results: response,
              error: null,
              info: null,
            });
          }
        },
        "GET",
        (response, xhr) => {
          const { results = [], error = null } = response;
          this.setState({
            loading: false,
            results,
            error:
              error ||
              "Something went wrong while searching for matching genes.",
            info: null,
          });
        }
      ));
    });
  }

  handleResultClick(evt, geneName) {
    evt.preventDefault();
    if (this.higlassContainer && this.higlassContainer.current) {
      const hgc = this.higlassContainer.current.getHiGlassComponent();
      const viewconf = hgc.api.getViewConfig();
      const viewId = viewconf.views[0].uid;
      hgc.api.zoomToGene(viewId, geneName, 2000, 2000);
    }
  }

  render() {
    const { results = [], loading, error, info } = this.state;

    const icon = loading
      ? "icon icon-spinner icon-spin fas"
      : "icon icon-search fas";

    return (
      <React.Fragment>
        {/* <div className="input-group">
          <div className="input-group-prepend">
            <span className="input-group-text" id="search-for-gene-addon">
              <i className={icon} />
            </span>
          </div>
          <input
            type="text"
            onChange={(evt) => this.updateCurrentSearchTerm(evt)}
            className="form-control"
            placeholder="Search for gene"
            aria-label="Search for gene"
            aria-describedby="search-for-gene-addon"
          />
        </div> */}
        <input
            type="text"
            onChange={(evt) => this.updateCurrentSearchTerm(evt)}
            className="form-control"
            placeholder="Search for gene"
            aria-label="Search for gene"
            aria-describedby="search-for-gene-addon"
          />
        <GeneSearchResult
          results={results}
          error={error}
          info={info}
          handleResultClick={this.handleResultClick}
        />
      </React.Fragment>
    );
  }
}

const GeneSearchResult = React.memo(function GeneSearchResult(props) {
  const { results, error, info, handleResultClick } = props;

  if (error) {
    return (
      <div>
        <i className="icon icon-exclamation-triangle fas text-warning ml-5 mr-1"></i>
        {error}
      </div>
    );
  } else if (info) {
    return (
      <div>
        <i className="icon icon-info-circle fas text-info ml-5 mr-1"></i>
        {info}
      </div>
    );
  }

  const resultsFormatted = results.map((result, i) => {
    if(i>=6){
      return;
    }

    return (
      <div className="mr-1" key={result.geneName}>
        <small><a href="#" onClick={(evt) => handleResultClick(evt, result.geneName)}>
          {result.geneName}
        </a></small>
      </div>
    );
  });

  return (
    <div className="d-flex flex-row flex-wrap bd-highlight">
      {resultsFormatted}
    </div>
  );
});

class EmbeddedCohortBrowserComponent extends React.PureComponent {
  constructor(props) {
    super(props);

    const {
      cohortVcfLocation,
      cohortDensityBwLocation,
      higlassContainerCohort,
      higlassContainerAnnotation,
      availableAssociationTests
    } = props;
    this.cohortVcfLocation = cohortVcfLocation;
    this.cohortDensityBwLocation = cohortDensityBwLocation;
    this.higlassContainerCohort = higlassContainerCohort;
    this.higlassContainerAnnotation = higlassContainerAnnotation;
    // TO REMOVE IN PROD
    this.availableAssociationTests = availableAssociationTests ? availableAssociationTests : ["CMC", "MB", "VT", "SKATO"];

    this.state = {
      activeTab: "cohort",
      geneLists: {},
    };
  }

  componentDidMount() {
    this.handleTabClick = this.handleTabClick.bind(this);
    this.applyGeneListFilter = this.applyGeneListFilter.bind(this);
    this.applyAssociationTestFilter = this.applyAssociationTestFilter.bind(this);
    this.processLoadedGeneList = this.processLoadedGeneList.bind(this);
    getGeneLists(this.processLoadedGeneList);
  }

  processLoadedGeneList(geneLists) {
    console.log(geneLists);
    this.setState((prevState) => ({
      geneLists: geneLists,
    }));
  }

  applyAssociationTestFilter(event) {
    const selectedTest = event.target.value;

    const hgc = this.higlassContainerCohort.current.getHiGlassComponent();
    if (hgc) {
      const viewconfCohort = hgc.api.getViewConfig();
      viewconfCohort.views[0].tracks.top.forEach((track) => {
        if (track.type === "geneList") {
          track.options["defaultStatistic"] = selectedTest;
        }
      });
      hgc.api.setViewConfig(viewconfCohort);
    }
  }

  applyGeneListFilter(event) {
    const geneList = event.target.value;

    let selectedGenes = "all";
    if (geneList !== "NONE") {
      selectedGenes = this.state.geneLists[geneList];
    }
    const hgc = this.higlassContainerCohort.current.getHiGlassComponent();
    if (hgc) {
      const viewconfCohort = hgc.api.getViewConfig();
      viewconfCohort.views[0].tracks.top.forEach((track) => {
        if (track.type === "geneList") {
          if (selectedGenes === "all") {
            delete track.options.includedGenes;
          } else {
            track.options["includedGenes"] = selectedGenes;
          }
        }
        if (track.uid === "texttrack_genelist") {
          if (selectedGenes === "all") {
            track.options["text"] = "Selected genes: all coding genes";
          } else {
            track.options["text"] = `Selected genes: ${geneList}`;
          }
        }
      });
      hgc.api.setViewConfig(viewconfCohort);
    }
  }

  handleTabClick(evt, target) {
    evt.preventDefault();
    this.setState(
      {
        activeTab: target,
      },
      () => {
        if (target === "cohort") {
          const hgc = this.higlassContainerCohort.current.getHiGlassComponent();
          if (hgc) {
            // Force Higlass to repaint. Without this the tracks can be positioned incorrectly
            hgc.boundRefreshView();
          }
        } else {
          const hga =
            this.higlassContainerAnnotation.current.getHiGlassComponent();
          const hgc = this.higlassContainerCohort.current.getHiGlassComponent();
          if (hga && hgc) {
            // We should be using the hga.api.zoomTo(...) functionality, but for some reason
            // it is not working. Modify and set the view conf instead.
            const viewconfCohort = hgc.api.getViewConfig();
            const xDomain = viewconfCohort.views[0].initialXDomain;
            const viewconfAnnot = hga.api.getViewConfig();
            const xDomainPadding = 100000;
            viewconfAnnot.views[0].initialXDomain = [
              xDomain[0] - xDomainPadding,
              xDomain[1] + xDomainPadding,
            ];
            viewconfAnnot.views[1].initialXDomain = xDomain;
            viewconfAnnot.views[1].tracks.top.forEach((track) => {
              if (track.type === "horizontal-transcripts") {
                track.options["startCollapsed"] = true;
              }
            });
            hga.api.setViewConfig(viewconfAnnot).then(() => {
              // Force Higlass to repaint. Without this the tracks can be positioned incorrectly
              // Still does not seem enough sometimes...
              hga.boundRefreshView();
              this.setState(this.state);
            });
          }
        }
      }
    );
  }

  render() {
    const variantPositionAbsCoord = 20000;
    return (
      <div>
        <ul className="nav nav-tabs" role="tablist">
          <li className="nav-item" key="cohort">
            <a
              className={
                this.state.activeTab === "cohort"
                  ? "nav-link active"
                  : "nav-link"
              }
              onClick={(evt) => this.handleTabClick(evt, "cohort")}
              href="#"
            >
              Cohort Browser
            </a>
          </li>
          <li className="nav-item" key="annotation">
            <a
              className={
                this.state.activeTab === "annotation"
                  ? "nav-link active"
                  : "nav-link"
              }
              onClick={(evt) => this.handleTabClick(evt, "annotation")}
              href="#"
            >
              Annotation Browser
            </a>
          </li>
        </ul>
        <div className="tab-content" id="cohortTabContent">
          <div
            className={
              this.state.activeTab === "cohort"
                ? "tab-pane fade show active"
                : "tab-pane fade"
            }
            role="tabpanel"
          >
            <div className="row mt-3">
              <div className="col-sm-3 pt-1">
                <div className="border p-2">
                  <div className="d-block bg-light px-2 mb-1">
                    <small>NAVIGATION</small>
                  </div>
                  <GeneSearchBar
                    higlassContainer={this.higlassContainerCohort}
                  />
                  <div className="d-block bg-light px-2 mb-1 mt-2">
                    <small>SETTINGS</small>
                  </div>
                  <GeneListFilter
                    geneLists={this.state.geneLists}
                    onChange={this.applyGeneListFilter}
                  />
                  <AssociationTestFilter
                    associationTests={this.availableAssociationTests}
                    onChange={this.applyAssociationTestFilter}
                  />
                </div>
              </div>
              <div className="col-sm-9">
                <HiGlassAjaxLoadContainer
                  cohortVcfLocation={this.cohortVcfLocation}
                  cohortDensityBwLocation={this.cohortDensityBwLocation}
                  ref={this.higlassContainerCohort}
                  requestingTab="cohort"
                />
              </div>
            </div>
          </div>
          <div
            className={
              this.state.activeTab === "annotation"
                ? "tab-pane fade show active"
                : "tab-pane fade"
            }
            role="tabpanel"
          >
            <div className="row mt-3">
              <div className="col-12">
                <HiGlassAjaxLoadContainer
                  variantPositionAbsCoord={variantPositionAbsCoord}
                  ref={this.higlassContainerAnnotation}
                  requestingTab="annotation"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export const EmbeddedCohortBrowser = React.memo(function EmbeddedCohortBrowser(
  props
) {
  const { cohortVcfLocation, cohortDensityBwLocation } = props;
  const higlassContainerCohort = useRef(null);
  const higlassContainerAnnotation = useRef(null);

  return (
    <EmbeddedCohortBrowserComponent
      cohortVcfLocation={cohortVcfLocation}
      cohortDensityBwLocation={cohortDensityBwLocation}
      higlassContainerCohort={higlassContainerCohort}
      higlassContainerAnnotation={higlassContainerAnnotation}
    />
  );
});
