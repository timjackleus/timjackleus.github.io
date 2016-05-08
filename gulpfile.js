'use strict';

const config = require('./gulp.config.json'),
      gulp = require('gulp'),
      gulpif = require('gulp-if'),
      fileinclude = require('gulp-file-include'),
      htmlmin = require('gulp-htmlmin'),
      concat = require('gulp-concat'),
      source = require('vinyl-source-stream'),
      stream = require('event-stream'),
      watchify = require('watchify'),
      browserify = require('browserify'),
      buffer = require('vinyl-buffer'),
      babel = require('babelify'),
      uglify = require('gulp-uglify'),
      size = require('gulp-size'),
      sourcemaps = require('gulp-sourcemaps'),
      cssnext = require('postcss-cssnext'),
      notify = require('gulp-notify'),
      postcss = require('gulp-postcss'),
      cssimport = require('postcss-easy-import'),
      cssnested = require('postcss-nested'),
      mqpacker = require('css-mqpacker'),
      cssnano = require('gulp-cssnano'),
      rename = require("gulp-rename"),
      browserSync = require('browser-sync').create();

let env = process.env.NODE_ENV;

// Set up server
gulp.task('browser-sync', () => {
  browserSync.init({
    open: false,
    //ghostMode: false,
    server: config['server-root'],
    port: config['server-port']
  });
});

// Bundle all html files
gulp.task('fileinclude', () => {
  return gulp.src([config['source-html']])
    .pipe(fileinclude({
      prefix: '@@',
      basepath: '@file'
    }))
    .on('error', notify.onError({
      message: 'Fileinclude error: <%= error.message %>'
    }))
    .pipe(gulpif(env === 'production', htmlmin({
      collapseWhitespace: true,
      removeComments: true
    })))
    .pipe(gulp.dest(config['target-html']))
    .pipe(browserSync.reload({stream:true}));
});

// Styles task
gulp.task('styles', () => {
  return gulp.src(config['source-css'])
    .pipe(sourcemaps.init())
    .pipe(postcss([
      cssimport,
      cssnested,
      mqpacker,
      cssnext
    ]))
    .pipe(gulpif(env === 'production', cssnano({ zindex: false })))
    .pipe(gulpif(env === 'production', rename('main.min.css')))
    .pipe(gulpif(env === 'development', sourcemaps.write('.')))
    .pipe(gulp.dest(config['target-css']))
    .pipe(gulpif(env === 'production', size({ title: 'css bundle size -->' })))
    .pipe(browserSync.stream({match: '**/*.css'}));
});

// Watch for changes
// css: livereload
// JS & html: page refresh
gulp.task('watch', ['browser-sync'], () => {
  gulp.watch(config['source-all-css-files'], ['styles']);
  gulp.watch(config['source-all-html-files'], ['fileinclude']);
  gulp.watch(config['source-all-js-files'], ['scripts']);
});

// Transpile ES2015 => ES5
// Bundle js
gulp.task('scripts', () => {
  const modules = browserify(config['source-js'], {
    debug: env === 'development'
  })
    .transform(babel, {presets: ['es2015']})
    .bundle()
    .on('error', notify.onError({
      message: 'Browserify error: <%= error.message %>'
    }))
    .pipe(source(config['target-js']))
    .pipe(gulp.dest('./'))
    .pipe(size({
      title: 'size of modules'
    }));
  stream.concat(modules).pipe(browserSync.reload({stream:true, once: true}));
});

// Compress JS files for production
gulp.task('compress', function() {
  return gulp.src(config['target-js'])
    .pipe(uglify())
    .on('error', notify.onError({
      message: 'Browserify error: <%= error.message %>'
    }))
    .pipe(size({
      title: 'js bundle size -->'
    }))
    .pipe(rename('build/js/main.min.js'))
    .pipe(gulp.dest('./'));
});

// Use npm scripts instead of gulp commands. -> package.json
gulp.task('dev', () => {gulp.start('styles', 'fileinclude', 'scripts');});
gulp.task('build', ['styles', 'fileinclude', 'compress']);
gulp.task('default', ['dev', 'watch']);