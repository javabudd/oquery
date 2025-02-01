import {useCallback, useEffect, useRef, useState} from "react";

const API_URL = "https://javabudd.hopto.org/query";
const DEFAULT_MODEL = 'llama3.2';

const QueryLlmComponent: React.FC = () => {
	const [query, setQuery] = useState<string>("");
	const [model, setModel] = useState<string | null>(null);
	const [searchEngine, setSearchEngine] = useState<string | null>(null);
	const [response, setResponse] = useState<string>("");
	const [loading, setLoading] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);
	const controllerRef = useRef<AbortController | null>(null);
	const responseRef = useRef<HTMLDivElement | null>(null);

	const sendRequest = useCallback(async () => {
		if (!query.trim()) return; // Prevent empty queries

		setLoading(true);
		setError(null);
		setResponse(""); // Clear previous response

		// Abort any previous request
		if (controllerRef.current) {
			controllerRef.current.abort();
		}

		const controller = new AbortController();
		controllerRef.current = controller;
		const signal = controller.signal;

		console.log("Sending query:", query);

		try {
			const res = await fetch(API_URL, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					model: model ? model : DEFAULT_MODEL,
					message: query,
					history: [],
					searchEngine
				}),
				signal,
			});

			if (!res.ok || !res.body) {
				throw new Error(`Server error: ${res.statusText}`);
			}

			// Read and process the stream
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
	}, [model, query]);

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
		setModel(null);
	};

	// Auto-scroll down when response updates
	useEffect(() => {
		if (responseRef.current) {
			responseRef.current.scrollTop = responseRef.current.scrollHeight;
		}
	}, [response]);

	return (
		<div style={{padding: "20px", fontFamily: "Arial, sans-serif", textAlign: "center"}}>
			<h2>How can we help?</h2>

			<div
				ref={responseRef}
				style={{
					marginTop: "20px",
					color: "green",
					whiteSpace: "pre-line",
					textAlign: "center",
					border: "1px solid #ddd",
					padding: "10px",
					borderRadius: "5px",
					backgroundColor: "#f9f9f9",
					maxWidth: "600px",
					margin: "20px auto",
					overflowWrap: "break-word",
					wordWrap: "break-word",
					overflowY: "auto",
					maxHeight: "300px",
				}}
			>
				{response && <strong>Response:</strong>}
				<p>{response}</p>
			</div>

			{error && <p style={{marginTop: "20px", color: "red"}}>Error: {error}</p>}

			<input
				type="text"
				placeholder="Enter your query"
				value={query}
				onChange={(e) => setQuery(e.target.value)}
				disabled={loading}
				style={{
					padding: "10px",
					fontSize: "16px",
					marginRight: "10px",
					width: "80%",
					maxWidth: "400px",
				}}
			/>

			<div style={{marginTop: "10px"}}>
				{loading ? (
					<button onClick={stopRequest} style={{
						padding: "10px",
						fontSize: "16px",
						marginRight: "10px",
						backgroundColor: "red",
						color: "white"
					}}>
						Cancel
					</button>
				) : (
					<button onClick={sendRequest} disabled={loading}
					        style={{padding: "10px", fontSize: "16px", marginRight: "10px"}}>
						Send
					</button>
				)}
				<button onClick={resetForm}
				        style={{padding: "10px", fontSize: "16px", backgroundColor: "gray", color: "white"}}>
					Reset
				</button>
				<select onChange={(e) => setModel(e.target.value)}
				        style={{padding: "10px", fontSize: "16px", marginLeft: "10px"}}>
					<option selected={true} value={"llama3.2"}>Llama 3.2</option>
					<option value={"phi4"}>phi4</option>
					<option value={"deepseek-r1"}>DeepSeek-R1</option>
				</select>
				<select disabled={true} onChange={(e) => setSearchEngine(e.target.value)}
				        style={{padding: "10px", fontSize: "16px", marginLeft: "10px"}}>
					<option selected={true} value={"duckduckgo"}>DuckDuckGo</option>
				</select>
			</div>
		</div>
	);
};

export default QueryLlmComponent;
