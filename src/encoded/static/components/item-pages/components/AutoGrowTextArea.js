'use strict';

import React from 'react';
import PropTypes, { func } from 'prop-types';
import _ from 'underscore';
import memoize from 'memoize-one';

export class AutoGrowTextArea extends React.Component {
    constructor(props) {
        super(props);
        this.resizeToFitContent = this.resizeToFitContent.bind(this);
        this.onChange = this.onChange.bind(this);
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

    componentDidUpdate(pastProps){
        const { maxHeight: pastMaxHeight, visible: pastVisible = true } = pastProps;
        const { maxHeight, visible = true } = this.props;

        if (visible === false && pastVisible === true) {
            // Effectively reset state to speed up next visible=true update.
            // setTimeout to defer it past other UI updates
            setTimeout(()=>{
                this.setState({ "textAreaHeight": "auto", "parentHeight": "auto" });
            }, 5);
        } else if ((visible === true && pastVisible === false) || maxHeight !== pastMaxHeight) {
            // If visible=false upon mount, then initialize auto-sizing here.
            // Also reset auto-sized height if maxHeight changes (very unlikely -- remove?)
            this.resizeToFitContent();
        }
    }

    componentDidMount() {
        const { visible = true } = this.props;
        if (visible) {
            // Defer initial sizing if not visible (e.g. ancestor element has display:none)
            this.resizeToFitContent();
        }
    }

    resizeToFitContent(){
        const { minHeight, maxHeight, buffer } = this.props;
        this.setState(function({ textAreaHeight: existingTextAreaHeight }){
            // Check existing state manually here b.c. AutoGrowTextArea is not a PureCompoennt.
            // (Prevent unecessary re-render on componentDidMount)
            if (existingTextAreaHeight === "auto") {
                return null;
            }
            return { "textAreaHeight": "auto" };
        }, () => {
            const newScrollHeight = this.textAreaRef.current.scrollHeight + buffer;
            this.setState({
                "parentHeight": newScrollHeight < maxHeight ? newScrollHeight : maxHeight,
                "textAreaHeight": newScrollHeight < maxHeight ? newScrollHeight : maxHeight
            });
        });
    }

    onChange(e) {
        const { onChange: propOnChange } = this.props;

        if (typeof propOnChange === "function") {
            propOnChange(e);
        }

        this.resizeToFitContent();
    }

    render() {
        const { className, buffer, minHeight, visible, maxHeight, ...passProps } = this.props;
        const { textAreaHeight, parentHeight } = this.state;

        return (
            // passProps includes value, defaultValue, children, row, placeholder, disabled, ...
            <div style={this.memoized.textareaWrapperStyle(parentHeight, maxHeight)} className={className}>
                <textarea {...passProps} ref={this.textAreaRef} style={this.memoized.textareaStyle(textAreaHeight, maxHeight)}
                    className="form-control" onChange={this.onChange} />
            </div>
        );
    }
}
AutoGrowTextArea.defaultProps = {
    // "minHeight": 150,
    "maxHeight": 325,
    "buffer": 2, // Help prevent showing scrollbar due to rounding or padding of textarea height.
    "rows": 5, // Used for minHeight, more or less.
    "onChange": null
};
