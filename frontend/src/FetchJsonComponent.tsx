import { useState, useCallback, useRef } from "react";

const API_URL = "http://localhost:6969/query";

const FetchJsonComponent: React.FC = () => {
	const [query, setQuery] = useState<string>("");
	const [response, setResponse] = useState<string>("");
	const [loading, setLoading] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);
	const controllerRef = useRef<AbortController | null>(null);

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
					messages: [{ role: "user", content: query }],
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
				const { done, value } = await reader.read();
				if (done) break;
				result += decoder.decode(value, { stream: true });
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
		setError("Request was stopped.");
	};

	return (
		<div style={{ padding: "20px", fontFamily: "Arial, sans-serif", textAlign: "center" }}>
			<h2>How can we help?</h2>

			{response && (
				<div
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
						overflow: "hidden",
					}}
				>
					<strong>Response:</strong> {response}
				</div>
			)}
			{error && <p style={{ marginTop: "20px", color: "red" }}>Error: {error}</p>}

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

			<div style={{ marginTop: "10px" }}>
				<button onClick={sendRequest} disabled={loading} style={{ padding: "10px", fontSize: "16px", marginRight: "10px" }}>
					{loading ? "Sending..." : "Send"}
				</button>
				<button onClick={stopRequest} disabled={!loading} style={{ padding: "10px", fontSize: "16px", backgroundColor: "red", color: "white" }}>
					Stop
				</button>
			</div>
		</div>
	);
};

export default FetchJsonComponent;
