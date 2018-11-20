/**
 * -----------------------------------------------------------------------------
 * Imports
 * -----------------------------------------------------------------------------
 */

const chalk              = require('chalk');
const generator          = require('./generator');
const prettier           = require('prettier');
const path               = require('path');
const mod                = path.dirname(require.main.filename);
const { error, message } = require(`${mod}/lib/messenger`);


/**
 * NAME String
 * @description Constant defined as the command name. Value passed to the commander.command() function.
 * @example $ arcli reactium empty
 * @see https://www.npmjs.com/package/commander#command-specific-options
 * @since 2.0.0
 */
const NAME = 'reactium:empty';


/**
 * DESC String
 * @description Constant defined as the command description. Value passed to
 * the commander.desc() function. This string is also used in the --help flag output.
 * @see https://www.npmjs.com/package/commander#automated---help
 * @since 2.0.0
 */
const DESC = 'Remove Reactium demo pages, components, and toolkit.';


/**
 * CANCELED String
 * @description Message sent when the command is canceled
 * @since 2.0.0
 */
const CANCELED = 'Reactium empty canceled!';


/**
 * confirm({ props:Object, params:Object }) Function
 * @description Prompts the user to confirm the operation
 * @since 2.0.0
 */
const CONFIRM = ({ props, params }) => {
    const { prompt } = props;

    return new Promise((resolve, reject) => {
        prompt.get({
            properties: {
                confirmed: {
                    description: `${chalk.white('Proceed?')} ${chalk.cyan('(Y/N):')}`,
                    type: 'string',
                    required: true,
                    pattern: /^y|n|Y|N/,
                    message: ` `,
                    before: (val) => {
                        return (String(val).toLowerCase() === 'y');
                    }
                }
            }
        }, (error, input) => {
            let confirmed;

            try {
                confirmed = input.confirmed;
            } catch (err) {
                confirmed = false;
            }

            if (error || confirmed === false) {
                reject(error);
            } else {
                resolve(confirmed);
            }
        });
    });
};


/**
 * conform(input:Object) Function
 * @description Reduces the input object.
 * @param input Object The key value pairs to reduce.
 * @since 2.0.0
 */
const CONFORM = ({ input, props }) => {
    const { cwd } = props;

    let output = {};

    Object.entries(input).forEach(([key, val]) => {
        switch(key) {
            default:
                output[key] = val;
                break;
        }
    });

    return output;
};


/**
 * HELP Function
 * @description Function called in the commander.on('--help', callback) callback.
 * @see https://www.npmjs.com/package/commander#automated---help
 * @since 2.0.0
 */
const HELP = () => {
    console.log('');
    console.log('Usage:');
    console.log('');
    console.log(' Keep the default toolkit:');
    console.log('  $ arcli reactium empty --no-toolkit');
    console.log('');
    console.log(' Keep the demo site:');
    console.log('  $ arcli reactium empty --no-demo');
    console.log('');
};


/**
 * SCHEMA Function
 * @description used to describe the input for the prompt function.
 * @see https://www.npmjs.com/package/prompt
 * @since 2.0.0
 */
const SCHEMA = ({ props }) => {
    const { cwd, prompt } = props;

    return {
        properties: {
            // sample: {
            //     description: chalk.white('Sample:'),
            //     required: true,
            //     default: true,
            // },
        }
    }
};


/**
 * ACTION Function
 * @description Function used as the commander.action() callback.
 * @see https://www.npmjs.com/package/commander
 * @param opt Object The commander options passed into the function.
 * @param props Object The CLI props passed from the calling class `orcli.js`.
 * @since 2.0.0
 */
const ACTION = ({ opt, props }) => {
    console.log('');

    const { cwd, prompt } = props;

    const schema = SCHEMA({ props });

    const ovr = ['demo', 'toolkit'].reduce((obj, key) => {
        let val = opt[key];
        val = (typeof val === 'function') ? null : val;
        if (val) { obj[key] = val; }
        return obj;
    }, {});


    prompt.override = ovr;
    prompt.start();
    prompt.get(schema, (err, input) => {
        // Keep this conditional as the first line in this function.
        // Why? because you will get a js error if you try to set or use anything related to the input object.
        if (err) {
            prompt.stop();
            error(`${NAME} ${err.message}`);
            return;
        }

        const params = { ...CONFORM({ input, props }), ...ovr };

        CONFIRM({ props, params }).then(() => {
            console.log('');
            generator({ params, props }).then(success => {
                console.log('');
            });
        }).catch(err => {
            prompt.stop();
            message(CANCELED);
        });
    });
};


/**
 * COMMAND Function
 * @description Function that executes program.command()
 */
const COMMAND = ({ program, props }) => program.command(NAME)
    .description(DESC)
    .action(opt => ACTION({ opt, props }))
    .option('-D, --no-demo [demo]', 'Keep the demo site and components.')
    .option('-T, --no-toolkit [toolkit]', 'Keep the default toolkit elements.')
    .on('--help', HELP);


/**
 * Module Constructor
 * @description Internal constructor of the module that is being exported.
 * @param program Class Commander.program reference.
 * @param props Object The CLI props passed from the calling class `arcli.js`.
 * @since 2.0.0
 */
module.exports = {
    ACTION,
    CONFIRM,
    CONFORM,
    COMMAND,
    NAME,
};
