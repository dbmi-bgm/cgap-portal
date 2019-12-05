import React from 'react';
import PropTypes from 'prop-types';

export default class SearchAsYouTypeLocal extends React.Component{
    constructor(props){
        super(props);
        this.state = {
            results: [],
            resultsVisible: false,
            currQuery: ''
        };

        this.onFocus = this.onFocus.bind(this);
        this.onType = this.onType.bind(this);
        this.onUnfocus = this.onUnfocus.bind(this);
        this.filterResults = this.filterResults.bind(this);
        this.onClickResult = this.onClickResult.bind(this);
    }

    onFocus() {
        const { resultsVisible, results } = this.state;
        const { searchList } = this.props;

        if (!resultsVisible && results.length === 0) {
            this.setState({ results: searchList, resultsVisible: true });
        } else if (!resultsVisible && results.length > 0) {
            this.setState({ resultsVisible: true });
        }
    }

    onUnfocus() {
        this.setState({ resultsVisible: false });
    }

    onType(e) { // relates to onChange prop function how?
        const { currQuery, resultsVisible } = this.state;
        const { searchList } = this.props;
        const newQuery = e.target.value;
        console.log("currQuery:", currQuery);
        console.log("e.target.value: ", e.target.value);
        console.log("searchList: ", searchList);
        console.log("resultsVisible", resultsVisible);

        // todo: move to utils or find duplicate util
        function escapeRegExp(string) {
            return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // handle escapable characters in regexp
        }

        // as person types, generate a regex filter based on their input
        const regex = new RegExp('^' + escapeRegExp(newQuery));

        // narrow down filter results
        const matches = searchList.filter((item) => item.match(regex));
        console.log("matches: , " , matches);

        if (newQuery.length > 0) {
            this.setState({ currQuery: e.target.value, results: matches });
        } else if (newQuery.length === 0 && currQuery.length > 0) {
            // if user deletes all characters, hide the results too
            this.setState({ currQuery: e.target.value, resultsVisible: true });
        } else if (newQuery.length === 0 && currQuery.length === 0) {
            this.setState({ currQuery: e.target.value, resultsVisible: false });
        }
    }

    onClickResult(e, result) { // handle hover in CSS
        this.setState({ currQuery: result }); // set the value of input to be value of clicked result
    }

    render() {
        const { results, resultsVisible, currQuery } = this.state;
        return (
            <div className="autocomp-wrap">
                <input type="text" onFocus={this.onFocus} onBlur={this.onUnfocus} onChange={this.onType} value={currQuery}></input>
                {
                    resultsVisible && results.length > 0 ? (
                        <ul className="autocomp-results">
                            { results.map((result) => (<li key={result} className="autocomp-result" onClick={ this.onClickResult }>{ result }</li>))}
                        </ul>): null
                }
            </div>);
    }
}

SearchAsYouTypeLocal.propTypes = {
    maxResults : PropTypes.number,
    searchList : PropTypes.array.isRequired,
};