import fs from 'fs';
import path from 'path';
import { program } from 'commander';

const packageJson = fs.readFileSync('./package.json');

program
	.version(JSON.parse(packageJson).version || 0, '-v, --version')
	.usage('[OPTIONS]...')
	.option('-d, --debug', 'output logs to the console')
	.option('-p, --predefined', 'create a predefined-classes.txt for labelImg to consume')
	.option('-c, --card <value>', 'get images for a single card, e.g. -c HighEvolutionary')
	.option('-a, --all', 'get images for all currently released cards')
	.parse(process.argv);

const options = program.opts();

function logger(...logs) {
	if (options.debug) {
		console.log(...logs);
	}
}

// Each directory in ./data represents a card
function getCardList() {
	const isDirectory = (filename) =>
		fs.lstatSync(path.join('./data', filename))
			.isDirectory();

	try {
		return fs.readdirSync('./data').filter(isDirectory);
	} catch (error) {
		logger('⚠️', 'Unable to read ./data directory');
	}
}

const cardList = getCardList();

// Generate `predefined-classes.txt`
if (options.predefined) {
	try {
		fs.writeFileSync('./data/predefined_classes.txt', cardList.join('\n'));
		logger('📁', './data/predefined_classes.txt');
	} catch (error) {
		logger('⚠️', error);
	}
}
