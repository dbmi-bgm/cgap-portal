'use strict';

import React from 'react';
import PropTypes from 'prop-types';

/**
 * Page footer which is visible on each page.
 * In future could maybe move into app.js since file is so small.
 * But it may get bigger in future also and include things such as privacy policy, about page links, copyright, and so forth.
 */
export const Footer = React.memo(function Footer(){
    return (
        <footer id="page-footer">
            <div className="page-footer px-4">
                <div className="row">
                    <div className="col-12 col-xl-6">
                        <div className="footer-section copy-notice d-flex align-items-center justify-content-between">
                            <div className="d-flex align-items-center">
                                Harvard Medical School <span className="px-2">|</span> Brigham &amp; Women&apos;s Hospital
                            </div>
                            <div className="text-larger">
                                <a href="https://www.youtube.com/@cgaptraining" target="_blank" rel="noreferrer">
                                    <i className="icon icon-youtube fab mr-1"></i>
                                </a>
                                <a href="https://www.github.com/dbmi-bgm/" target="_blank" rel="noreferrer">
                                    <i className="icon icon-github fab"></i>
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
});
