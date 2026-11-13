import { EmailError, emailConfigurationSummary } from "../src/lib/email";

try {
  const configuration = emailConfigurationSummary();
  console.log(`Email provider: ${configuration.provider}`);
  console.log(`Sender: ${configuration.from}`);
  console.log("Email delivery configuration is ready.");
} catch (error) {
  const code = error instanceof EmailError ? error.code : "email_configuration_invalid";
  console.error(`Email delivery configuration is not ready: ${code}`);
  process.exitCode = 1;
}
