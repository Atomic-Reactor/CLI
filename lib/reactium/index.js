'use strict';


/**
 * -----------------------------------------------------------------------------
 * Imports
 * -----------------------------------------------------------------------------
 */
const chalk           = require('chalk');
const path            = require('path');
const fs              = require('fs-extra');
const slugify         = require('slugify');
const _               = require('underscore');
const prompt          = require('prompt');
const request         = require('request');
const decompress      = require('decompress');
const ProgressBar     = require('progress');
const ora             = require('ora');
const Handlebars      = require('handlebars');
const open            = require('open');
const log             = console.log.bind(console);


String.prototype.capitalize = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
};

// The module
module.exports = config => {
    const base    = config.base;
    const dirname = config.dirname;
    const prefix  = chalk.cyan('[reactium]');
    const gulpBin = config.base + '/node_modules/gulp/bin/gulp.js';
    const types   = ['function', 'class', 'actions', 'types', 'reducers', 'services', 'router', 'style', 'state'];

    const injections = [
        {name: 'index',       file: 'index.js',        template: null},
        {name: 'router',       file: 'route.js',       template: 'route.hbs'},
        {name: 'actions',     file: 'actions.js',      template: 'actions.hbs'},
        {name: 'types',       file: 'actionTypes.js',  template: 'actionTypes.hbs'},
        {name: 'reducers',    file: 'reducers.js',     template: 'reducers.hbs'},
        {name: 'services',    file: 'services.js',     template: 'services.hbs'},
        {name: 'state',       file: 'state.js',        template: 'state.hbs'}
    ];

    const generate = (type, opt) => {
        // Validate the <type> value
        if (validType(type) !== true) {
            log(prefix, chalk.red('re:gen error:'), `<type> must be ${types.join(',')}`);
            return;
        }

        type = String(type).toLowerCase();

        switch (type) {
            case 'class':
            case 'function':
                compGen.prompt(type, opt);
                break;

            case 'style':
                styleGen.prompt(type, opt);
                break;

            default:
                fileGen.prompt(type, opt);
                break;
        }
    };

    const fileGen = {
        prompt: (type, opt) => {
            let schema = {
                properties: {
                    name: {
                        required       : true,
                        description    : chalk.yellow('Component:'),
                        message        : 'Component name is required',
                        before         : (val) => {
                            val = String(val).replace(/\W/, '');
                            val = String(val).capitalize();
                            return val;
                        }
                    }
                }
            };

            prompter(type, opt, schema, fileGen.create);
        },

        create: (type, opt) => {
            log('');

            let bar           = new ProgressBar(chalk.green(':bar') + ' :percent', {
                complete      : chalk.bgGreen(' '),
                incomplete    : ' ',
                width         : 20,
                total         : 2
            });
            let id            = String(slugify(opt.name, '_')).toLowerCase();
            let context  = {
                id          : id,
                name        : opt.name,
                route       : opt.route,
                ID_UPPER    : String(id).toUpperCase(),
            };

            // 1. Create the component directory
            let cpath;
            if (opt.hasOwnProperty('path')) {
                cpath = opt.path;
            } else {
                let dir = (opt.hasOwnProperty('component')) ? opt.component : opt.name;
                cpath = path.join(base, 'src/app/components', dir);
            }
            cpath = path.normalize(cpath);

            fs.ensureDirSync(cpath);
            bar.tick();

            // 2. Create the files
            let item = _.findWhere(injections, {name: type});

            let file = `${cpath}/${item.file}`;
                file = path.normalize(file);

            if (!fs.existsSync(file) || opt.hasOwnProperty('overwrite')) {
                let template    = String(`${config.reactium.templates}/${item.template}`).replace('[dirname]', config.dirname);
                    template    = path.normalize(template);
                let cont        = fs.readFileSync(template, 'utf-8');
                let hbs         = Handlebars.compile(cont);

                fs.writeFileSync(file, hbs(context));
                if (opt.overwrite) {
                    bar.interrupt(`  overwrote ${item.file} file`);
                } else {
                    bar.interrupt(`  created ${item.file} file`);
                }

                if (opt.open) {
                    open(path.resolve(base, file));
                }
            } else {
                bar.interrupt(`  ${chalk.red(item.file)} file already exists. Specify the --overwrite flag to replace the existing file.`);
            }
            bar.interrupt('');
            bar.tick();
        }
    };

    const compGen = {
        prompt: (type, opt) => {
            let schema = {
                properties: {
                    name: {
                        required       : true,
                        description    : chalk.yellow('Name:'),
                        message        : 'Name is required',
                        before         : (val) => {
                            val = String(val).replace(/\s+/g, '');
                            val = String(val).replace(/\W/, '');
                            val = String(val).capitalize();
                            return val;
                        }
                    },
                }
            };

            if (type === 'class') {
                schema.properties['redux'] = {
                    description    : chalk.yellow('Use Redux?  (Y/N):'),
                    before         : (val) => {
                        return (String(val).toLowerCase() !== 'n');
                    }
                };

                if (opt.router !== false) {
                    schema.properties['route'] = {
                        description: chalk.yellow('Route:'),
                        before: (val) => {
                            return (String(val).length < 1) ? undefined : val;
                        }
                    };
                }
            } else {
                opt['redux'] = false;
            }

            if (opt.hasOwnProperty('component')) {
                delete schema.properties.route;
            }

            prompter(type, opt, schema, compGen.create);
        },

        create: (type, opt) => {
            log('');

            if (typeof opt['route'] === undefined) {
                delete opt.route;
            }

            opt.name = String(opt.name).replace(/\W/, '');
            opt.name = String(opt.name).capitalize();
            opt.name = String(opt.name).replace(/\s+/g, '');

            let bar      = new ProgressBar(chalk.green(':bar') + ' :percent', {
                complete      : chalk.bgGreen(' '),
                incomplete    : ' ',
                width         : 20,
                total         : injections.length + 1,
            });
            let id       = String(slugify(opt.name, '_')).toLowerCase();
            let context  = {
                id          : id,
                name        : opt.name,
                ID_UPPER    : String(id).toUpperCase(),
            };

            if (opt.hasOwnProperty('route')) {
                context['route'] = path.normalize(opt.route);
            }

            // 1. Create the component directory
            let cpath;
            if (opt.hasOwnProperty('path')) {
                cpath = opt.path;
            } else {
                let dir = (opt.hasOwnProperty('component')) ? opt.component : opt.name;
                cpath = path.join(base, 'src/app/components', dir);
            }
            cpath = path.normalize(cpath);

            fs.ensureDirSync(cpath);
            bar.tick();

            opt.redux = (type === 'function' || opt.hasOwnProperty('component')) ? false : opt.redux;

            // 2. Create the files
            injections.forEach((item, i) => {

                if (opt.redux !== true && (item.name !== 'index' && item.name !== 'route')) {
                    if (i === injections.length - 1) { bar.interrupt(''); }
                    bar.tick();
                    return;
                }

                if (item.name === 'router' && !opt.route) {
                    if (i === injections.length - 1) { bar.interrupt(''); }
                    bar.tick();
                    return;
                }

                if (opt.hasOwnProperty(item.name)) {
                    if (opt[item.name] !== true) {
                        if (i === injections.length - 1) { bar.interrupt(''); }
                        bar.tick();
                        return;
                    }
                }

                if (item.name === 'index') {
                    item['template'] = (opt.redux !== true) ? `component-${type}.hbs` : `component-${type}-redux.hbs`;
                }

                item.file = (opt.hasOwnProperty('component')) ? `${opt.name}.js` : item.file;
                let file = `${cpath}/${item.file}`;
                    file = path.normalize(file);

                if (!fs.existsSync(file) || opt.hasOwnProperty('overwrite')) {
                    let template    = String(`${config.reactium.templates}/${item.template}`).replace('[dirname]', config.dirname);
                        template    = path.normalize(template);
                    let cont        = fs.readFileSync(template, 'utf-8');
                    let hbs         = Handlebars.compile(cont);

                    fs.writeFileSync(file, hbs(context));

                    if (opt.overwrite) {
                        bar.interrupt(`  overwrote ${item.file} file`);
                    } else {
                        bar.interrupt(`  created ${item.file} file`);
                    }

                    if (opt.open && item.name === 'index') {
                        open(path.resolve(base, file));
                    }

                } else {
                    bar.interrupt(`  ${chalk.red(item.file)} file already exists. Specify the --overwrite flag to replace the existing file.`);
                }

                if (i === injections.length - 1) { bar.interrupt(''); }
                bar.tick();
            });

            log('');
        }
    };

    const styleGen = {
        prompt: (type, opt) => {
            let schema = {
                properties: {
                    name: {
                        required       : true,
                        description    : chalk.yellow('Name:'),
                        message        : 'Name is required',
                        before         : (val) => {
                            val = String(val).replace(/\W/, '');
                            val = String(val).capitalize();
                            return val;
                        }
                    }
                }
            };

            prompter(type, opt, schema, styleGen.create);
        },

        create: (type, opt) => {
            let bar  = new ProgressBar(chalk.green(':bar') + ' :percent', {
                complete      : chalk.bgGreen(' '),
                incomplete    : ' ',
                width         : 20,
                total         : 3
            });
            bar.interrupt('');

            let dest = (opt.hasOwnProperty('path')) ? opt.path : config.reactium.style.dest;
                dest = path.normalize(dest);

            let entries = path.normalize(config.reactium.style.entries);

            let template    = String(`${config.reactium.templates}/style-${config.reactium.style.ext}.hbs`).replace('[dirname]', config.dirname);
                template    = path.normalize(template);
            let cont        = fs.readFileSync(template, 'utf-8');
            let hbs         = Handlebars.compile(cont);
            let fname       = `_${opt.name}.${config.reactium.style.ext}`;
            let file        = path.join(dest, fname);
            let context     = {name: opt.name};

            fs.ensureDirSync(path.join(base, dest));
            bar.tick();

            if (!fs.existsSync(path.join(base, file)) || opt.hasOwnProperty('overwrite')) {
                fs.writeFileSync(path.join(base, file), hbs(context));

                if (opt.overwrite) {
                    bar.interrupt(`  overwrote ${path.parse(file).name}${path.parse(file).ext} file`);
                } else {
                    bar.interrupt(`  created ${path.parse(file).name}${path.parse(file).ext} file`);
                }

                bar.tick();
            } else {
                bar.interrupt(`${chalk.red(fname)} file already exists. Specify the --overwrite flag to replace the existing file.`);
                bar.complete();
                return;
            }

            if (fs.existsSync(path.join(base, entries))) {
                let earr = entries.split(path.sep);
                earr.pop();
                let pre = file.replace(earr.join(path.sep), '');
                    pre = pre.replace(fname, '');
                    pre = pre.replace(/\W/, '');

                let mcont = fs.readFileSync(path.join(base, entries), 'utf-8');

                mcont += '\n\n';
                mcont += `@import '${pre}${opt.name}';`;

                fs.writeFileSync(path.join(base, entries), mcont);

                bar.interrupt(`  updated ${path.parse(entries).name}${path.parse(entries).ext} file`);
            }
            bar.interrupt('');
            bar.tick();
            log('');

            open(path.join(base, file));
        }
    };

    const install = {
        spinner: null,

        init: (opt) => {

            let contents = [];

            fs.readdirSync(base).forEach((dir) => { if (dir.substr(0, 1) !== '.') { contents.push(dir); } });

            if (contents.length > 0 && !opt.hasOwnProperty('overwrite')) {
                install.prompt(opt);
            } else {
                opt.overwrite = true;
                opt.confirm = true;
                install.start(null, opt);
            }
        },

        prompt: (opt) => {
            let schema = {
                properties: {
                    overwrite: {
                        description    : chalk.yellow('The current directory is not empty. Overwrite?   (Y/N):'),
                        before         : (val) => {
                            return (String(val).toLowerCase() === 'y');
                        }
                    },
                    confirm: {
                        description     : chalk.yellow('Are you sure?  (Y/N):'),
                        before          : (val) => {
                            return (String(val).toLowerCase() === 'y');
                        }
                    }
                }
            };

            prompter('install', opt, schema, install.start);
        },

        start: (type, opt) => {
            if (opt.overwrite !== true && opt.confirm !== true) {
                log(prefix, chalk.red('install cancelled'));
                return;
            }

            install.spinner = ora({
                text:    'downloading, this may take awhile...',
                spinner: 'dots',
                color:   'green'
            }).start();

            // Create the tmp directory if it doesn't exist.
            fs.ensureDirSync(`${base}/tmp`);

            // Download the most recent version of butter
            request(config.reactium.install)
            .pipe(fs.createWriteStream(`${base}/tmp/reactium.zip`))
            .on('close', function () {
                install.spinner.text = 'download complete!';

                // next -> unzip
                setTimeout(install.unzip, 2000, opt);
            });
        },

        unzip: () => {
            install.spinner.text = 'unpacking...';

            decompress(`${base}/tmp/reactium.zip`, base, {strip: 1}).then(() => {
                // Delete the tmp directory
                fs.removeSync(`${base}/tmp`);
                install.complete();
            });
        },

        complete: () => {
            install.spinner.succeed('install complete!');
            log(prefix, 'run: `npm run launch` to start the development environment');
        }
    };

    const validType = (type) => {
        if (!type) { return false; }
        type = String(type).toLowerCase();
        return (types.indexOf(type) > -1);
    };

    const prompter = (type, opt, schema, callback) => {
        let params = {};

        log('');

        let excludes = ['commands', 'options', 'parent'];

        Object.entries(opt).forEach(([key, val]) => {
            if (excludes.indexOf(key) > -1 || String(key).charAt(0) === '_') { return; }

            if (opt.hasOwnProperty(key)) {
                params[key] = val;
            } else {
                delete params[key];
            }
        });

        prompt.message   = prefix + ' > ';
        prompt.override  = params;
        prompt.delimiter = ' ';
        prompt.start();
        prompt.get(schema, (err, result) => {
            if (err) {
                log(prefix, chalk.red('error:'), err);
                process.exit();
            } else {
                _.keys(result).forEach((key) => { params[key] = result[key]; });
                callback(type, params);
            }
        });
    };

    const help = {
        generate: () => {
            log('  Examples:');
            log('    $ re:gen class --overwrite --name "MyClassComponent" --no-reducers --no-actions --no-types --no-services');
            log('    $ re:gen function --overwrite --name "MyFunctionalComponent');
            log('    $ re:gen child --name "MyChildComponent" --parent "MyClassComponent"');
            log('    $ re:gen actions --component "MyClassComponent"');
            log('    $ re:gen types --component "MyClassComponent"');
            log('    $ re:gen reducers --component "MyClassComponent"');
            log('    $ re:gen services --component "MyClassComponent"');
            log('    $ re:gen route --component "MyComponent"');
            log('');
        },

        install: () => {
            log('  Examples:');
            log('    $ re:gen install --overwrite');
            log('');
        }
    };

    return {
        "install": install.init,
        generate,
        types,
        help,
    }
};