import {AwsRum, AwsRumConfig} from 'aws-rum-web';
import React, {useCallback, useRef, useState} from 'react';
import QueryLlmComponent from "./QueryLlmComponent";
import {clearHistory, Message, saveMessage} from "./idb";

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

const API_URL = process.env.REACT_APP_LLAMA_QUERY_URL ?? "https://javabudd.hopto.org/query";

function App() {
	const DEFAULT_MODEL = "llama3.1";
	const DEFAULT_SEARCH_ENGINE = "duckduckgo";

	const [response, setResponse] = useState("");
	const [history, setHistory] = useState<Array<Message>>([]);
	const [error, setError] = useState<string | null>(null);
	const [message, setMessage] = useState("");
	const [sections, setSections] = useState<string[]>([]);
	const [model, setModel] = useState<string>(DEFAULT_MODEL);
	const [systemContent, setSystemContent] = useState<string | undefined>(undefined);
	const [searchEngine, setSearchEngine] = useState<string>(DEFAULT_SEARCH_ENGINE);
	const [loading, setLoading] = useState(false);
	const controllerRef = useRef<AbortController | null>(null);

	const sendRequest = useCallback(async () => {
		if (!message.trim()) return;

		setLoading(true);
		setError(null);
		setSections((state) => [...state, message.trim()]);
		setResponse("");
		setMessage("");

		if (controllerRef.current) {
			controllerRef.current.abort();
		}

		const controller = new AbortController();
		controllerRef.current = controller;
		const signal = controller.signal;

		const newMessage = {role: "user", content: message, conversation_id: "123"};

		try {
			const res = await fetch(API_URL, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					model,
					message,
					searchEngine,
					history: [...history],
					systemContent
				}),
				signal,
			});

			if (!res.ok || !res.body) {
				throw new Error(`Server error: ${res.statusText}`);
			}

			const reader = res.body.getReader();
			const decoder = new TextDecoder();
			let result = "";

			while (true) {
				const {done, value} = await reader.read();
				if (done) break;
				result += decoder.decode(value, {stream: true});
				setResponse(result);
			}

			const assistantResponse = {role: "assistant", content: result, conversation_id: "123"};

			await saveMessage(newMessage);
			await saveMessage(assistantResponse);
			setHistory(prev => [...prev, newMessage, assistantResponse]);
		} catch (err) {
			if ((err as Error).name !== "AbortError") {
				setError((err as Error).message);
			}
		} finally {
			setLoading(false);
		}
	}, [message, model, searchEngine, history, systemContent]);

	const stopRequest = () => {
		if (controllerRef.current) {
			controllerRef.current.abort();
			controllerRef.current = null;
		}
		setLoading(false);
		setError("Request was cancelled.");
	};

	const resetForm = async () => {
		setMessage("");
		setResponse("");
		setSections([])
		setError(null);
		setModel(DEFAULT_MODEL);
		setSearchEngine(DEFAULT_SEARCH_ENGINE);
		setHistory([]);
		setSystemContent(undefined);
		await clearHistory();
	};

	return (
		<div className="App-container">
			<header className="App-header"></header>
			<div className="App-content">
				<QueryLlmComponent
					response={response}
					setSections={setSections}
					setHistory={setHistory}
					sections={sections}
					error={error}
				/>
			</div>
			<div className={"mx-auto"}>
				<textarea
					placeholder="Enter your query"
					value={message}
					onChange={(e) => setMessage(e.target.value)}
					onKeyDown={async (e) => {
						if (e.key === "Enter" && !e.shiftKey) {
							e.preventDefault(); // Prevents newline in textarea
							await sendRequest();
						}
					}}
					disabled={loading}
					className="p-2 mt-4 w-full max-w-md border rounded-md"
				/>
				<div className="mt-4 flex flex-wrap justify-center gap-3">
					{loading ? (
						<button
							onClick={stopRequest}
							className="p-2 bg-red-500 text-white rounded-md"
						>
							Cancel
						</button>
					) : (
						<button
							onClick={sendRequest}
							disabled={loading}
							className="p-2 bg-blue-500 text-white rounded-md"
						>
							Send
						</button>
					)}
					<button onClick={resetForm} className="p-2 bg-gray-500 text-white rounded-md">Reset</button>
					<select
						onChange={(e) => setModel(e.target.value)}
						value={model}
						className="p-2 border rounded-md"
					>
						<option value="llama3.1">Llama 3.1 (8B)</option>
						<option value="llama3.2">Llama 3.2 (3B)</option>
						<option value="openthinker">openthinker (7B)</option>
						<option value="phi4">phi4 (14B)</option>
						<option value="deepseek-r1">DeepSeek-R1 (7B)</option>
						<option value="deepseek-r1:14b">DeepSeek-R1 (14B)</option>
						<option disabled={true} value="">---- Premium ----</option>
						<option disabled={true} value="llama3.3">Llama 3.3 (70B)</option>
						<option disabled={true} value="deepseek-r1:70b">DeepSeek-R1 (70B)</option>
						<option disabled={true} value="deepseek-r1:671b">DeepSeek-R1 (671B)</option>
					</select>
				</div>
			</div>
			<footer className="footer">
				<p>Made with love by <a className={"text-cyan-500"} href="https://github.com/javabudd/oquery">javabudd</a></p>
			</footer>
		</div>
	);
}

export default App;
