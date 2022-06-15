"use strict";

import React, { useCallback, useMemo } from "react";
import PropTypes from "prop-types";
import _ from "underscore";
import url from "url";

import { console } from "@hms-dbmi-bgm/shared-portal-components/es/components/util";
import { DetailPaneStateCache } from "@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/DetailPaneStateCache";
import { TabixIndexedFile } from "@gmod/tabix";
import VCF from "@gmod/vcf";
import { RemoteFile } from "generic-filehandle";
import {
  CHROMS,
  parseVcfRecord,
  parseLocation,
  getGeneLists,
} from "./CohortStatisticalAnalysisTableUtils";
import { format } from "d3-format";
import { Checkbox } from "@hms-dbmi-bgm/shared-portal-components/es/components/forms/components/Checkbox";

function StatTestCheckbox({ label, checked, onChange }) {
  if (typeof onChange !== "function") return null;
  if (typeof checked === "undefined") return null;

  return (
    <Checkbox
      checked={checked}
      onChange={onChange}
      labelClassName="mb-0 font-weight-normal"
      className="checkbox-container"
      value={label}
    >
      {label}
    </Checkbox>
  );
}

class CohortStatisticalAnalysisTableComponent extends React.PureComponent {
  constructor(props) {
    super(props);
    const { numRows, vcfLocation, statTests, activeTests } = props;

    this.statTests = statTests;
    this.numRowsOriginal = numRows;

    this.state = {
      loading: true,
      numRows: numRows,
      vcfRecordsFiltered: [],
      vcfRecordsToDisplay: [],
      sortedBy: activeTests[0],
      activeTests: activeTests,
      geneLists: {},
      selectedGenes: [],
      filter: {},
    };

    //this.vcfLocation = vcfLocation // CREATE PRESIGNED URL
    this.vcfLocation =
      "https://aveit.s3.amazonaws.com/msa/cohort_gene_info.vcf.gz";
    this.tbiLocation = this.vcfLocation + ".tbi";

    this.vcfRecords = [];
  }

  componentDidUpdate(pastProps, pastState) {}

  componentDidMount() {
    this.handleSortIconClick = this.handleSortIconClick.bind(this);
    this.showMore = this.showMore.bind(this);
    this.filterChange = this.filterChange.bind(this);
    this.changeActiveTests = this.changeActiveTests.bind(this);
    this.processLoadedGeneList = this.processLoadedGeneList.bind(this);
    this.applyGeneListFilter = this.applyGeneListFilter.bind(this);
    this.loadData();
  }

  processLoadedGeneList(geneLists) {
    this.setState((prevState) => ({
      geneLists: geneLists,
    }));
  }

  loadData() {
    getGeneLists(this.processLoadedGeneList);
    const vcfFile = new TabixIndexedFile({
      filehandle: new RemoteFile(this.vcfLocation),
      tbiFilehandle: new RemoteFile(this.tbiLocation),
    });
    const vcfHeader = vcfFile.getHeader(); // Promise

    vcfHeader.then((header) => {
      const tbiVCFParser = new VCF({ header: header });
      const dataPromises = [];
      CHROMS.forEach((chrom) => {
        const dataPromise = vcfFile.getLines(
          chrom["name"],
          0,
          chrom["length"],
          (line) => {
            const vcfRecord = tbiVCFParser.parseLine(line);
            //console.log(vcfRecord);
            this.vcfRecords.push(
              parseVcfRecord(vcfRecord, this.props.statTests)
            );
          }
        );
        dataPromises.push(dataPromise);
      });

      Promise.all(dataPromises).then((values) => {
        const firstTest = this.state.activeTests[0];
        // Initially order by the first test in the list
        const vcfRecordsFiltered = this.sortRecordsByTest(
          this.vcfRecords,
          firstTest
        );
        const vcfRecordsToDisplay = vcfRecordsFiltered.slice(
          0,
          this.numRowsOriginal
        );
        this.setState((prevState) => ({
          loading: false,
          vcfRecordsFiltered: vcfRecordsFiltered,
          vcfRecordsToDisplay: vcfRecordsToDisplay,
          numRows: this.numRowsOriginal,
          sortedBy: firstTest,
        }));
        //console.log(this.vcfRecords);
        console.log(this.state.vcfRecordsToDisplay);
      });
    });
  }

  sortRecordsByTest(records, testName) {
    records.sort((a, b) => b[testName + "_log10"] - a[testName + "_log10"]);
    return records;
  }

  sortRecordsByTestAndUpdateState(records, testName) {
    const vcfRecordsFiltered = this.sortRecordsByTest(records, testName);
    const vcfRecordsToDisplay = vcfRecordsFiltered.slice(
      0,
      this.numRowsOriginal
    );
    this.setState((prevState) => ({
      loading: false,
      vcfRecordsFiltered: vcfRecordsFiltered,
      vcfRecordsToDisplay: vcfRecordsToDisplay,
      numRows: this.numRowsOriginal,
      sortedBy: testName,
    }));
  }

  handleSortIconClick(event) {
    event.preventDefault();
    const testName = event.target.dataset.testname;
    this.sortRecordsByTestAndUpdateState(
      this.state.vcfRecordsFiltered,
      testName
    );
  }

  showMore(event) {
    event.preventDefault();
    const newNumRows = this.state.numRows + 10;

    this.setState((prevState) => ({
      numRows: newNumRows,
      vcfRecordsToDisplay: this.state.vcfRecordsFiltered.slice(0, newNumRows),
    }));
  }

  changeActiveTests(event) {
    const clickedTest = event.target.value;
    const activeTests = [...this.state.activeTests];
    const index = activeTests.indexOf(clickedTest);
    // If found then remove, if not found then add
    if (index > -1) {
      activeTests.splice(index, 1);
    } else {
      activeTests.push(clickedTest);
    }

    let sortedBy = this.state.sortedBy;
    // A test was clicked that is currently sorted by
    if (sortedBy === clickedTest || !activeTests.includes(sortedBy)) {
      sortedBy = activeTests[0] || this.statTests[0];
      this.sortRecordsByTestAndUpdateState(
        this.state.vcfRecordsFiltered,
        sortedBy
      );
    }

    this.setState((prevState) => ({
      activeTests: activeTests,
      sortedBy: sortedBy,
    }));
  }

  filterChange(event) {
    const filtertype = event.target.dataset.filtertype;
    const filter = this.state.filter;

    filter[filtertype] = event.target.value;
    if (event.target.value === "") {
      delete filter[filtertype];
    }
    this.applyFilter(filter, this.state.selectedGenes);
  }

  applyFilter(filter, selectedGenes) {
    let records = this.vcfRecords;

    if (filter["gene"] !== undefined) {
      records = records.filter((v) =>
        v["geneName"].includes(filter["gene"].toUpperCase())
      );
    }

    if (filter["from"] !== undefined) {
      const locFrom = parseLocation(filter["from"]);
      if (locFrom) {
        records = records.filter((v) => {
          return v["posAbs"] >= locFrom;
        });
      }
    }
    if (filter["to"] !== undefined) {
      const locTo = parseLocation(filter["to"]);
      if (locTo) {
        records = records.filter((v) => {
          return v["posAbs"] <= locTo;
        });
      }
    }
    // Gene list filter
    if (selectedGenes.length > 0) {
      records = records.filter((v) => {
        return selectedGenes.includes(v["id"]);
      });
    }

    const vcfRecordsFiltered = this.sortRecordsByTest(
      records,
      this.state.sortedBy
    );
    const vcfRecordsToDisplay = vcfRecordsFiltered.slice(
      0,
      this.numRowsOriginal
    );

    this.setState((prevState) => ({
      filter: filter,
      vcfRecordsFiltered: vcfRecordsFiltered,
      vcfRecordsToDisplay: vcfRecordsToDisplay,
      numRows: this.numRowsOriginal,
      selectedGenes: selectedGenes,
    }));
  }

  applyGeneListFilter(event) {
    const val = event.target.value;
    const selectedGenes = val === "NONE" ? [] : this.state.geneLists[val];
    this.applyFilter(this.state.filter, selectedGenes);
  }

  getTableHeader() {
    const headerCols = [];
    headerCols.push(<th key="th.geneName">Gene name</th>);
    this.state.activeTests.forEach((test) => {
      let icon = "icon icon-sort-amount-down pl-1 fas";
      if (test !== this.state.sortedBy) {
        icon += " text-muted";
      }

      headerCols.push(
        <th key={test}>
          {test}{" "}
          <i
            className={icon}
            role="button"
            data-testname={test}
            onClick={this.handleSortIconClick}
          ></i>
        </th>
      );
    });
    return headerCols;
  }

  getTableBody() {
    const rows = [];
    this.state.vcfRecordsToDisplay.forEach((record) => {
      const id = record["id"];
      const cols = [];
      cols.push(<td key={id + "geneName"}>{record["geneName"]}</td>);
      this.state.activeTests.forEach((test) => {
        const val = format(".2f")(record[test + "_log10"]);
        cols.push(<td key={id + test}>{val}</td>);
      });
      rows.push(<tr key={id}>{cols}</tr>);
    });
    return rows;
  }

  getFilter() {
    return (
      <React.Fragment>
        <div className="p-3 bg-light">
          <div className="mb-1">
            <label
              htmlFor="filter-gene"
              className="form-label small fw-bold mb-0"
            >
              Gene name
            </label>
            <input
              className="form-control form-control-sm"
              id="filter-gene"
              data-filtertype="gene"
              placeholder="e.g. TNFRSF8"
              onChange={this.filterChange}
            />
          </div>
          <div className="mb-1">
            <label
              htmlFor="filter-from"
              className="form-label small fw-bold mb-0"
            >
              From
            </label>
            <input
              className="form-control form-control-sm"
              id="filter-from"
              placeholder="e.g. chr1:1000000"
              data-filtertype="from"
              onChange={this.filterChange}
            />
          </div>
          <div className="mb-1">
            <label
              htmlFor="filter-to"
              className="form-label small fw-bold mb-0"
            >
              To
            </label>
            <input
              className="form-control form-control-sm"
              id="filter-to"
              placeholder="e.g. chr3:20000000"
              data-filtertype="to"
              onChange={this.filterChange}
            />
          </div>
          <div className="mb-1">
            <label className="form-label small fw-bold mb-0">Gene list</label>
            {this.getGeneListFilter()}
          </div>

          <div className="mt-2">Statistical tests</div>
          {this.statTests.map((test) => (
            <StatTestCheckbox
              label={test}
              checked={this.state.activeTests.includes(test)}
              onChange={this.changeActiveTests}
            />
          ))}
        </div>
      </React.Fragment>
    );
  }

  getGeneListFilter() {
    return (
      <select
        className="form-control form-control-sm d-block"
        aria-label=".form-select-sm example"
        onChange={this.applyGeneListFilter}
        defaultValue={"NONE"}
      >
        <option value="NONE">Non selected</option>
        {Object.keys(this.state.geneLists).map((gl) => (
          <option value={gl}>{gl}</option>
        ))}
      </select>
    );
  }

  getShowMore() {
    if (
      this.state.vcfRecordsFiltered.length >
      this.state.vcfRecordsToDisplay.length
    ) {
      return (
        <div className="text-center py-3" onClick={this.showMore}>
          <a href="#">
            Show more (
            {this.state.vcfRecordsFiltered.length -
              this.state.vcfRecordsToDisplay.length}
            )
          </a>
        </div>
      );
    }
    return "";
  }

  render() {
    if (this.state.loading) {
      return (
        <div className="text-center my-4">
          <i className="icon icon-2x icon-spin icon-circle-notch fas"></i>
          <div>Loading data</div>
        </div>
      );
    }

    return (
      <React.Fragment>
        <div className="row">
          <div className="col-md-3 col-xl-2">{this.getFilter()}</div>
          <div className="col-md-9 col-xl-10">
            <table className="table table-sm table-hover">
              <thead>
                <tr>{this.getTableHeader()}</tr>
              </thead>
              <tbody>{this.getTableBody()}</tbody>
            </table>
            {this.getShowMore()}
          </div>
        </div>
      </React.Fragment>
    );
  }
}

export const CohortStatisticalAnalysisTable = React.memo(
  function CohortStatisticalAnalysisTable(props) {
    return <CohortStatisticalAnalysisTableComponent {...props} />;
  }
);
