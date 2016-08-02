const gulp = require('gulp');
const gulp_jspm = require('gulp-jspm');
const zip = require('gulp-zip');
const watch = require('gulp-watch');
const batch = require('gulp-batch');
const rename = require('gulp-rename');

gulp.task('default', [
  'build',
  'copy'
]);

gulp.task('watch', () => {
  watch('src/**/*', {
    ignoreInitial: false
  }, batch((events, done) => {
    gulp.start('default', done);
  }));
});

gulp.task('zip', ['default'], () => {
  return gulp.src('build/*')
    .pipe(zip('slack-exporter.zip'))
    .pipe(gulp.dest('dist'));
});

gulp.task('build', [
  'build:spy',
  'build:background'
]);

gulp.task('build:spy', () => {
  return gulp.src('src/spy/main.js')
    .pipe(gulp_jspm({
      selfExecutingBundle: true
    }))
    .pipe(rename('spy.js'))
    .pipe(gulp.dest('build/'));
});

gulp.task('build:background', () => {
  return gulp.src('src/background/main.js')
    .pipe(gulp_jspm({
      selfExecutingBundle: true
    }))
    .pipe(rename('background.js'))
    .pipe(gulp.dest('build/'));
});

gulp.task('copy', [
  'copy:vendor',
  'copy:manifest',
  'copy:injector',
  'copy:dropbox-oauth-receiver',
  'copy:popup'
]);

gulp.task('copy:vendor', () => {
  return gulp.src('vendor/*')
    .pipe(gulp.dest('build/vendor'));
});

gulp.task('copy:manifest', () => {
  return gulp.src('src/manifest.json')
    .pipe(gulp.dest('build/'));
});

gulp.task('copy:injector', function () {
  return gulp
    .src('src/injector.js')
    .pipe(gulp.dest('build'));
});

gulp.task('copy:dropbox-oauth-receiver', function () {
  return gulp
    .src('src/dropbox/*')
    .pipe(gulp.dest('build/dropbox'));
});

gulp.task('copy:popup', function () {
  return gulp
    .src('src/popup/*')
    .pipe(gulp.dest('build/popup'));
});
