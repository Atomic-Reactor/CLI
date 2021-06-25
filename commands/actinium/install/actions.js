const path = require('path');
const chalk = require('chalk');
const fs = require('fs-extra');
const op = require('object-path');
const request = require('request');
const decompress = require('@atomic-reactor/decompress');

module.exports = spinner => {
    const message = text => {
        if (spinner) {
            spinner.text = text;
        }
    };

    const normalize = (...args) => path.normalize(path.join(...args));

    return {
        download: ({ params, props, action }) => {
            const { config, cwd } = props;

            message('downloading payload, this may take awhile...');

            // Create the tmp directory.
            fs.ensureDirSync(normalize(cwd, 'tmp'));

            // Download the most recent version of actinium
            return new Promise((resolve, reject) => {
                request(config.actinium.repo)
                    .pipe(
                        fs.createWriteStream(
                            normalize(cwd, 'tmp', 'actinium.zip'),
                        ),
                    )
                    .on('error', error => reject(error))
                    .on('close', () => resolve({ action, status: 200 }));
            });
        },

        unzip: ({ params, props, action }) => {
            const { config, cwd } = props;

            message('unpacking...');

            const zipFile = normalize(cwd, 'tmp', 'actinium.zip');

            return new Promise((resolve, reject) => {
                decompress(zipFile, cwd, { strip: 1 })
                    .then(() => resolve({ action, status: 200 }))
                    .catch(error => reject(error));
            });
        },

        cleanup: ({ params, props, action }) => {
            const { config, cwd } = props;

            message('removing temp files...');

            return new Promise((resolve, reject) => {
                fs.remove(normalize(cwd, 'tmp'), error => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve({ action, status: 200 });
                    }
                });
            });
        },

        npm: async ({ props }) => {
            if (spinner) spinner.stop();
            console.log('');
            console.log('Installing', chalk.cyan('Actinium'), 'dependencies...');
            console.log('');
            await arcli.runCommand('arcli', ['install']);
        }
    };
};
