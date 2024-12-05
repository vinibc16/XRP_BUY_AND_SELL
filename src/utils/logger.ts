import { config } from 'dotenv';
import { formatDateTime } from '../xrpl/helpers';
import * as fs from 'fs';

// Load environment variables
config();

const isDebugEnabled = process.env.DEBUG === 'true'; // Check if debug mode is enabled from environment variable

// Define the path for the log file
const logFilePath = 'logs.txt';

// Function to write log messages to a file
const writeToFile = (message: string) => {
  fs.appendFileSync(logFilePath, message + '\n', 'utf8'); // Append the message to the log file
};

// Logger utility object with different log levels
export const logger = {
  // Logs general informational messages
  info: (message: string) => {
    const timeNow = new Date(Date.now());
    const convertedTime = formatDateTime(timeNow); // Format the current date and time
    const logMessage = `[${convertedTime}] - ${message}`; // Format the log message
    console.log(logMessage); // Output the message to the console
    writeToFile(logMessage); // Write the message to the log file
  },

  // Logs debug messages when debug mode is enabled
  log: (message: string) => {
    if (isDebugEnabled) { // Check if debug logging is enabled
      const timeNow = new Date(Date.now());
      const convertedTime = formatDateTime(timeNow); // Format the current date and time
      const logMessage = `[${convertedTime}] - [DEBUG] - ${message}`; // Format the debug message
      //console.log(logMessage); // Uncomment to log debug messages to the console
      writeToFile(logMessage); // Write the debug message to the log file
    }
  },

  // Logs error messages
  error: (message: string) => {
    const timeNow = new Date(Date.now());
    const convertedTime = formatDateTime(timeNow); // Format the current date and time
    const errorMessage = `[${convertedTime}] - [ERROR] - ${message}`; // Format the error message
    //console.error(errorMessage); // Uncomment to log error messages to the console
    writeToFile(errorMessage); // Write the error message to the log file
  }
};
