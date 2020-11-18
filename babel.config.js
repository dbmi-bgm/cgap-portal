
module.exports = function(api){
    api.cache(true);
    return {
        "presets" : [
            [ "@babel/preset-env", { "exclude": ["proposal-dynamic-import"] } ],
            "@babel/preset-react",
        ],
        "plugins": [
            "@babel/plugin-syntax-dynamic-import",
            "@babel/plugin-proposal-object-rest-spread",
            "@babel/plugin-proposal-class-properties",
            "babel-plugin-minify-dead-code-elimination"
        ],
        "comments": true
    };
};
