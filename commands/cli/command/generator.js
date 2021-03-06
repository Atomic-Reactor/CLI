
const ora = require('ora');
const ActionSequence = require('action-sequence');


const spinner = ora({
    spinner : 'dots',
    color   : 'cyan'
});

const actions = require('./actions')(spinner);

module.exports = ({ params, props }) => {
    console.log('');
    spinner.start();

    return ActionSequence({
        actions,
        options: { params, props }
    }).then((success) => {
        spinner.start();
        spinner.succeed('Command creation complete!');
        console.log('');
        return success;
    }).catch((error) => {
        spinner.start();
        spinner.fail('Command creation error!');
        console.log(error);
        return error;
    });
};
