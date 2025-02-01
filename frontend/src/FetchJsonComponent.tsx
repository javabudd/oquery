import {useCallback, useEffect, useRef, useState} from "react";

const API_URL = "http://localhost:6969/query";

const FetchJsonComponent: React.FC = () => {
	const [query, setQuery] = useState<string>("");
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
					model: "deepseek-r1",
					messages: [{role: "user", content: query}],
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
	}, [query]);

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
			</div>
		</div>
	);
};

export default FetchJsonComponent;
