'use strict';

// Globals
const Actinium = require('parse/node');
global.Actinium = Actinium;

// Imports
const root = __dirname;
const config = require('./config');
const ver = require('./package').version;
const chalk = require('chalk');
const ora = require('ora');
const path = require('path');
const fs = require('fs-extra');
const globby = require('globby').sync;
const moment = require('moment');
const cwd = path.resolve(process.cwd());
const semver = require('semver');
const homedir = require('os').homedir();
const prettier = require('prettier');
const generator = require('./lib/generator');
const Hook = require('@atomic-reactor/reactium-sdk-core/lib/hook').default;

const spinner = ora({ spinner: 'dots', color: 'cyan' });
spinner.message = (...args) => spinner.start(args.join(' '));

const initialize = props => {

    // require arlic-hooks.js files
    globby([path.join(cwd, '/**/arcli-hooks.js')]).forEach(path =>
        require(path),
    );

    // Get application config
    const appConfigFile = path.normalize(`${cwd}/.core/.cli/config.json`);
    if (fs.existsSync(appConfigFile)) {
        const appConfig = require(appConfigFile);
        props.config = Object.assign(props.config, appConfig);
    }

    // Get local config
    const localConfigFile = path.join(homedir, '.arcli', 'config.json');
    if (fs.existsSync(localConfigFile)) {
        const localConfig = require(localConfigFile);
        props.config = Object.assign(props.config, localConfig);
    } else {
        // Create the localized config if it doesn't exist
        const contents = JSON.stringify(props.config, null, 2);
        fs.ensureFileSync(localConfigFile);
        fs.writeFileSync(localConfigFile, contents);
    }

    // Get project config
    const projConfigFile = path.normalize(`${cwd}/.cli/config.json`);
    if (fs.existsSync(projConfigFile)) {
        const projConfig = require(projConfigFile);
        props.config = Object.assign(props.config, projConfig);
    }

    return props;
};

// Glob the functions
const commands = () => {
    // Find commands
    const dirs = config.commands || [];
    const globs = dirs.map(dir =>
        // globby only allows posix separators
        path
            .normalize(
                String(`${dir}/**/*index.js`)
                    .replace(/\[root\]/gi, props.root)
                    .replace(/\[cwd\]/gi, props.cwd),
            )
            .split(/[\\\/]/g)
            .join(path.posix.sep),
    );

    return globby(globs);
};

// Build the props object
const props = initialize({ config, cwd, homedir, root, ver });

module.exports = {
    Actinium,
    Hook,
    chalk,
    commands,
    fs,
    path,
    generator,
    globby,
    homedir,
    moment,
    prettier,
    semver,
    spinner,
    props,
    tmp: path.normalize(path.join(homedir, 'tmp'))
};
