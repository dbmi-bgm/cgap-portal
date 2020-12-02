const gulp = require('gulp');
const path = require('path');
const { spawn } = require('child_process');
const PluginError = require('plugin-error');
const log = require('fancy-log');
const webpack = require('webpack');
const sass = require('node-sass');
const fs = require('fs');


function setProduction(done){
    process.env.NODE_ENV = 'production';
    done();
}

function setQuick(done){
    process.env.NODE_ENV = 'quick';
    done();
}

function setDevelopment(done){
    process.env.NODE_ENV = 'development';
    done();
}

function cleanBuildDirectory(done){
    const buildDir = "./src/encoded/static/build/";
    const pathsToDelete = [];
    fs.readdir(buildDir, function(err, files){
        files.forEach(function(fileName){
            if (fileName === ".gitignore") { // Skip
                return;
            }
            const filePath = path.resolve(buildDir, fileName);
            pathsToDelete.push(filePath);
        });

        const filesToDeleteLen = pathsToDelete.length;
        var countDeleted = 0;
        pathsToDelete.forEach(function(filePath){
            fs.unlink(filePath, function(err){
                countDeleted++;
                if (countDeleted === filesToDeleteLen) {
                    console.log("Cleaned " + countDeleted + " files from " + buildDir);
                    done();
                }
            });
        });
    });
}

function webpackOnBuild(done) {
    const start = Date.now();
    return function (err, stats) {
        if (err) {
            throw new PluginError("webpack", err);
        }
        log("[webpack]", stats.toString({
            colors: true
        }));
        const end = Date.now();
        log("Build Completed, running for " + ((end - start)/1000)) + 's';
        if (done) { done(err); }
    };
}

function doWebpack(cb){
    const webpackConfig = require('./webpack.config.js');
    webpack(webpackConfig).run(webpackOnBuild(cb));
}

function watch(done){
    const webpackConfig = require('./webpack.config.js');
    webpack(webpackConfig).watch(300, webpackOnBuild());
}

function getLinkedSharedComponentsPath(){
    let sharedComponentPath = path.resolve(__dirname, 'node_modules/@hms-dbmi-bgm/shared-portal-components');
    let isLinked = false;
    try { // Get exact path to dir, else leave. Used to avoid needing to webpack dependency itself.
        for (var i = 0; i < 10; i++) { // Incase multiple links.
            sharedComponentPath = fs.readlinkSync(sharedComponentPath);
            isLinked = true;
        }
    } catch (e){
        // ... not linked
    }

    console.log(
        "`@hms-dbmi-bgm/shared-portal-components` directory is",
        isLinked ? "sym-linked to `" + sharedComponentPath + "`." : "NOT sym-linked."
    );
    return { isLinked, sharedComponentPath : isLinked ? sharedComponentPath : null };
}

function buildSharedPortalComponents(done){
    const { isLinked, sharedComponentPath } = getLinkedSharedComponentsPath();

    if (!isLinked){ // Exit
        done();
        return;
    }

    // Same as shared-portal-components own build method
    const subP = spawn(
        path.join(sharedComponentPath, 'node_modules/.bin/babel'),
        [
            path.join(sharedComponentPath, 'src'),
            "--out-dir",
            path.join(sharedComponentPath, 'es'),
            "--env-name",
            "esm"
        ],
        { stdio: "inherit" }
    );

    subP.on("close", (code)=>{
        done();
    });

}

function watchSharedPortalComponents(done){
    const { isLinked, sharedComponentPath } = getLinkedSharedComponentsPath();

    if (!isLinked){ // Exit
        done();
        return;
    }

    // Same as shared-portal-components own build method, but with "--watch"
    const subP = spawn(
        path.join(sharedComponentPath, 'node_modules/.bin/babel'),
        [
            path.join(sharedComponentPath, 'src'),
            "--out-dir",
            path.join(sharedComponentPath, 'es'),
            "--env-name",
            "esm",
            "--watch"
        ],
        { stdio: "inherit" }
    );

    subP.on("close", (code)=>{
        done();
    });

}


// TODO: Just use command-line `node-sass` ?

const cssOutputLocation = './src/encoded/static/css/style.css';
const sourceMapLocation = "./src/encoded/static/css/style.css.map";

function doSassBuild(done, options = {}) {
    sass.render({
        file: './src/encoded/static/scss/style.scss',
        outFile: './src/encoded/static/css/style-map.css', // sourceMap location
        outputStyle: options.outputStyle || 'compressed',
        sourceMap: true
    }, function(error, result) { // node-style callback from v3.0.0 onwards
        if (error) {
            console.error("Error", error.status, error.file, error.line + ':' + error.column);
            console.log(error.message);
            done();
        } else {
            //console.log(result.css.toString());

            console.log("Finished compiling SCSS in", result.stats.duration, "ms");
            console.log("Writing to", cssOutputLocation);

            let countCompleted = 0;

            fs.writeFile(cssOutputLocation, result.css.toString(), null, function(err){
                if (err){
                    return console.error(err);
                }
                console.log("Wrote " + cssOutputLocation);
                countCompleted++;
                if (countCompleted === 2){
                    done();
                }
            });

            fs.writeFile(sourceMapLocation, result.map.toString(), null, function(err){
                if (err){
                    return console.error(err);
                }
                console.log("Wrote " + sourceMapLocation);
                countCompleted++;
                if (countCompleted === 2){
                    done();
                }
            });

        }
    });
}


const devQuick = gulp.series(
    cleanBuildDirectory,
    setQuick,
    doWebpack,
    gulp.parallel(watch, watchSharedPortalComponents)
);

const devAnalyzed = gulp.series(
    cleanBuildDirectory,
    setDevelopment,
    buildSharedPortalComponents,
    doWebpack
);

const build = gulp.series(
    cleanBuildDirectory,
    setProduction,
    doWebpack
);


//gulp.task('dev', devSlow);
//gulp.task('build-quick', buildQuick);
gulp.task('default', devQuick);
gulp.task('dev-quick', devQuick);
gulp.task('dev-analyzed', devAnalyzed);
gulp.task('build', build);

gulp.task('build-scss', (done) => doSassBuild(done, {}));
gulp.task('build-scss-dev', (done) => {
    doSassBuild(
        () => {
            console.log('Watching for changes (if ran via `npm run watch-scss`)');
            done();
        },
        { outputStyle : 'expanded' }
    );
});

