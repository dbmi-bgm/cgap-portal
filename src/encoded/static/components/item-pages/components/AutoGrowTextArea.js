'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import memoize from 'memoize-one';

export class AutoGrowTextArea extends React.Component {
    constructor(props) {
        super(props);
        this.onChangeWrapper = this.onChangeWrapper.bind(this);
        this.state = {
            "textAreaHeight": "auto",
            "parentHeight": "auto"
        };
        this.memoized = {
            textareaWrapperStyle: memoize(function(parentHeight, maxHeight){
                return {
                    "minHeight" : typeof textAreaHeight !== "number" ? parentHeight
                        : parentHeight > maxHeight ? maxHeight : parentHeight
                };
            }),
            textareaStyle: memoize(function(textAreaHeight, maxHeight){
                return {
                    "height": typeof textAreaHeight !== "number" ? textAreaHeight
                        : textAreaHeight > maxHeight ? maxHeight : textAreaHeight,
                    "resize": "none"
                };
            })
        };
        this.textAreaRef = React.createRef(null);
    }

    componentDidMount() {
        const { minHeight, maxHeight, buffer } = this.props;

        const currScrollHeight = this.textAreaRef.current.scrollHeight + buffer;
        // if (minHeight > currScrollHeight) {
        //     this.setState({
        //         parentHeight: `${minHeight}px`,
        //         textAreaHeight: `${minHeight}}px`
        //     });
        // } else {
        this.setState({
            "parentHeight": currScrollHeight > maxHeight ? maxHeight : currScrollHeight,
            "textAreaHeight": currScrollHeight > maxHeight ? maxHeight : currScrollHeight
        });
        // }
    }

    onChangeWrapper(e) {
        const { onChange, minHeight, maxHeight, buffer } = this.props;

        onChange(e);

        const currScrollHeight = this.textAreaRef.current.scrollHeight + buffer;
        // if (minHeight && minHeight > currScrollHeight) {
        //     this.setState({ textAreaHeight: "auto", parentHeight: minHeight }, () => {
        //         const newScrollHeight = this.textAreaRef.current.scrollHeight;
        //         if (minHeight > newScrollHeight) {
        //             this.setState({
        //                 parentHeight: minHeight,
        //                 textAreaHeight: minHeight
        //             });
        //         }
        //     });
        // } else {
        this.setState({
            "textAreaHeight": "auto",
            "parentHeight": currScrollHeight < maxHeight ? currScrollHeight : maxHeight
        }, () => {
            const newScrollHeight = this.textAreaRef.current.scrollHeight + buffer;
            this.setState({
                "parentHeight": newScrollHeight < maxHeight ? newScrollHeight : maxHeight,
                "textAreaHeight": newScrollHeight < maxHeight ? newScrollHeight : maxHeight
            });
        });
        // }
    }

    render() {
        const { value, children, className, minHeight, maxHeight, ...passProps } = this.props;
        const { textAreaHeight, parentHeight } = this.state;
        const useValue = value || children;
        return (
            // passProps includes row, placeholder, disabled, ...
            <div style={this.memoized.textareaWrapperStyle(parentHeight, maxHeight)} className={className}>
                <textarea {...passProps} value={useValue} ref={this.textAreaRef} style={this.memoized.textareaStyle(textAreaHeight, maxHeight)}
                    className="form-control" onChange={this.onChangeWrapper} />
            </div>
        );
    }
}
AutoGrowTextArea.defaultProps = {
    "minHeight": 150,
    "maxHeight": 325,
    "buffer": 5, // Help prevent showing scrollbar due to rounding or padding of textarea height.
    "rows": 5, // Used for minHeight, more or less.
    "onChange": function(event) {
        console.log("Called defaultProps.onChange", event);
    }
};
