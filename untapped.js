import fs from 'fs';
import axios from 'axios';
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

const instance = axios.create({
	baseURL: 'https://snapjson.untapped.gg/',
});

function logger(...logs) {
	if (options.debug) {
		console.log(logs);
	}
}

async function getCards() {
	try {
		const response = await instance.get('/v2/latest/en/cards.json');
		return Array.from(response.data)
			.filter(({ series }) => series > 0); // Filter out test data
	} catch (error) {
		console.error('⚠️', error.toJSON());
	}
}

async function getArtVariants() {
	try {
		const response = await instance.get('/v2/latest/en/artVariants.json');
		const variants = {};
		Array.from(response.data)
			.forEach(({ defId, source }) => {
				if (source !== 0) { // Filter out test data
					const card = defId.split('_')[0];
					if (card) {
						variants[card] = variants[card] || [];
						variants[card].push(defId);
					}
				}
			});
		return variants;
	} catch (error) {
		console.error('⚠️', error.toJSON());
	}
}

function createDir(dir) {
	try {
		fs.accessSync(dir);
	} catch (e) {
		fs.mkdirSync(dir);
	}
}

// Recursive function to get all specified image variants
async function getArtwork(card, variants = []) {
	if (variants.length === 0) {
		return;
	}

	try {
		const variant = variants.shift();
		const response = await instance({
			url: `/art/render/framebreak/common/512/${variant}.webp`,
			responseType: 'stream',
		});

		const dir = `./data/${card}`;
		const filepath = `${dir}/${variant}.webp`;
		createDir(dir);
		await response.data.pipe(
			fs.createWriteStream(filepath)
				.on('finish', () => {
					logger('📁', filepath);
				})
				.on('error', (error) => {
					logger('⚠️', error);
				})
		);

		return getArtwork(card, variants);
	} catch (error) {
		logger('⚠️', error.toJSON());
	}
}

// Get data for all currently released cards
const cards = await getCards();
const cardNames = cards.map(({ defId }) => defId);
const variants = await getArtVariants();

// Generate `predefined-classes.txt`
if (options.predefined) {
	try {
		fs.writeFileSync('./data/predefined_classes.txt', cardNames.join('\n'));
		logger('📁', './data/predefined_classes.txt');
	} catch (error) {
		logger('⚠️', error);
	}
}

// Get images for a single card
if (options.card) {
	if (!cardNames.includes(options.card)) {
		logger('⚠️', `${options.card}' is not recognized as a valid card name`);
	} else {
		await getArtwork(options.card, [options.card, ...variants[options.card]]);
	}
}

// Get images for all currently released cards
if (options.all) {
	cards.forEach(
		async ({ defId }) => await getArtwork(defId, [defId, ...variants[defId]])
	);
}
