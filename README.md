# Slack Exporter

Chrome extension to export your chat history on Slack.

__Not affiliated with Slack, not supported by Slack.__

## Overview

This Chrome extension exports your Slack history to your Dropbox folder.

## Status

Even though it works, it's still a prototype. Feel free to help.

## Development
Dependencies:
It's necessary to install jspm first:

    npm install jspm -g
    jspm install

Build:

    gulp

And install in Chrome from `build` directory.

Watch file and rebuild when saving:

    gulp watch

Build zip for deployment:

    gulp zip
