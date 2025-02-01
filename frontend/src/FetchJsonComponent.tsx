import {useState} from "react";

const API_URL = "http://localhost:6969/query";

const FetchJsonComponent: React.FC = () => {
	const [query, setQuery] = useState<string>("");
	const [response, setResponse] = useState<string>("");
	const [loading, setLoading] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);

	const sendRequest = async () => {
		setLoading(true);
		setError(null);
		setResponse(""); // Clear previous response
		console.log("Sending query:", query);

		try {
			const res = await fetch(API_URL, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					model: "deepseek-r1",
					messages: [
						{
							role: "user",
							content: query,
						},
					],
				}),
			});

			if (!res.ok || !res.body) {
				throw new Error(`Server error: ${res.statusText}`);
			}

			// Read and process the stream
			const reader = res.body.getReader();
			const decoder = new TextDecoder();

			while (true) {
				const {done, value} = await reader.read();
				if (done) break;
				const chunk = decoder.decode(value, {stream: true});
				setResponse((prev) => prev + chunk); // Append chunk to response
			}
		} catch (err) {
			setError((err as Error).message);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div style={{padding: "20px", fontFamily: "Arial, sans-serif"}}>
			<h2>Enter Query</h2>
			<input
				type="text"
				placeholder="Enter your query"
				value={query}
				onChange={(e) => setQuery(e.target.value)}
				style={{padding: "10px", fontSize: "16px", marginRight: "10px"}}
			/>
			<button onClick={sendRequest} disabled={loading} style={{padding: "10px", fontSize: "16px"}}>
				{loading ? "Sending..." : "Send"}
			</button>
			{response && (
				<p style={{marginTop: "20px", color: "green", whiteSpace: "pre-line"}}>
					<strong>Response:</strong> {response}
				</p>
			)}
			{error && <p style={{marginTop: "20px", color: "red"}}>Error: {error}</p>}
		</div>
	);
};

export default FetchJsonComponent;
