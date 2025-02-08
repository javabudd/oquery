import {AwsRum, AwsRumConfig} from 'aws-rum-web';
import React from 'react';
import QueryLlmComponent from "./QueryLlmComponent";

try {
	const config: AwsRumConfig = {
		sessionSampleRate: 1,
		identityPoolId: process.env.REACT_APP_AWS_RUM_IDENTITY_POOL_ID,
		endpoint: "https://dataplane.rum.us-west-2.amazonaws.com",
		telemetries: ["performance", "errors", "http"],
		allowCookies: true,
		enableXRay: false
	};

	const APPLICATION_ID: string = process.env.REACT_APP_AWS_RUM_APPLICATION_ID ?? '0';
	const APPLICATION_VERSION: string = '1.0.0';
	const APPLICATION_REGION: string = process.env.REACT_APP_AWS_RUM_REGION ?? '0';

	new AwsRum(
		APPLICATION_ID,
		APPLICATION_VERSION,
		APPLICATION_REGION,
		config
	);
} catch (error) {
	// Ignore errors thrown during CloudWatch RUM web client initialization
}

function App() {
	return (
		<div>
			<header className="App-header"></header>
			<QueryLlmComponent/>
			<footer className="footer">
				<p>Made with love by <a className={"text-cyan-500"} href="https://github.com/javabudd/oquery">javabudd</a></p>
			</footer>
		</div>
	);
}

export default App;
