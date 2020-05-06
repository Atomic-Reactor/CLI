const npm = require('npm');
const tar = require('tar');
const path = require('path');
const chalk = require('chalk');
const fs = require('fs-extra');
const _ = require('underscore');
const op = require('object-path');
const request = require('request');
const mod = path.dirname(require.main.filename);
const targetApp = require(`${mod}/lib/targetApp`);
const ActionSequence = require('action-sequence');

module.exports = spinner => {
    let app, cwd, plugins;

    const actions = require('./actions')(spinner);

    op.del(actions, 'npm');
    op.del(actions, 'complete');
    op.del(actions, 'registerPkg');

    const message = text => {
        if (spinner) {
            spinner.text = text;
        }
    };

    const normalize = (...args) => path.normalize(path.join(...args));

    return {
        init: ({ params, props }) => {
            cwd = op.get(props, 'cwd');
            app = targetApp(cwd);
        },
        plugins: () => {
            const pkgPath = normalize(cwd, 'package.json');
            const pkg = require(pkgPath);
            const depKey = `${app}Dependencies`;
            const deps = op.get(pkg, depKey);

            plugins = Object.entries(deps).map(
                ([name, version]) => `${name}@${version}`,
            );

            plugins.sort();
        },
        install: async ({ params, props }) => {
            for (const i in plugins) {
                const name = plugins[i];

                spinner.stopAndPersist({
                    text: `Installing ${chalk.cyan(name)}...`,
                    symbol: chalk.cyan('+'),
                });

                await ActionSequence({
                    actions,
                    options: { params: { ...params, name, unattended: true }, props },
                });
            }
        },
        complete: () => {
            console.log('');
            spinner.start();
            spinner.succeed(`Installed:`);
            spinner.stop();
            plugins.forEach(plugin => console.log('   ', chalk.cyan(plugin)));
        }
    };
};
