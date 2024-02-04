import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { program } from 'commander';

const packageJson = fs.readFileSync('./package.json');
const PREDEFINED_CLASSES_PATH = './data/predefined_classes.txt';

program
	.version(JSON.parse(packageJson).version || 0, '-v, --version')
	.usage('[OPTIONS]...')
	.option('-d, --debug', 'output logs to the console')
	.option('-c, --card <value>', 'single card, e.g. -c HighEvolutionary')
	.option('-a, --all', 'all currently released cards')
	.option('-i, --images', 'downloaded available card artwork')
	.option('-p, --predefined', 'create a predefined-classes.txt for labelImg')
	.option('-b, --bounding', 'create YOLO bounding box labels')
	.parse(process.argv);

const options = program.opts();

const instance = axios.create({
	baseURL: 'https://snapjson.untapped.gg/',
});

function logger(...logs) {
	if (options.debug) {
		console.log(...logs);
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
		const filePath = `${dir}/${variant}.webp`;
		createDir(dir);
		await response.data.pipe(
			fs.createWriteStream(filePath)
				.on('finish', () => {
					logger('📁', filePath);
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

function ls(filePath) {
	try {
		return fs.readdirSync(filePath);
	} catch (error) {
		logger('⚠️', error);
	}
}

// Defines a single bounding box per image covering the full card width and height
function createCardBoundingBoxes(card, index) {
	const cardPath = path.join('./data', card);
	const cardImages = ls(cardPath).filter((fileName) => path.extname(fileName) === '.webp');

	cardImages.forEach((fileName) => {
		try {
			const txtPath = path.join(cardPath, `${fileName.split('.')[0]}.txt`);
			fs.writeFileSync(txtPath, `${index} 0.5 0.5 1 1`);
			logger('📁', txtPath);
		} catch (error) {
			logger('⚠️', error);
		}
	});

	// Copy predefined_classes.txt into the directory as classes.txt
	try {
		const classesPath = path.join(cardPath, 'classes.txt');
		fs.copyFileSync(PREDEFINED_CLASSES_PATH, classesPath);
		logger('📁', classesPath);
	} catch (error) {
		logger('⚠️', error);
	}
}

// Get data for all currently released cards
const cards = await getCards();
const cardNames = cards.map(({ defId }) => defId);
const variants = await getArtVariants();

// Generate `predefined-classes.txt`
if (options.predefined) {
	try {
		fs.writeFileSync(PREDEFINED_CLASSES_PATH, cardNames.join('\n'));
		logger('📁', PREDEFINED_CLASSES_PATH);
	} catch (error) {
		logger('⚠️', error);
	}
}

// Get images for a single card
if (options.card) {
	if (!cardNames.includes(options.card)) {
		logger('⚠️', `${options.card}' is not recognized as a valid card name`);
	} else {
		if (options.images) {
			await getArtwork(options.card, [options.card, ...variants[options.card]]);
		}

		if (options.bounding) {
			createCardBoundingBoxes(options.card, cardNames.indexOf(options.card));
		}
	}
}

// Get images for all currently released cards
if (options.all) {
	if (options.images) {
		cardNames.forEach(
			async (card) => await getArtwork(card, [card, ...variants[card]])
		);
	}

	if (options.bounding) {
		cardNames.forEach(
			(card, index) => createCardBoundingBoxes(card, index)
		);
	}
}
