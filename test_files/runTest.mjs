import fs from "fs";
import url from "url";
import path from "path";
import chalk from "chalk";
import fetch  from "node-fetch";
import logSymbols from "log-symbols";

// Globals
const log = console.log;
const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define test file
const test_file_arg = process.argv[2];

const checkOutputMatches = function (output, test_file_name) {
	let expectedOutputPath = __dirname + "/" + test_file_name + "/expected_return.json";

	if (fs.existsSync(expectedOutputPath)) {
		let expected_output = JSON.parse(
			fs.readFileSync(expectedOutputPath, "utf8")
		);
		let results_correct = true;

		Object.keys(expected_output).forEach((elem) => {
			let expected_value = expected_output[elem];
			let results_value = output[elem];

			if (output[elem] == undefined) {
				results_correct = false;
				log(logSymbols.warning, " Output missing key:", elem);
				return;
			} 

			if (expected_value.value != undefined && results_value.value != undefined) {

				if (output[elem] == undefined || output[elem].value == undefined) {
					results_correct = false;
					log(logSymbols.warning, " Output missing value for key:", elem);
				} 
				
				if (expected_value.value != results_value.value) {
					results_correct = false;
					log(
						logSymbols.warning,
						" Output value for key:",
						elem,
						"did not match expected result"
					);
				}
			}
			
		});

		return results_correct;
	} else {
		log(
			logSymbols.warning,
			chalk.whiteBright("No expected_return.json provided.")
		);
		return false;
	}
};

const saveTempOutput = function (input, output) {
	let tempDir = __dirname + "/temp/";
	fs.mkdirSync(tempDir, { recursive: true });
	fs.writeFileSync(tempDir + "/input.json", input);
	if (output) fs.writeFileSync(tempDir + "/output.json", JSON.stringify(output));
	log(logSymbols.info, chalk.whiteBright("Saved latest output to temp directory"));
}

const handleSuccess = function (input, output, test_file_name) {

	log(logSymbols.success, chalk.greenBright("Test Script Ran Successfully"));
	let results = output.data.results;
	let results_correct = checkOutputMatches(results, test_file_name);

	if (results_correct) {
		log(logSymbols.success, chalk.greenBright("Results match expected_return.json"));
	} else {
		log(logSymbols.error, chalk.redBright("Error: Results did not match expected_return.json, see warning above"));
	}

	saveTempOutput(input, results);
	return;
};

const handleError = function (input, output) {
	log(logSymbols.error, chalk.redBright("Test Script Failed"));
	let results = output;
	saveTempOutput(input, results);
	return;
};

const runTest = function(test_file_name) {

	// Grab config.json, calculate.json and input
	const config_json = fs.readFileSync(__dirname + "/../config.json", "utf8");
	const calculate_js = fs.readFileSync(__dirname + "/../calculate.js", "utf8");
	const request_url = "https://qd.skyciv.com/runTestScript";
	const input = fs.readFileSync(__dirname + "/" + test_file_name + "/input.json", "utf8");
	const api_credentials = JSON.parse(fs.readFileSync(__dirname + "/../api_credentials.json", "utf8"));

	let json_data = {};
	let utils_data = {};
	
	// Check if the JSON Directory exists
	const directoryPathJSON = path.join(__dirname, '..', 'json');
	if (fs.existsSync(directoryPathJSON)) {
		const files = fs.readdirSync(directoryPathJSON);
		files.forEach(file => {
			const filePath = path.join(directoryPathJSON, file);
			const fileContent = fs.readFileSync(filePath, 'utf8');
			json_data[file] = fileContent;
		});
	}
	
	// Check if the JSON Directory exists
	const directoryPathUtils = path.join(__dirname, '..', 'utils');
	if (fs.existsSync(directoryPathUtils)) {
		const files = fs.readdirSync(directoryPathUtils);
		files.forEach(file => {
			const filePath = path.join(directoryPathUtils, file);
			const fileContent = fs.readFileSync(filePath, 'utf8');
			utils_data[file] = fileContent;
		});
	}

	log(logSymbols.info, chalk.whiteBright("Running Test Script:"), chalk.blue(test_file_name));

	const payloadData = JSON.stringify({
		config_json: config_json,
		calculate_js: calculate_js,
		input_json: input,
		auth: api_credentials["auth"],
		key: api_credentials["key"],
		json: json_data,
		utils: utils_data,
	});


	return new Promise(function(resolve) {
		fetch(request_url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ payload: payloadData })
		})
		.then(res => {
			if (res.ok) {
				return res.json();
			} else {
				throw new Error('No Server Response');
			}
		})
		.then(body => {
			log(chalk.greenBright(logSymbols.success, "Server Response Received"));
			if (body.status === 0) {
				handleSuccess(input, body, test_file_name);
			} else {
				handleError(input, body);
			}
			resolve();
		})
		.catch(err => {
			log(chalk.redBright(logSymbols.error, "No Server Response"));
			log(err);
			resolve();
		});
	});
}

if (test_file_arg == "all") {
	fs.readdir(__dirname + "/", async function(err, filenames) {
		if (err) {
			log(
				logSymbols.error, 
				chalk.redBright("Failed to run all test files"), 
			);
			process.exit();
		} else {
			for (var test_file of filenames) {

				if (test_file.indexOf("runTest.mjs") > -1) continue;
				if (test_file.indexOf("runTestBasic.js") > -1) continue;
				if (test_file.indexOf(".xlsx") > -1) continue;
				if (test_file.indexOf("temp") > -1) continue;
				
				await runTest(test_file);
			}
		}
	});
} else if (fs.existsSync(__dirname + "/" + test_file_name)) {
	runTest(test_file_name);
} else {
	log(
		logSymbols.error, 
		chalk.redBright("File"), 
		chalk.whiteBright(test_file_name),
		chalk.redBright("does not exist in /test_files directory")
	);
	process.exit();
}

			
		