/**
 * -----------------------------------------------------------------------------
 * Imports
 * -----------------------------------------------------------------------------
 */

const _ = require("underscore");
const fs = require("fs-extra");
const path = require("path");
const chalk = require("chalk");
const op = require("object-path");
const generator = require("./generator");
const globby = require("globby").sync;
const prettier = require("prettier");
const slugify = require("slugify");
const mod = path.dirname(require.main.filename);
const { error, message } = require(`${mod}/lib/messenger`);

const formatDestination = (val, props) => {
  const { cwd, root } = props;

  const replacers = [
    [/^~\/|^\/cwd\/|^cwd\//i, `${cwd}/.cli/commands/`],
    [/^\/app\/|^app\//i, `${cwd}/.core/.cli/commands/`],
    [/^\/core\/|^core\//i, `${cwd}/.core/.cli/commands/`],
    [/^\/root\/|^root\//i, `${root}/commands/`]
  ];

  return path.normalize(
    replacers.reduce(
      (newVal, replacer) => newVal.replace(replacer[0], replacer[1]),
      path.normalize(val)
    )
  );
};

/**
 * NAME String
 * @description Constant defined as the command name. Value passed to the commander.command() function.
 * @example $ arcli re:style --path '~/src/assets/style' --name 'style.scss'
 * @see https://www.npmjs.com/package/commander#command-specific-options
 * @since 2.0.0
 */
const NAME = "commander";

/**
 * DESC String
 * @description Constant defined as the command description. Value passed to
 * the commander.desc() function. This string is also used in the --help flag output.
 * @see https://www.npmjs.com/package/commander#automated---help
 * @since 2.0.0
 */
const DESC = "ARCLI:    Create a CLI function.";

/**
 * CANCELED String
 * @description Message sent when the command is canceled
 * @since 2.0.0
 */
const CANCELED = "Command creation canceled!";

/**
 * confirm({ props:Object, params:Object }) Function
 * @description Prompts the user to confirm the operation
 * @since 2.0.0
 */
const CONFIRM = ({ props, params }) => {
  const { prompt } = props;

  return new Promise((resolve, reject) => {
    prompt.get(
      {
        properties: {
          confirmed: {
            description: `${chalk.white("Proceed?")} ${chalk.cyan("(Y/N):")}`,
            type: "string",
            required: true,
            pattern: /^y|n|Y|N/,
            message: ` `,
            before: val => {
              return String(val).toLowerCase() === "y";
            }
          }
        }
      },
      (error, input) => {
        const confirmed = op.get(input, "confirmed");

        if (error || confirmed === false) {
          reject(error);
        } else {
          resolve(confirmed);
        }
      }
    );
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
    key = String(key).toLowerCase();

    switch (key) {
      case "destination":
        output[key] = formatDestination(val, props);
        break;

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
const HELP = () =>
  console.log(`
Shortcuts:
  When creating a command, there are 3 --destination shortcuts available:
  ${chalk.cyan("cwd/")} | ${chalk.cyan("app/")} | ${chalk.cyan("root/")}

    ${chalk.cyan("cwd/")}
      Creates a command in the ${chalk.cyan("~/project-root/.cli")} directory:
        $ arcli commander --command 'fubar' --destination '${chalk.cyan(
          "cwd/"
        )}fubar'

        ${chalk.cyan(
          "* Note:"
        )} commands created in the project-root are specific to the current project.

    ${chalk.cyan("app/")}
      Creates a command in the ${chalk.cyan(
        "~/project-root/.core/.cli"
      )} directory:
        $ arcli commander --command 'fubar' --destination '${chalk.cyan(
          "app/"
        )}fubar'

        ${chalk.cyan(
          "* Note:"
        )} commands created in the app directory are specific to the current project and version of the framework Reactium or Actinium.
          Should you update the framework core, your commands will be overwritten.
          It is recommended to only place commands in the app directory if you are contributing to Reactium or Actinium core.

    ${chalk.cyan("root/")}
      Creates a command in the ${chalk.cyan(
        "~/home/.arcli/commands"
      )} directory:
        $ arcli commander --command 'fubar' --destination '${chalk.cyan(
          "root/"
        )}fubar'

        ${chalk.cyan(
          "* Note:"
        )} commands created in the root directory or subject to being overwritten if you update ARCLI.
          It is recommended to only place commands in the root directory if you are contributing to ARCLI.
`);

/**
 * SCHEMA Object
 * @description used to describe the input for the prompt function.
 * @see https://www.npmjs.com/package/prompt
 * @since 2.0.0
 */
const SCHEMA = ({ props }) => {
  const { cwd, prompt } = props;
  const defaultDirectory = path.normalize("~/.cli/commands");

  return {
    properties: {
      command: {
        type: "string",
        description: chalk.white(`Command:`)
      },
      destination: {
        description: chalk.white("Destination:"),
        message: "Destination is a required parameter. Example: ~/mycommand",
        required: true
      },
      overwrite: {
        required: true,
        pattern: /^y|n|Y|N/,
        message: " ",
        description: chalk.white("Overwrite existing command?: (Y/N)"),
        ask: () => {
          try {
            let dest =
              prompt.override["destination"] ||
              prompt.history("destination").value;
            dest = formatDestination(dest, props);

            const filepath = path.normalize(path.join(dest, "index.js"));

            return fs.existsSync(filepath);
          } catch (err) {
            return false;
          }
        },
        before: val => {
          return String(val).toLowerCase() === "y";
        }
      }
    }
  };
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
  console.log("");

  const { cwd, prompt } = props;

  const schema = SCHEMA({ props });

  const ovr = Object.keys(schema.properties).reduce((obj, key) => {
    let val = opt[key];
    val = typeof val === "function" ? null : val;
    if (val) {
      obj[key] = val;
    }
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

    const params = CONFORM({ input, props });
    const { overwrite } = params;

    // Exit if overwrite or confirm !== true
    if (typeof overwrite === "boolean" && !overwrite) {
      prompt.stop();
      message(CANCELED);
      return;
    }

    message(`A command will be created with the following parameters:`);
    const preflight = { ...params };

    if (overwrite !== true) {
      delete preflight.overwrite;
    }

    console.log(
      prettier.format(JSON.stringify(preflight), { parser: "json-stringify" })
    );

    CONFIRM({ props, params })
      .then(() => {
        console.log("");

        generator({ params, props }).then(success => {
          console.log("");
        });
      })
      .then(() => prompt.stop())
      .catch(err => {
        prompt.stop();
        message(CANCELED);
      });
  });
};

/**
 * COMMAND Function
 * @description Function that executes program.command()
 */
const COMMAND = ({ program, props }) =>
  program
    .command(NAME)
    .description(DESC)
    .action(opt => ACTION({ opt, props }))
    .option(
      "-d, --destination [destination]",
      "Path where the command is saved"
    )
    .option("-c, --command [command]", "Command prompt.")
    .option(
      "-o, --overwrite [overwrite]",
      "Overwrite the existing command.",
      false
    )
    .on("--help", HELP);

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
  NAME
};
