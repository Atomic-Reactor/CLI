
const fs         = require('fs-extra');
const path       = require('path');
const op         = require('object-path');
const request    = require('request');
const decompress = require('decompress');
const zip        = require('folder-zipper');

module.exports = (spinner) => {
    const message = (text) => {
        if (spinner) {
            spinner.text = text;
        }
    };

    return {
        download: ({ params, props, action }) => {
            const { config, cwd } = props;

            message('downloading payload, this may take awhile...');

            // Create the tmp directory if it doesn't exist.
            fs.ensureDirSync(path.normalize(`${cwd}/tmp/update`));

            // Download the most recent version of reactium
            return new Promise((resolve, reject) => {
                request(config.reactium.repo)
                .pipe(fs.createWriteStream(path.normalize(`${cwd}/tmp/reactium.zip`)))
                .on('error', error => reject(error))
                .on('close', () => resolve({ action, status: 200 }));
            });
        },

        unzip: ({ params, props, action }) => {
            const { config, cwd } = props;

            message('unpacking...');

            const zipFile = path.normalize(`${cwd}/tmp/reactium.zip`);
            const updateDir = path.normalize(`${cwd}/tmp/update`);

            // Create the update directory
            fs.ensureDirSync(updateDir);

            return new Promise((resolve, reject) => {
                decompress(zipFile, updateDir, {strip: 1})
                .then(() => resolve({ action, status: 200 }))
                .catch(error => reject(error));
            });
        },

        backup: ({ params, props, action }) => {
            const { cwd } = props;

            message('backing up core...');

            const now           = Date.now();
            const coreDir       = path.normalize(`${cwd}/.core`);
            const packageFile   = path.normalize(`${cwd}/package.json`);
            const backupDir     = path.normalize(`${cwd}/.BACKUP/update`);
            const coreBackup    = path.normalize(`${backupDir}/${now}.core.zip`);
            const packageBackup = path.normalize(`${backupDir}/${now}.package.json`);

            // Create the backup directory
            fs.ensureDirSync(backupDir);

            // Backup the package.json file
            fs.copySync(packageFile, packageBackup);

            // Backup the ~/.core directory
            return zip(coreDir, coreBackup).then(() => {
                return { action, status: 200 } ;
            });
        },

        core: ({ params, props, action }) => {
            const { cwd } = props;

            message('updating core...');

            const coreDir   = path.normalize(`${cwd}/.core/`);
            const updateDir = path.normalize(`${cwd}/tmp/update/.core/`);

            fs.ensureDirSync(coreDir);
            fs.emptyDirSync(coreDir);

            return new Promise((resolve, reject) => {
                fs.copy(updateDir, coreDir, error => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve({ action, status: 200 });
                    }
                });
            });
        },

        package: ({ params, props, action }) => {
            const { cwd } = props;
            const { package } = params;

            message('updating package.json...');

            const packageFile = path.normalize(`${cwd}/package.json`);

            return new Promise((resolve, reject) => {
                fs.writeFile(packageFile, package, 'utf8', error => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve({ action, status: 200 });
                    }
                });
            });
        },

        cleanup: ({ params, props, action }) => {
            const { config, cwd } = props;

            message('removing temp files...');

            return new Promise((resolve, reject) => {
                fs.remove(path.normalize(`${cwd}/tmp`), error => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve({ action, status: 200 });
                    }
                });
            });
        }
    };
}
