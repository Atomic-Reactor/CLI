
const ora = require('ora');
const ActionSequence = require('action-sequence');


const spinner = ora({
    spinner : 'dots',
    color   : 'cyan'
});

const actions = require('./actions')(spinner);

module.exports = ({ params, props }) => {
    spinner.start('Reactium updating...');

    const { core } = params;

    if (core === true) {
        delete actions.babel;
        delete actions.gulpfile;
        delete actions.package;
        delete actions.backup;
    }

    return ActionSequence({
        actions,
        options: { params, props }
    }).then((success) => {
        spinner.succeed('Reactium update complete!');
        return success;
    }).catch((error) => {
        spinner.fail('Reactium update error!');
        return error;
    });
};
