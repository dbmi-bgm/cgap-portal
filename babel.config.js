
module.exports = function(api){
    api.cache(true);
    return {
        "presets" : [
            // We don't need to convert import/export statements.
            [ "@babel/preset-env", { "modules": false } ],
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
