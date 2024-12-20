"use strict";

import React, { useRef, useEffect } from "react";
import _ from "underscore";
import { ajax } from "@hms-dbmi-bgm/shared-portal-components/es/components/util";
import { HiGlassAjaxLoadContainer } from "./HiGlassAjaxLoadContainer";
import { GeneSearchBox } from "./GeneSearchBox";
import { getGeneLists } from "../utils/cohort-statistical-analysis-table-utils";
import { Checkbox } from "@hms-dbmi-bgm/shared-portal-components/es/components/forms/components/Checkbox";

function GeneListFilter({ geneLists, onChange }) {
  if (typeof onChange !== "function") return null;

  return (
    <div className="mb-1">
      <label className="form-label fw-normal mb-0">Gene list</label>
      <select
        className="form-control form-control-sm d-block"
        aria-label=".form-select-sm example"
        onChange={onChange}
        defaultValue={"NONE"}
      >
        <option value="NONE">None selected</option>
        {Object.keys(geneLists).map((gl) => (
          <option value={gl} key={gl}>
            {gl}
          </option>
        ))}
      </select>
    </div>
  );
}

function CohortCheckbox({ label, checked, onChange }) {
  if (typeof onChange !== "function") return null;
  if (typeof checked === "undefined") return null;

  return (
    <Checkbox
      checked={checked}
      onChange={onChange}
      labelClassName="mb-0 fw-normal"
      className="checkbox-container"
      value={label}
    >
      {label}
    </Checkbox>
  );
}

function AssociationTestFilter({ associationTests, activeTest, onChange }) {
  if (typeof onChange !== "function") return null;

  return (
    <div className="mb-1">
      <label className="form-label fw-normal mb-0">
        Selected gene-based test
      </label>
      <select
        className="form-control form-control-sm d-block"
        onChange={onChange}
        defaultValue={activeTest}
      >
        {associationTests.map((gl) => (
          <option value={gl}>{gl}</option>
        ))}
      </select>
    </div>
  );
}

function MaskFilter({ masks, activeMask, onChange }) {
  if (typeof onChange !== "function") return null;

  return (
    <div className="mb-1">
      <label className="form-label fw-normal mb-0">
        Selected mask
      </label>
      <select
        className="form-control form-control-sm d-block"
        onChange={onChange}
        defaultValue={activeMask}
      >
        {masks.map((gl) => (
          <option value={gl}>{gl}</option>
        ))}
      </select>
    </div>
  );
}

function ControlFilter({ controlList, activeControl, onChange }) {
  if (typeof onChange !== "function") return null;

  return (
    <div className="mb-1">
      <label className="form-label fw-normal mb-0">
        Selected control group
      </label>
      <select
        className="form-control form-control-sm d-block"
        onChange={onChange}
        defaultValue={activeControl}
      >
        {controlList.map((c) => (
          <option value={c.key}>{c.item}</option>
        ))}
      </select>
    </div>
  );
}

// VEP consequence levels
const CL_HIGH = "High";
const CL_MODERATE = "Moderate";
const CL_LOW = "Low";
const CL_MODIFIER = "Modifier";

class EmbeddedCohortBrowserComponent extends React.PureComponent {
  constructor(props) {
    super(props);

    const {
      cohortVariantTestResults,
      cohortGeneTestResults,
      cohortVariantDensity,
      higlassContainerCohort,
      higlassContainerAnnotation,
      availableAssociationTests,
      variantDetailSource,
      activeAssociationTest,
      availableMasks,
      activeMask
    } = props;
    this.cohortVariantTestResults = cohortVariantTestResults;
    this.cohortGeneTestResults = cohortGeneTestResults;
    this.cohortVariantDensity = cohortVariantDensity;
    this.higlassContainerCohort = higlassContainerCohort;
    this.higlassContainerAnnotation = higlassContainerAnnotation;
    this.availableAssociationTests = availableAssociationTests;
    this.variantDetailSource = variantDetailSource;
    this.activeAssociationTest = activeAssociationTest;
    this.availableMasks = availableMasks;
    this.activeMask = activeMask;
    this.controlList = [{
      key: "control",
      item: "Verified controls"
    },
    {
      key: "gnomad2",
      item: "gnomAD v2"
    },
    {
      key: "gnomad3",
      item: "gnomAD v3"
    }];
    this.activeControl = "control"

    this.handleTabClick = this.handleTabClick.bind(this);
    this.applyGeneListFilter = this.applyGeneListFilter.bind(this);
    this.applyAssociationTestFilter =
      this.applyAssociationTestFilter.bind(this);
    this.processLoadedGeneList = this.processLoadedGeneList.bind(this);
    this.changeActiveConsequenceLevels =
      this.changeActiveConsequenceLevels.bind(this);
    this.changeShowAlleleFrequencies =
      this.changeShowAlleleFrequencies.bind(this);
    this.exportDisplay = this.exportDisplay.bind(this);

    this.state = {
      activeTab: "cohort",
      activeConsequenceLevels: [CL_HIGH, CL_MODERATE],
      showAlleleFrequencies: false,
      geneLists: {},
    };
  }

  componentDidMount() {
    getGeneLists(this.processLoadedGeneList);
  }

  processLoadedGeneList(geneLists) {
    this.setState((prevState) => ({
      geneLists: geneLists,
    }));
  }

  changeActiveConsequenceLevels(event) {
    const clickedConsequenceLevels = event.target.value;
    const activeConsequenceLevels = [...this.state.activeConsequenceLevels];
    const index = activeConsequenceLevels.indexOf(clickedConsequenceLevels);
    // If found then remove, if not found then add
    if (index > -1) {
      activeConsequenceLevels.splice(index, 1);
    } else {
      activeConsequenceLevels.push(clickedConsequenceLevels);
    }

    this.setState(
      (prevState) => ({
        activeConsequenceLevels: activeConsequenceLevels,
      }),
      () => {
        const hgc = this.higlassContainerCohort.current.getHiGlassComponent();
        if (hgc) {
          const viewconfCohort = hgc.api.getViewConfig();
          viewconfCohort.views[0].tracks.top.forEach((track) => {
            if (track.type === "cohort") {
              const acl = this.state.activeConsequenceLevels.map((cl) =>
                cl.toUpperCase()
              );
              track.options["consequenceLevels"] = acl;
            }
          });

          hgc.api.setViewConfig(viewconfCohort);
        }
      }
    );
  }

  changeShowAlleleFrequencies(event) {
    this.setState(
      (prevState) => ({
        showAlleleFrequencies: !prevState.showAlleleFrequencies,
      }),
      () => {
        const hgc = this.higlassContainerCohort.current.getHiGlassComponent();
        if (hgc) {
          const viewconfCohort = hgc.api.getViewConfig();
          viewconfCohort.views[0].tracks.top.forEach((track) => {
            if (track.type === "cohort") {
              track.options["showAlleleFrequencies"] =
                this.state.showAlleleFrequencies;
            }
          });
          hgc.api.setViewConfig(viewconfCohort);
        }
      }
    );
  }

  applyAssociationTestFilter(event) {
    const selectedTest = event.target.value;

    const hgc = this.higlassContainerCohort.current.getHiGlassComponent();
    if (hgc) {
      const viewconfCohort = hgc.api.getViewConfig();
      viewconfCohort.views[0].tracks.top.forEach((track) => {
        if (track.type === "geneList") {
          track.options["activeStatistic"] = selectedTest;
        }
      });
      hgc.api.setViewConfig(viewconfCohort);
    }
  }

  applyMaskFilter(event) {
    const selectedMask = event.target.value;

    const hgc = this.higlassContainerCohort.current.getHiGlassComponent();
    if (hgc) {
      const viewconfCohort = hgc.api.getViewConfig();
      viewconfCohort.views[0].tracks.top.forEach((track) => {
        if (track.type === "geneList") {
          track.options["activeMask"] = "MASK_"+selectedMask;
        }
      });
      hgc.api.setViewConfig(viewconfCohort);
    }
  }

  applyControlFilter(event) {
    const selectedControl = event.target.value;

    const hgc = this.higlassContainerCohort.current.getHiGlassComponent();
    if (hgc) {
      const viewconfCohort = hgc.api.getViewConfig();
      viewconfCohort.views[0].tracks.top.forEach((track) => {
        if (track.type === "cohort") {
          track.options["controlGroup"] = selectedControl;
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

  applyCaddFilter(event, minMax) {
    const val = event.target.value;

    const hgc = this.higlassContainerCohort.current.getHiGlassComponent();
    if (hgc) {
      const viewconfCohort = hgc.api.getViewConfig();
      viewconfCohort.views[0].tracks.top.forEach((track) => {
        if (track.type === "cohort") {
          if(minMax === "min"){
            track.options["minCadd"] = val === "" ? 0 : val;
          }else{
            track.options["maxCadd"] = val === "" ? 200 : val;
          }
        }
      });
      hgc.api.setViewConfig(viewconfCohort);
    }
  }

  exportDisplay() {
    const hgc = this.higlassContainerCohort.current.getHiGlassComponent();
    if (!hgc) {
      console.warn("Higlass component not found.");
      return;
    }
    const svg = hgc.api.exportAsSvg();

    var element = document.createElement("a");
    element.setAttribute(
      "href",
      "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg)
    );
    element.setAttribute("download", "cohort.svg");
    element.click();
  }

  render() {
    const variantPositionAbsCoord = 20000;
    const consequenceLevels = [CL_HIGH, CL_MODERATE, CL_LOW, CL_MODIFIER];

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
                    <small>NAVIGATION & DISPLAY</small>
                  </div>
                  <GeneSearchBox
                    higlassContainer={this.higlassContainerCohort}
                  />
                  {/* <div className="mt-2">
                    <CohortCheckbox
                      label="Show Allele Frequencies"
                      checked={this.state.showAlleleFrequencies}
                      onChange={this.changeShowAlleleFrequencies}
                    />
                  </div> */}
                  <div className="d-block bg-light px-2 mb-1 mt-1">
                    <small>GENE LEVEL FILTERING</small>
                  </div>
                  <GeneListFilter
                    geneLists={this.state.geneLists}
                    onChange={this.applyGeneListFilter}
                  />
                  <AssociationTestFilter
                    associationTests={this.availableAssociationTests}
                    activeTest={this.activeAssociationTest}
                    onChange={this.applyAssociationTestFilter}
                  />
                  <MaskFilter
                    masks={this.availableMasks}
                    activeMask={this.activeMask}
                    onChange={this.applyMaskFilter.bind(this)}
                  />
                  <div className="d-block bg-light px-2 mb-1 mt-2">
                    <small>VARIANT LEVEL FILTERING</small>
                  </div>
                  <ControlFilter
                    controlList={this.controlList}
                    activeControl={this.activeControl}
                    onChange={this.applyControlFilter.bind(this)}
                  />
                  <div className="mt-1">CADD Score</div>
                  <div className="row">
                    <div className="col-sm-6">
                      <div className="form-group">
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="Min"
                          onChange={(evt) => this.applyCaddFilter(evt, "min")}
                        />
                      </div>
                    </div>
                    <div className="col-sm-6">
                      <div className="form-group">
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="Max"
                          onChange={(evt) => this.applyCaddFilter(evt, "max")}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="">Consequence levels (VEP)</div>
                  <div className="row">
                    {consequenceLevels.map((cl) => (
                      <div className="col-sm-6">
                        <CohortCheckbox
                          key={"cb_" + cl}
                          label={cl}
                          checked={this.state.activeConsequenceLevels.includes(
                            cl
                          )}
                          onChange={this.changeActiveConsequenceLevels}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="d-block mb-1 mt-2">
                    <button
                      type="button"
                      className="btn btn-primary w-100"
                      onClick={this.exportDisplay}
                    >
                      <i className="icon icon-download icon-sm fas me-1"></i>
                      Export
                    </button>
                  </div>
                </div>
              </div>
              <div className="col-sm-9">
                <HiGlassAjaxLoadContainer
                  cohortVariantTestResults={this.cohortVariantTestResults}
                  cohortGeneTestResults={this.cohortGeneTestResults}
                  cohortVariantDensity={this.cohortVariantDensity}
                  variantDetailSource={this.variantDetailSource}
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
  const {
    cohortVariantTestResults,
    cohortGeneTestResults,
    cohortVariantDensity,
    variantDetailSource,
    availableAssociationTests,
    activeAssociationTest,
    availableMasks,
    activeMask
  } = props;
  const higlassContainerCohort = useRef(null);
  const higlassContainerAnnotation = useRef(null);

  return (
    <EmbeddedCohortBrowserComponent
      cohortVariantTestResults={cohortVariantTestResults}
      cohortGeneTestResults={cohortGeneTestResults}
      cohortVariantDensity={cohortVariantDensity}
      variantDetailSource={variantDetailSource}
      availableAssociationTests={availableAssociationTests}
      activeAssociationTest={activeAssociationTest}
      availableMasks={availableMasks}
      activeMask={activeMask}
      higlassContainerCohort={higlassContainerCohort}
      higlassContainerAnnotation={higlassContainerAnnotation}
    />
  );
});
