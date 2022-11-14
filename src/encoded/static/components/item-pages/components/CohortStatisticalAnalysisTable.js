"use strict";

import React, { useCallback, useMemo } from "react";
import PropTypes from "prop-types";
import _ from "underscore";

import { console } from "@hms-dbmi-bgm/shared-portal-components/es/components/util";
import { TabixIndexedFile } from "@gmod/tabix";
import VCF from "@gmod/vcf";
import { RemoteFile } from "generic-filehandle";
import {
  parseVcfRecord,
  parseLocation,
  getGeneLists,
} from "./utils/cohort-statistical-analysis-table-utils";
import { CHROMS } from "./utils/chrom-utils";
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

function TextboxFilter({ label, placeholder, filtertype, onChange }) {
  if (typeof onChange !== "function") return null;

  return (
    <div className="mb-1">
      <div className="mb-0">{label}</div>
      <input
        className="form-control form-control-sm"
        data-filtertype={filtertype}
        placeholder={placeholder}
        onChange={onChange}
      />
    </div>
  );
}

function GeneListFilter({ geneLists, onChange }) {
  if (typeof onChange !== "function") return null;

  return (
    <div className="mb-1">
      <div className="mb-0">Gene list</div>
      <select
        className="form-control form-control-sm d-block"
        aria-label=".form-select-sm example"
        onChange={onChange}
        defaultValue={"NONE"}
      >
        <option value="NONE">None selected</option>
        {Object.keys(geneLists).map((gl) => (
          <option value={gl} key={gl}>{gl}</option>
        ))}
      </select>
    </div>
  );
}

function ShowMore({ recordDifference, onClick }) {
  if (typeof onClick !== "function") return null;
  if (recordDifference > 0) {
    return (
      <div className="text-center py-3" onClick={onClick}>
        <a href="#">Show more ({recordDifference})</a>
      </div>
    );
  }
  return "";
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
      filter: {},
    };

    this.vcfLocation = vcfLocation 
    this.tbiLocation = this.vcfLocation + ".tbi";

    this.vcfRecords = {};
    this.geneListFilteredVcfRecords = [];
  }

  componentDidMount() {
    this.handleSortIconClick = this.handleSortIconClick.bind(this);
    this.showMore = this.showMore.bind(this);
    this.filterChange = this.filterChange.bind(this);
    this.changeActiveTests = this.changeActiveTests.bind(this);
    this.setLoadedGeneList = this.setLoadedGeneList.bind(this);
    this.applyGeneListFilter = this.applyGeneListFilter.bind(this);
    this.loadData();
  }

  setLoadedGeneList(geneLists) {
    this.setState((prevState) => ({
      geneLists: geneLists,
    }));
  }

  loadData() {
    getGeneLists(this.setLoadedGeneList);

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
            const parsedVcfRecord = parseVcfRecord(
              vcfRecord,
              this.props.statTests
            );
            const id = parsedVcfRecord["id"];
            // We are using this indexing strategy for more efficient gene list filtering
            this.vcfRecords[id] = parsedVcfRecord;
          }
        );
        dataPromises.push(dataPromise);
      });

      Promise.all(dataPromises).then((values) => {
        const firstTest = this.state.activeTests[0];
        this.geneListFilteredVcfRecords = Object.values(this.vcfRecords);
        // Initially order by the first test in the list
        this.sortRecordsByTestAndUpdateState(
          this.geneListFilteredVcfRecords,
          firstTest
        );
      })
      .catch(error => {
        console.error("Error loading data from VCF file: ", error);
      });

    })
    .catch(error => {
      console.error("Error loading VCF file: ", error);
    });
  }

  sortRecordsByTest(records, testName) {
    records.sort((a, b) => b[testName] - a[testName]);
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
    this.applyFilter(filter);
  }

  applyFilter(filter) {
    let records = this.geneListFilteredVcfRecords;

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
    }));
  }

  applyGeneListFilter(event) {
    const val = event.target.value;

    if (val === "NONE") {
      this.geneListFilteredVcfRecords = Object.values(this.vcfRecords);
    } else {
      const selectedGenes = this.state.geneLists[val];
      this.geneListFilteredVcfRecords = [];
      selectedGenes.forEach((gene) => {
        const record = this.vcfRecords[gene];
        if (record) {
          this.geneListFilteredVcfRecords.push(record);
        } else {
          console.warn(
            "Gene " + gene + " from gene list not found in available genes."
          );
        }
      });
    }
    this.applyFilter(this.state.filter);
  }

  getTableHeader() {
    const headerCols = [];
    headerCols.push(<th key="th.geneName">Gene name</th>);
    this.state.activeTests.forEach((test) => {
      let icon = "icon icon-sort-amount-down pl-1 fas";
      if (test !== this.state.sortedBy) {
        icon += " text-primary";
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
    return <tr>{headerCols}</tr>;
  }

  getTableBody() {
    const rows = [];
    this.state.vcfRecordsToDisplay.forEach((record) => {
      const id = record["id"];
      const cols = [];
      cols.push(<td key={id + "geneName"}>{record["geneName"]}</td>);
      this.state.activeTests.forEach((test) => {
        const val = format(".2f")(record[test]);
        cols.push(<td key={id + test}>{val}</td>);
      });
      rows.push(<tr key={id}>{cols}</tr>);
    });
    return rows;
  }

  getFilter() {
    return (
      <React.Fragment>
        <div className="p-3 border">
          <TextboxFilter
            label="Gene name"
            placeholder="e.g. TNFRSF8"
            filtertype="gene"
            onChange={this.filterChange}
          />
          <TextboxFilter
            label="From"
            placeholder="e.g. chr1:1000000"
            filtertype="from"
            onChange={this.filterChange}
          />
          <TextboxFilter
            label="To"
            placeholder="e.g. chr3:20000000"
            filtertype="to"
            onChange={this.filterChange}
          />

          <GeneListFilter
            geneLists={this.state.geneLists}
            onChange={this.applyGeneListFilter}
          />

          <div className="mt-2">Statistical tests</div>
          {this.statTests.map((test) => (
            <StatTestCheckbox
              key={test}
              label={test}
              checked={this.state.activeTests.includes(test)}
              onChange={this.changeActiveTests}
            />
          ))}
        </div>
      </React.Fragment>
    );
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

    const recordsHidden =
      this.state.vcfRecordsFiltered.length -
      this.state.vcfRecordsToDisplay.length;

    return (
      <React.Fragment>
        <div className="row">
          <div className="col-md-3 col-xl-2">{this.getFilter()}</div>
          <div className="col-md-9 col-xl-10">
            <table className="table table-sm table-hover">
              <thead>{this.getTableHeader()}</thead>
              <tbody>{this.getTableBody()}</tbody>
            </table>
            <ShowMore
              recordDifference={recordsHidden}
              onClick={this.showMore}
            />
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
