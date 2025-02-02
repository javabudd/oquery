import {useCallback, useEffect, useRef, useState} from "react";

const API_URL = "https://javabudd.hopto.org/query";
const DEFAULT_MODEL = "llama3.2";
const DEFAULT_SEARCH_ENGINE = "duckduckgo";

const QueryLlmComponent: React.FC = () => {
	const [query, setQuery] = useState("");
	const [model, setModel] = useState<string>(DEFAULT_MODEL);
	const [searchEngine, setSearchEngine] = useState<string>(DEFAULT_SEARCH_ENGINE);
	const [response, setResponse] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const controllerRef = useRef<AbortController | null>(null);
	const responseRef = useRef<HTMLDivElement | null>(null);

	const sendRequest = useCallback(async () => {
		if (!query.trim()) return;

		setLoading(true);
		setError(null);
		setResponse("");

		if (controllerRef.current) {
			controllerRef.current.abort();
		}

		const controller = new AbortController();
		controllerRef.current = controller;
		const signal = controller.signal;

		try {
			const res = await fetch(API_URL, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({model, message: query, history: [], searchEngine}),
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
		} catch (err) {
			if ((err as Error).name !== "AbortError") {
				setError((err as Error).message);
			}
		} finally {
			setLoading(false);
		}
	}, [model, query, searchEngine]);

	const stopRequest = () => {
		if (controllerRef.current) {
			controllerRef.current.abort();
			controllerRef.current = null;
		}
		setLoading(false);
		setError("Request was cancelled.");
	};

	const resetForm = () => {
		setQuery("");
		setResponse("");
		setError(null);
		setModel(DEFAULT_MODEL);
		setSearchEngine(DEFAULT_SEARCH_ENGINE);
	};

	useEffect(() => {
		if (responseRef.current) {
			responseRef.current.scrollTop = responseRef.current.scrollHeight;
		}
	}, [response]);

	return (
		<div className="p-5 font-sans text-center max-w-xl mx-auto">
			<h2 className="text-xl font-bold">How can we help?</h2>
			<div ref={responseRef}
			     className="mt-5 text-green-600 whitespace-pre-line text-center border border-gray-300 p-3 rounded-md bg-gray-100 w-full max-w-xl mx-auto overflow-y-auto h-72 max-h-96 break-words">
				{response && <strong>Response:</strong>}
				<p>{response}</p>
			</div>

			{error && <p className="mt-5 text-red-500">Error: {error}</p>}
			<input type="text" placeholder="Enter your query" value={query} onChange={(e) => setQuery(e.target.value)}
			       disabled={loading} className="p-2 mt-4 w-full max-w-md border rounded-md"/>

			<div className="mt-4 flex flex-wrap justify-center gap-3">
				{loading ? (
					<button onClick={stopRequest} className="p-2 bg-red-500 text-white rounded-md">Cancel</button>
				) : (
					<button onClick={sendRequest} disabled={loading}
					        className="p-2 bg-blue-500 text-white rounded-md">Send</button>
				)}
				<button onClick={resetForm} className="p-2 bg-gray-500 text-white rounded-md">Reset</button>
				<select onChange={(e) => setModel(e.target.value)} value={model} className="p-2 border rounded-md">
					<option value="llama3.2">Llama 3.2 (3B)</option>
					<option value="phi4">phi4 (14B)</option>
					<option value="deepseek-r1">DeepSeek-R1 (7B)</option>
					<option disabled={true} value="">---- Premium ----</option>
					<option disabled={true} value="deepseek-r1-70b">DeepSeek-R1 (70B)</option>
					<option disabled={true} value="llama3.3">Llama 3.3 (70B)</option>
				</select>
				<select disabled value={searchEngine} className="p-2 border rounded-md">
					<option value="duckduckgo">DuckDuckGo</option>
				</select>
			</div>
		</div>
	);
};

export default QueryLlmComponent;
