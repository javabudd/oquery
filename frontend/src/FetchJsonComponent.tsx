import {useState} from "react";

const API_URL = "http://localhost:6969/query";

const FetchJsonComponent: React.FC = () => {
	const [query, setQuery] = useState<string>("");
	const [response, setResponse] = useState<string | null>(null);
	const [loading, setLoading] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);

	const sendRequest = async () => {
		setLoading(true);
		setError(null);
		console.log(query);

		try {
			const res = await fetch(API_URL, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(
					{
						model: 'deepseek-r1',
						messages: [
							{
								'role': 'user',
								'content': query
							},
						]
					}
				),
			});

			if (!res.ok) {
				throw new Error(`Server error: ${res.statusText}`);
			}

			const data = await res.json();
			setResponse(data.message);
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
			{response && <p style={{marginTop: "20px", color: "green"}}>Response: {response}</p>}
			{error && <p style={{marginTop: "20px", color: "red"}}>Error: {error}</p>}
		</div>
	);
};

export default FetchJsonComponent;
