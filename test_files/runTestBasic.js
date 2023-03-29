const fs = require('fs');
const request = require('request');

// Globals
const log = console.log;

// Define test file
const test_file_arg = process.argv[2];

const checkOutputMatches = function (output, test_file_name) {
	let expectedOutputPath = __dirname + "/" + test_file_name + "/expected_return.json";
	if (fs.existsSync(expectedOutputPath)) {
		let expected_output = JSON.parse(fs.readFileSync(expectedOutputPath, "utf8"));
		let results_correct = true;

		Object.keys(expected_output).forEach((elem) => {
			let expected_value = expected_output[elem];
			let results_value = output[elem];
			if (output[elem] == undefined) {
				results_correct = false;
				log("Output missing key:", elem);
			} 

			if (expected_value.value != undefined) {
				if (output[elem].value == undefined) {
					results_correct = false;
					log("Output missing value for key:", elem);
				} 
				
				if (expected_value.value != results_value.value) {
					results_correct = false;
					log("Output value for key:", elem, "did not match expected result");
				}
			}
		});

		return results_correct;
	} else {
		log("No expected_return.json provided.");
		return false;
	}
};

const saveTempOutput = function (input, output) {
	let tempDir = __dirname + "/temp/";
	fs.mkdirSync(tempDir, { recursive: true });
	fs.writeFileSync(tempDir + "/input.json", input);
	if (output) fs.writeFileSync(tempDir + "/output.json", JSON.stringify(output));
	log("Saved latest output to temp directory");
}

const handleSuccess = function (input, output, test_file_name) {
	log("Test Script Ran Successfully");
	let results = output.data.results;
	let results_correct = checkOutputMatches(results, test_file_name);
	if (results_correct) {
		log("Results match expected_return.json");
	} else {
		log("Error: Results did not match expected_return.json, see warning above");
	}
	saveTempOutput(input, results);
	return;
};

const handleError = function (input, output) {
	log("Test Script Failed");
	let results = output.msg;
	saveTempOutput(input, results);
	return;
};

const runTest = function(test_file_name) {

	// Grab config.json, calculate.json and input
	const config_json = fs.readFileSync(__dirname + "/../config.json", "utf8");
	const calculate_js = fs.readFileSync(__dirname + "/../calculate.js", "utf8");
	const request_url = "https://platform.skyciv.com:8088/runTestScript";
	const input = fs.readFileSync(__dirname + "/" + test_file_name + "/input.json", "utf8");
	const api_credentials = JSON.parse(fs.readFileSync(__dirname + "/../api_credentials.json", "utf8"));
	
	log("Running Test Script:");

	const payloadData = JSON.stringify({
		config_json: config_json,
		calculate_js: calculate_js,
		input_json: input,
		auth: api_credentials["auth"],
		key: api_credentials["key"]
	});

	return new Promise(function (resolve) {
		request.post(
			request_url,
			{ json: true, body: { payload: payloadData } },
			function (err, res, body) {
				if (!err && res.statusCode === 200) {
					log("Server Response Received");
					if (body.status === 0) {
						handleSuccess(input, body, test_file_name);
					} else {
						handleError(input, body);
					}
					resolve();
				} else {
					log("No Server Response");
					log(err);
					resolve();
				}
			}
		);
	});
}

if (test_file_arg == "all") {
	fs.readdir(__dirname + "/", async function(err, filenames) {
		if (err) {
			log("Failed to run all test files");
			process.exit();
		} else {
			for (var test_file of filenames) {
	
				if (test_file.indexOf("runTest.mjs") > -1) continue;
				if (test_file.indexOf("runTestBasic.js") > -1) continue;
				if (test_file.indexOf(".xlsx") > -1) continue;
				if (test_file.indexOf("temp") > -1) continue;
				
				log("")
				log("Test File", test_file)

				await runTest(test_file);
			}
		}
	});
} else if (fs.existsSync(__dirname + "/" + test_file_name)) {
	runTest(test_file_name);
} else {
	log("File", test_file_name, "does not exist in test_files directory");
	process.exit();
}

			
		