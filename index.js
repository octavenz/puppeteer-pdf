const _ = require('lodash');
const cli = require('commander');
const fileUrl = require('file-url');
const fs = require('fs');
const isUrl = require('is-url');
const puppeteer = require('puppeteer');

cli
    .version('1.3.0')
    .option('-p, --path <path>', 'The file path to save the PDF to.')
    .option('-s, --scale [scale]', 'Scale of the webpage rendering.', parseFloat, 1)
    .option('-dhf, --displayHeaderFooter', 'Display header and footer.', false)
    .option('-ht, --headerTemplate [template]', 'HTML template for the print header.')
    .option('-ft, --footerTemplate [template]', 'HTML template for the print footer.')
    .option('-pb, --printBackground', 'Print background graphics.', false)
    .option('-l, --landscape', 'Paper orientation.', false)
    .option('-pr, --pageRanges <range>', "Paper ranges to print, e.g., '1-5, 8, 11-13'. Defaults to the empty string, which means print all pages.")
    .option('-f, --format [format]', "Paper format. If set, takes priority over width or height options. Defaults to 'Letter'.", 'Letter')
    .option('-w, --width [width]', 'Paper width, accepts values labeled with units.')
    .option('-h, --heigh [height]', 'Paper height, accepts values labeled with units.')
    .option('-mt, --marginTop [margin]', 'Top margin, accepts values labeled with units.')
    .option('-mr, --marginRight [margin]', 'Right margin, accepts values labeled with units.')
    .option('-mb, --marginBottom [margin]', 'Bottom margin, accepts values labeled with units.')
    .option('-ml, --marginLeft [margin]', 'Left margin, accepts values labeled with units.')
    .option('-d, --debug', 'Output Puppeteer PDF options and log I/O.')
    .option('-wu, --waitUntil [choice]', "waitUntil accepts choices load, domcontentloaded, networkidle0, networkidle2. Defaults to 'networkidle2'.", 'networkidle2')
    .option('-dl, --delay <milliseconds>', 'number of additional milliseconds to wait before rendering pdf', parseInt, 0)
    .option('-em, --emulateMediaType <mediatype>', 'print or screen. defaults to print', 'print')
    .parse(process.argv);

(async () => {
    const options = {};

    // Loop through options
    _.each(cli.options, (option) => {
        const optionName = option.name();
        if (!_.isNil(cli[optionName]) && !['version'].includes(optionName)) {
            const optionValue = cli[optionName];

            if (_.startsWith(optionName, 'margin')) {
                // Margins need to be combined into an object
                _.set(
                    options,
                    ['margin', optionName.replace('margin', '').toLowerCase()],
                    optionValue
                );
            } else {
                _.set(options, optionName, optionValue);
            }
        }
    });

    // Check if we need to read header or footer templates from files
    _.each(['headerTemplate', 'footerTemplate'], (template) => {
        if (_.get(options, template, '').startsWith('file://')) {
            options[template] = fs.readFileSync(
                options[template].replace('file://', ''),
                'utf-8'
            );
        }
    });

    try {
        const browser = await puppeteer.launch({
            dumpio: cli.debug,
            args: ['--no-sandbox'],
        });

        const page = await browser.newPage();

        // Get URL / file path from first argument
        const location = _.first(cli.args);
        await page.goto(isUrl(location) ? location : fileUrl(location), {
            waitUntil: _.get(options, 'waitUntil', 'networkidle2'),
        });


        if (options.emulateMediaType) {
            await page.emulateMediaType(_.get(options, 'emulateMediaType', 'screen'));
        }

        // Output options if in debug mode
        if (cli.debug) {
            console.log(options);
        }

        if (options.delay) {
            await page.waitFor(options.delay);
        }

        await page.pdf(options);
        await browser.close();
    } catch (exception) {
        // make sure this thing dies if it catches an error
        console.log(exception)
        process.exit(1)
    }

})();
