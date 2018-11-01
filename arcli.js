#!/usr/bin/env node

'use strict';

// Imports
const config      = require(__dirname + "/config.json");
const ver         = require('./package').version;
const chalk       = require('chalk');
const path        = require('path');
const fs          = require('fs');
const program     = require('commander');
const prompt      = require('prompt');
const globby      = require('globby').sync;
const op          = require('object-path');
const cwd         = path.resolve(process.cwd());


// Build the props object
const props     = { cwd, root: __dirname, prompt, config };

// Configure prompt
prompt.message   = chalk[config.prompt.prefixColor](config.prompt.prefix);
prompt.delimiter = config.prompt.delimiter;

// Initialize the CLI
program.version(ver, '-v, --version');
program.usage('<command> [options]');

// Find commands
const dirs  = config.commands || [];
const globs = dirs.map(dir => String(`${dir}/**/*index.js`)
    .replace(/\[root\]/gi, props.root)
    .replace(/\[cwd\]/gi, props.cwd)
);

/**
 * Since commands is an Object, you can replace pre-defined commands with custom ones.
 * The order in which commands are aggregated:
 * 1. CLI Root : ./commands
 * 2. Core     : ~/PROJECT/.core/.cli/commands -> overwrites CLI Root.
 * 3. Project  : ~/PROJECT/.cli/commands       -> overwrites CLI Root & Core.
 */
const commands = {};
globby(globs).forEach((cmd) => {
    const req = require(cmd);
    if (
        op.has(req, 'NAME') &&
        op.has(req, 'COMMAND') &&
        typeof req.COMMAND === 'function'
    ) {
        commands[req.NAME] = req;
    }
});

// Apply commands
Object.values(commands).forEach(req => req.COMMAND({ program, props }));


// Start the CLI
program.parse(process.argv);

// Output the help if nothing is passed
if (!process.argv.slice(2).length) {
    program.help();
}
