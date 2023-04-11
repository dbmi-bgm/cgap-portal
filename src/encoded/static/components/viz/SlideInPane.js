import React from 'react';
import ReactDOM from 'react-dom';
import { CSSTransition } from 'react-transition-group';

export class SlideInPane extends React.PureComponent {
    static getDerivedStateFromProps(props, state) {
        const { in: propIn } = props;
        const { pastIn } = state;
        const nextState = { pastIn: propIn };
        if (!propIn && pastIn) {
            nextState.transitioningOut = true;
        }
        return nextState;
    }

    static defaultProps = {
        fromSide: 'right',
    };

    constructor(props) {
        super(props);
        this.onExited = this.onExited.bind(this);
        this.state = {
            transitioningOut: false,
            pastIn: false,
        };
    }

    onExited() {
        this.setState({ transitioningOut: false, in: false });
    }

    render() {
        const {
            onClose,
            in: propIn,
            fromSide,
            overlaysContainer,
            children,
            ...passProps
        } = this.props;
        const { transitioningOut } = this.state;
        if (!propIn && !transitioningOut) {
            return null;
        }

        return ReactDOM.createPortal(
            <CSSTransition
                classNames="slide-in-pane-transition"
                appear
                in={propIn && !transitioningOut}
                unmountOnExit
                timeout={{ enter: 10, exit: 400 }}
                onExited={this.onExited}>
                <div id="slide-in-pane-container" {...passProps}>
                    <div className="overlay-bg" onClick={onClose} />
                    <div
                        className={'slide-in-pane-outer from-side-' + fromSide}>
                        {children}
                    </div>
                </div>
            </CSSTransition>,
            overlaysContainer,
            'slide-in-pane'
        );
    }
}
