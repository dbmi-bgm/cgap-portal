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
        this.filterResults = this.filterResults.bind(this);
        this.onClickResult = this.onClickResult.bind(this);
    }

    onFocus(isFocused) {
        // show the list of results
        this.setState({ resultsVisible: isFocused });
    }

    filterResults() {
        const { currQuery } = this.state;
        const { searchList } = this.props;

        // todo: move to utils or find duplicate util
        function escapeRegExp(string) {
            return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // handle escapable characters in regexp
        }

        // as person types, generate a regex filter based on their input
        const regex = new RegExp('^' + escapeRegExp(currQuery));

        // narrow down filter results
        const matches = searchList.filter((item) => item.match(regex));
        this.setState({ results: matches });

    }

    onType(e) { // relates to onChange prop function how?
        this.setState({ currQuery: e.target.value });
    }

    onClickResult(e, result) { // handle hover in CSS
        this.setState({ currQuery: result }); // set the value of input to be value of clicked result
    }

    render() {
        const { results, resultsVisible, currQuery } = this.state;
        // const { } = this.props;
        return (
            <div className="autocomp-wrap">
                <input type="text" onFocus={this.onFocus(true)} onBlur={this.onFocus(false)} onChange={this.onChange} value={currQuery}></input>
                {
                    resultsVisible && results.length > 0 ?
                        <ul className="autocomp-results">
                            { results.map((result) => (<li key={result} className="autocomp-result" onClick={ this.onClickResult(e, result) }>{ result }</li>))}
                        </ul>: null
                }
            </div>);
    }
}

SearchAsYouTypeLocal.propTypes = {
    maxResults : PropTypes.number,
    searchList : PropTypes.array.isRequired,
    // onChange : PropTypes.func.isRequired
    // searchListJSX : PropTypes.arrayOf(PropTypes.element),
};